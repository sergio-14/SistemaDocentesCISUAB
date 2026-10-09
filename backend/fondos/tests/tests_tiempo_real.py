"""Tiempo real (WebSockets, servicio "realtime"): base de Channels, conexión y grupos."""
from datetime import timedelta
from unittest import mock

from channels.layers import get_channel_layer
from django.test import TestCase, TransactionTestCase
from rest_framework_simplejwt.tokens import AccessToken

from fondos.consumers import (
    CIERRE_ASIGNACION_AJENA, CIERRE_NO_AUTENTICADO, GRUPO_SUPERUSUARIOS, AsignacionAjena,
    TiempoRealConsumer, grupos_de_conexion,
)
from fondos.models import AsignacionCarrera, PerfilUsuario
from .tests_usuarios_auditoria import DatosUsuariosMixin, UsuariosBaseTestCase
from .websocket_prueba import ClienteWebSocket

RUTA = '/ws/tiempo-real/'


def _aplicacion():
    from config.asgi import application
    return application


class BaseTiempoRealTests(TestCase):
    def test_la_entrada_asgi_carga_http_y_websocket(self):
        from channels.routing import ProtocolTypeRouter
        from config.asgi import application

        self.assertIsInstance(application, ProtocolTypeRouter)
        self.assertEqual(set(application.application_mapping), {'http', 'websocket'})

    def test_sin_redis_la_capa_queda_en_memoria(self):
        self.assertEqual(type(get_channel_layer()).__name__, 'InMemoryChannelLayer')

    async def test_una_ruta_ws_desconocida_se_rechaza(self):
        from config.asgi import application

        cliente = ClienteWebSocket(application, '/ws/no-existe/')
        with self.assertRaises(ValueError):
            await cliente.conectar()


class GruposDeConexionTests(UsuariosBaseTestCase):
    """A qué grupos entra cada rol activo (los mismos alcances que la API)."""

    def setUp(self):
        super().setUp()
        self.director = self.crear_usuario('director_ws', 'director', carrera=self.carrera, is_staff=True, ci='DWS')
        self.jefe = self.crear_usuario('jefe_ws', 'jefe_estudios', carrera=self.carrera, is_staff=True, ci='JWS')
        self.instituto = self.crear_usuario('instituto_ws', 'iiisyp', carrera=self.carrera, ci='IWS')
        self.usuario_docente = self.crear_usuario('docente_ws', 'docente', carrera=self.carrera, ci='CWS')
        self.docente = self.crear_docente('CWS', usuario=self.usuario_docente)
        PerfilUsuario.objects.filter(user=self.usuario_docente).update(docente=self.docente)

    def test_grupos_por_rol(self):
        c = self.carrera.pk
        self.assertEqual(grupos_de_conexion(self.director), [f'carrera_{c}_director'])
        self.assertEqual(grupos_de_conexion(self.jefe), [f'carrera_{c}_jefe'])
        self.assertEqual(grupos_de_conexion(self.usuario_docente), [f'docente_{self.docente.pk}'])
        self.assertEqual(grupos_de_conexion(self.instituto), [])
        self.assertEqual(grupos_de_conexion(self.superuser), [GRUPO_SUPERUSUARIOS])

    def test_el_rol_activo_decide_los_grupos(self):
        # El Director que además es docente: con su asignación de docente entra solo a la suya.
        AsignacionCarrera.objects.create(user=self.director, carrera=self.carrera, rol='docente', docente=self.docente)
        como_docente = AsignacionCarrera.objects.get(user=self.director, rol='docente')
        como_director = AsignacionCarrera.objects.get(user=self.director, rol='director')

        self.assertEqual(grupos_de_conexion(self.director, como_docente.pk), [f'docente_{self.docente.pk}'])
        self.assertEqual(grupos_de_conexion(self.director, como_director.pk), [f'carrera_{self.carrera.pk}_director'])

    def test_una_asignacion_ajena_se_rechaza(self):
        ajena = AsignacionCarrera.objects.get(user=self.jefe)
        with self.assertRaises(AsignacionAjena):
            grupos_de_conexion(self.director, ajena.pk)


# TransactionTestCase: el socket usa la base desde otro hilo (database_sync_to_async),
# que no ve la transacción abierta de TestCase.
class ConexionTiempoRealTests(DatosUsuariosMixin, TransactionTestCase):
    def setUp(self):
        super().setUp()
        self.director = self.crear_usuario('director_con', 'director', carrera=self.carrera, is_staff=True, ci='DCO')
        self.jefe = self.crear_usuario('jefe_con', 'jefe_estudios', carrera=self.carrera, is_staff=True, ci='JCO')
        self.instituto = self.crear_usuario('instituto_con', 'iiisyp', carrera=self.carrera, ci='ICO')

    async def _conectado(self, user=None, token=None, asignacion=None):
        cliente = ClienteWebSocket(_aplicacion(), RUTA)
        self.assertTrue(await cliente.conectar())
        if token is None and user is not None:
            token = str(AccessToken.for_user(user))
        await cliente.enviar({'tipo': 'auth', 'token': token, 'asignacion': asignacion})
        return cliente

    async def test_con_token_valido_queda_lista(self):
        cliente = await self._conectado(self.director)
        self.assertEqual(await cliente.recibir(), {'tipo': 'listo'})
        await cliente.enviar({'tipo': 'ping'})
        self.assertEqual(await cliente.recibir(), {'tipo': 'pong'})
        await cliente.desconectar()

    async def test_token_invalido_o_vencido_se_cierra(self):
        vencido = AccessToken.for_user(self.director)
        vencido.set_exp(lifetime=-timedelta(minutes=1))
        for token in ('no-es-un-token', str(vencido)):
            with self.subTest(token=token[:12]):
                cliente = await self._conectado(token=token)
                self.assertEqual(await cliente.recibir(), {'cerrado': CIERRE_NO_AUTENTICADO})

    async def test_asignacion_ajena_se_cierra(self):
        from channels.db import database_sync_to_async
        ajena = await database_sync_to_async(lambda: AsignacionCarrera.objects.get(user=self.jefe).pk)()
        cliente = await self._conectado(self.director, asignacion=ajena)
        self.assertEqual(await cliente.recibir(), {'cerrado': CIERRE_ASIGNACION_AJENA})

    async def test_sin_autenticarse_a_tiempo_se_cierra(self):
        with mock.patch.object(TiempoRealConsumer, 'TIEMPO_PARA_AUTENTICAR', 0.1):
            cliente = ClienteWebSocket(_aplicacion(), RUTA)
            self.assertTrue(await cliente.conectar())
            self.assertEqual(await cliente.recibir(), {'cerrado': CIERRE_NO_AUTENTICADO})

    async def test_se_cierra_cuando_vence_el_token(self):
        token = AccessToken.for_user(self.director)
        token.set_exp(lifetime=timedelta(seconds=1))
        cliente = await self._conectado(token=str(token))
        self.assertEqual(await cliente.recibir(), {'tipo': 'listo'})
        self.assertEqual(await cliente.recibir(timeout=3), {'cerrado': CIERRE_NO_AUTENTICADO})

    async def test_el_instituto_se_conecta_pero_sin_grupos(self):
        cliente = await self._conectado(self.instituto)
        self.assertEqual(await cliente.recibir(), {'tipo': 'listo'})
        await get_channel_layer().group_send(f'carrera_{self.carrera.pk}_director', {'type': 'prueba'})
        self.assertTrue(await cliente.nada_pendiente())
        await cliente.desconectar()
