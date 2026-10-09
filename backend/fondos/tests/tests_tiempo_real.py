"""Tiempo real (WebSockets, servicio "realtime"): base de Channels, conexión, grupos y avisos."""
import asyncio
from datetime import timedelta
from unittest import mock

from channels.layers import get_channel_layer
from django.test import TestCase, TransactionTestCase
from rest_framework_simplejwt.tokens import AccessToken

from fondos.consumers import (
    CIERRE_ASIGNACION_AJENA, CIERRE_NO_AUTENTICADO, GRUPO_SUPERUSUARIOS, AsignacionAjena,
    TiempoRealConsumer, grupos_de_conexion,
)
from fondos.models import AsignacionCarrera, HistorialFondo, PerfilUsuario
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
        self.assertEqual(grupos_de_conexion(self.instituto), [f'carrera_{c}_instituto'])
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

    async def test_el_instituto_no_recibe_los_avisos_del_director(self):
        cliente = await self._conectado(self.instituto)
        self.assertEqual(await cliente.recibir(), {'tipo': 'listo'})
        await get_channel_layer().group_send(f'carrera_{self.carrera.pk}_director', {'type': 'prueba'})
        self.assertTrue(await cliente.nada_pendiente())
        await cliente.desconectar()


EVALUACION = {'cumplimiento': 'cumplido', 'evaluacion_director': 'Cumplió todas las actividades planificadas en la gestión.'}


class SocketBaseTests(DatosUsuariosMixin, TransactionTestCase):
    """Usuarios de una carrera, un fondo y ayudas para escuchar por el socket (sin tests)."""

    def setUp(self):
        super().setUp()
        from rest_framework.test import APIClient
        from fondos.models import FondoTiempo
        self.api = APIClient()
        self.director = self.crear_usuario('director_sk', 'director', carrera=self.carrera, is_staff=True, ci='DSK')
        self.jefe = self.crear_usuario('jefe_sk', 'jefe_estudios', carrera=self.carrera, is_staff=True, ci='JSK')
        self.instituto = self.crear_usuario('instituto_sk', 'iiisyp', carrera=self.carrera, ci='ISK')
        self.usuario_docente = self.crear_usuario('docente_sk', 'docente', carrera=self.carrera, ci='CSK')
        self.docente = self.crear_docente('CSK', usuario=self.usuario_docente)
        PerfilUsuario.objects.filter(user=self.usuario_docente).update(docente=self.docente)
        self.fondo = FondoTiempo.objects.create(docente=self.docente, carrera=self.carrera, gestion=2026)
        self.nombre = self.docente.nombre_completo

    # --- ayudas ---
    def _estado(self, estado, informe=False):
        from fondos.models import FondoTiempo, InformeFondo
        FondoTiempo.objects.filter(pk=self.fondo.pk).update(estado=estado)
        InformeFondo.objects.filter(fondo_tiempo=self.fondo).delete()
        if informe:
            InformeFondo.objects.create(fondo_tiempo=self.fondo, elaborado_por=self.usuario_docente, tipo='parcial', estado='enviado')

    def _accion(self, usuario, ruta, datos=None):
        self.api.force_authenticate(usuario)
        response = self.api.post(f'/api/fondos-tiempo/{self.fondo.pk}/{ruta}/', datos or {}, format='json')
        self.assertEqual(response.status_code, 200, getattr(response, 'data', None))

    async def _conectar_todos(self):
        clientes = {}
        for usuario in (self.director, self.jefe, self.usuario_docente, self.instituto):
            cliente = ClienteWebSocket(_aplicacion(), RUTA)
            self.assertTrue(await cliente.conectar())
            await cliente.enviar({'tipo': 'auth', 'token': str(AccessToken.for_user(usuario)), 'asignacion': None})
            self.assertEqual(await cliente.recibir(), {'tipo': 'listo'})
            clientes[usuario.username] = cliente
        return clientes

    async def _pendientes(self, cliente):
        """Todo lo que llegó y no se leyó todavía (sin esperar de más)."""
        mensajes = []
        while not await cliente.nada_pendiente(0.5):
            mensajes.append(await cliente.recibir())
        return mensajes

    async def _reciben(self, clientes, esperado):
        """esperado: {usuario: texto}; los demás no reciben ningún aviso (los
        "fondo_actualizado" que también llegan no cuentan aquí)."""
        for usuario in (self.director, self.jefe, self.usuario_docente, self.instituto):
            cliente = clientes[usuario.username]
            avisos = [m['aviso'] for m in await self._pendientes(cliente) if m.get('tipo') == 'aviso']
            self.assertEqual([a['texto'] for a in avisos], [esperado[usuario]] if usuario in esperado else [], usuario.username)
            self.assertTrue(all(a['fondo_id'] == self.fondo.pk for a in avisos))
            await cliente.desconectar()

    async def _fila(self, preparar, accion, esperado):
        from asgiref.sync import sync_to_async
        await sync_to_async(preparar)()
        clientes = await self._conectar_todos()
        await sync_to_async(accion)()
        await self._reciben(clientes, esperado)


class AvisosPorSocketTests(SocketBaseTests):
    """La tabla de avisos (como tests_avisos.py) pero escuchando por el socket: cada
    acción real de la API llega al instante a quien corresponde, con el mismo texto."""

    # --- la tabla ---
    async def test_jefe_presenta_el_fondo(self):
        def presentar():
            HistorialFondo.objects.create(
                fondo_tiempo=self.fondo, usuario=self.jefe, tipo_cambio='presentacion', descripcion='-',
                estado_anterior='borrador', estado_nuevo='presentado_director',
            )
        await self._fila(lambda: self._estado('presentado_director'), presentar, {
            self.director: f'Nuevo fondo para revisar: {self.nombre} (gestión 2026).',
        })

    async def test_director_observa_rechaza_y_aprueba(self):
        casos = (
            ('observar', {'accion': 'observar', 'observacion': 'Revisar horas.'},
             'El fondo de {n} recibió observaciones.', 'Tu fondo de tiempo recibió observaciones.'),
            ('observar', {'accion': 'rechazar', 'observacion': 'No corresponde.'},
             'El fondo de {n} fue rechazado.', 'Tu fondo de tiempo fue rechazado.'),
            ('aprobar', {}, 'El fondo de {n} fue aprobado.', 'Tu fondo de tiempo fue aprobado.'),
        )
        for ruta, datos, al_jefe, al_docente in casos:
            with self.subTest(accion=datos.get('accion', ruta)):
                await self._fila(
                    lambda: self._estado('presentado_director'),
                    lambda: self._accion(self.director, ruta, datos),
                    {self.jefe: al_jefe.format(n=self.nombre), self.usuario_docente: al_docente},
                )

    async def test_director_inicia_la_ejecucion(self):
        await self._fila(lambda: self._estado('aprobado_director'), lambda: self._accion(self.director, 'iniciar_ejecucion'), {
            self.jefe: f'El fondo de {self.nombre} está en ejecución.',
            self.usuario_docente: 'Tu fondo está en ejecución. Ya puedes redactar tu informe.',
        })

    async def test_docente_presenta_el_informe(self):
        datos = {'seccion_academica': '<p>Dicté mis materias.</p>', 'conclusiones_generales': '<p>Cumplí.</p>'}
        await self._fila(lambda: self._estado('en_ejecucion'), lambda: self._accion(self.usuario_docente, 'presentar', datos), {
            self.director: f'{self.nombre} presentó su informe para evaluar.',
            self.jefe: f'{self.nombre} presentó su informe.',
        })

    async def test_director_solicita_correcciones_al_informe(self):
        await self._fila(
            lambda: self._estado('informe_presentado', informe=True),
            lambda: self._accion(self.director, 'observar-informe', {'comentario': 'Falta la sección académica.'}),
            {
                self.usuario_docente: 'Tu informe fue observado. Revisa las correcciones y vuelve a presentarlo.',
                self.jefe: f'El informe de {self.nombre} fue observado.',
            },
        )

    async def test_director_evalua_y_finaliza(self):
        await self._fila(
            lambda: self._estado('informe_presentado', informe=True),
            lambda: self._accion(self.director, 'evaluar-y-finalizar', EVALUACION),
            {
                self.usuario_docente: 'Tu fondo fue finalizado. Cumplimiento: Cumplido.',
                self.jefe: f'El fondo de {self.nombre} fue finalizado.',
            },
        )

    def test_si_redis_no_responde_la_accion_no_falla(self):
        class CapaCaida:
            async def group_send(self, grupo, mensaje):
                await asyncio.sleep(60)

        self._estado('presentado_director')
        with mock.patch('fondos.tiempo_real.get_channel_layer', return_value=CapaCaida()), \
                mock.patch('fondos.tiempo_real.TIEMPO_MAXIMO_PUBLICAR', 0.2), \
                self.assertLogs('fondos.tiempo_real', level='WARNING'):
            self._accion(self.director, 'aprobar')
        self.fondo.refresh_from_db()
        self.assertEqual(self.fondo.estado, 'aprobado_director')


class ChatPorSocketTests(SocketBaseTests):
    """Chat del fondo por el socket: quién se suscribe, mensajes, notas internas,
    leídos y hilo resuelto."""

    async def _chat(self, usuario, fondo_id=None):
        cliente = ClienteWebSocket(_aplicacion(), RUTA)
        self.assertTrue(await cliente.conectar())
        await cliente.enviar({'tipo': 'auth', 'token': str(AccessToken.for_user(usuario)), 'asignacion': None})
        self.assertEqual(await cliente.recibir(), {'tipo': 'listo'})
        await cliente.enviar({'tipo': 'suscribir_chat', 'fondo': fondo_id or self.fondo.pk})
        return cliente, await cliente.recibir()

    async def _evento_chat(self, cliente):
        """El próximo evento de chat (los avisos que lleguen en medio se saltan)."""
        while True:
            mensaje = await cliente.recibir()
            if mensaje.get('tipo') == 'chat':
                return mensaje

    async def test_quien_puede_suscribirse(self):
        from asgiref.sync import sync_to_async

        def otro_docente():
            usuario = self.crear_usuario('otro_doc_sk', 'docente', carrera=self.carrera, ci='OSK')
            docente = self.crear_docente('OSK', usuario=usuario)
            PerfilUsuario.objects.filter(user=usuario).update(docente=docente)
            return usuario
        ajeno = await sync_to_async(otro_docente)()
        await sync_to_async(self._estado)('presentado_director')

        for usuario, esperado in (
            (self.usuario_docente, 'chat_suscrito'), (self.jefe, 'chat_suscrito'),
            (self.director, 'chat_suscrito'), (self.instituto, 'chat_suscrito'), (ajeno, 'chat_denegado'),
        ):
            with self.subTest(usuario=usuario.username):
                cliente, respuesta = await self._chat(usuario)
                self.assertEqual(respuesta['tipo'], esperado)
                await cliente.desconectar()

    async def test_el_director_no_ve_el_chat_de_un_borrador_ajeno(self):
        cliente, respuesta = await self._chat(self.director)
        self.assertEqual(respuesta['tipo'], 'chat_denegado')
        await cliente.desconectar()

    async def test_observar_llega_el_hilo_y_el_mensaje(self):
        from asgiref.sync import sync_to_async
        await sync_to_async(self._estado)('presentado_director')
        docente, _ = await self._chat(self.usuario_docente)
        jefe, _ = await self._chat(self.jefe)

        await sync_to_async(self._accion)(self.director, 'observar', {'accion': 'observar', 'observacion': 'Revisar horas.'})

        for cliente in (docente, jefe):
            hilo = await self._evento_chat(cliente)
            mensaje = await self._evento_chat(cliente)
            self.assertEqual(hilo['evento'], 'hilo')
            self.assertEqual(mensaje['evento'], 'mensaje')
            self.assertEqual(mensaje['datos']['texto'], 'Revisar horas.')
            self.assertEqual(mensaje['datos']['observacion'], hilo['datos']['id'])
            await cliente.desconectar()

    async def test_la_nota_interna_no_le_llega_al_docente(self):
        from asgiref.sync import sync_to_async
        from fondos.models import ObservacionFondo

        def preparar():
            self._estado('presentado_director')
            return ObservacionFondo.objects.create(fondo_tiempo=self.fondo, resuelta=False).pk
        hilo = await sync_to_async(preparar)()
        docente, _ = await self._chat(self.usuario_docente)
        director, _ = await self._chat(self.director)

        def nota_interna():
            self.api.force_authenticate(self.jefe)
            response = self.api.post(f'/api/observaciones/{hilo}/agregar-mensaje/', {'texto': 'Solo entre nosotros', 'es_interno': True}, format='json')
            self.assertEqual(response.status_code, 200, response.data)
        await sync_to_async(nota_interna)()

        mensaje = await self._evento_chat(director)
        self.assertTrue(mensaje['datos']['es_interno'])
        self.assertTrue(await docente.nada_pendiente())
        await docente.desconectar()
        await director.desconectar()

    async def test_leido_y_resuelto(self):
        from asgiref.sync import sync_to_async
        from fondos.models import MensajeObservacion, ObservacionFondo

        def preparar():
            self._estado('observado')
            hilo = ObservacionFondo.objects.create(fondo_tiempo=self.fondo, resuelta=False)
            mensaje = MensajeObservacion.objects.create(observacion=hilo, autor=self.jefe, texto='Corrige la carga.')
            return hilo.pk, mensaje.pk
        hilo, mensaje = await sync_to_async(preparar)()
        jefe, _ = await self._chat(self.jefe)

        def leer_y_resolver():
            self.api.force_authenticate(self.usuario_docente)
            leer = self.api.get('/api/observaciones/novedades/', {'fondo_tiempo': self.fondo.pk, 'desde_id': 0, 'marcar_leido': 1})
            self.assertEqual(leer.status_code, 200)
            resolver = self.api.post(f'/api/observaciones/{hilo}/marcar-resuelta/', {}, format='json')
            self.assertEqual(resolver.status_code, 200, resolver.data)
        await sync_to_async(leer_y_resolver)()

        leidos = await self._evento_chat(jefe)
        self.assertEqual((leidos['evento'], leidos['datos']), ('leidos', {'autor': self.jefe.pk, 'hasta_id': mensaje}))
        resuelto = await self._evento_chat(jefe)
        self.assertEqual(resuelto['evento'], 'hilo')
        self.assertTrue(resuelto['datos']['resuelta'])
        await jefe.desconectar()


class FondoActualizadoPorSocketTests(SocketBaseTests):
    """Lista y detalle no consultan: cada cambio del fondo avisa a quien lo ve."""

    async def _fondos_actualizados(self, cliente):
        return [m['fondo'] for m in await self._pendientes(cliente) if m.get('tipo') == 'fondo_actualizado']

    async def test_un_cambio_de_estado_llega_a_quien_ve_el_fondo(self):
        from asgiref.sync import sync_to_async

        def jefe_de_otra_carrera():
            return self.crear_usuario('jefe_otro_fa', 'jefe_estudios', carrera=self.otra_carrera, is_staff=True, ci='JOF')
        ajeno = await sync_to_async(jefe_de_otra_carrera)()
        await sync_to_async(self._estado)('presentado_director')
        clientes = await self._conectar_todos()
        cliente_ajeno = ClienteWebSocket(_aplicacion(), RUTA)
        self.assertTrue(await cliente_ajeno.conectar())
        await cliente_ajeno.enviar({'tipo': 'auth', 'token': str(AccessToken.for_user(ajeno)), 'asignacion': None})
        self.assertEqual(await cliente_ajeno.recibir(), {'tipo': 'listo'})

        await sync_to_async(self._accion)(self.director, 'aprobar')

        for usuario in (self.director, self.jefe, self.usuario_docente, self.instituto):
            with self.subTest(usuario=usuario.username):
                self.assertIn(self.fondo.pk, await self._fondos_actualizados(clientes[usuario.username]))
                await clientes[usuario.username].desconectar()
        self.assertEqual(await self._fondos_actualizados(cliente_ajeno), [])
        await cliente_ajeno.desconectar()

    async def test_el_director_no_se_entera_de_un_borrador_ajeno(self):
        from asgiref.sync import sync_to_async
        from fondos.models import CargaHoraria
        clientes = await self._conectar_todos()

        def cargar_horas():
            CargaHoraria.objects.create(
                fondo=self.fondo, docente=self.docente, categoria='investigacion',
                tipo_actividad='participacion_iic_cis', titulo_actividad='Ítem', horas=10,
            )
        await sync_to_async(cargar_horas)()

        self.assertEqual(await self._fondos_actualizados(clientes[self.director.username]), [])
        for usuario in (self.jefe, self.usuario_docente, self.instituto):
            self.assertIn(self.fondo.pk, await self._fondos_actualizados(clientes[usuario.username]))
        for cliente in clientes.values():
            await cliente.desconectar()
