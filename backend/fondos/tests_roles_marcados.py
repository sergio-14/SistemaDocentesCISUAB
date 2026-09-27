"""Un usuario tiene SOLO los roles que se marcan al crearlo.

Error encontrado a mano: al crear un Director (sin segundo rol) la respuesta de la
API lo mostraba como "Director/Docente". En la base estaba bien; la respuesta
usaba el perfil que la señal crea con rol 'docente' y que quedaba en caché.
"""
from unittest import mock

from django.contrib.auth.models import User
from rest_framework import status

from .models import AsignacionCarrera, Docente, DocenteCarrera, PerfilUsuario
from .tests_usuarios_auditoria import UsuariosBaseTestCase


def _roles_en_respuesta(data):
    roles = {data['perfil']['rol']} if data.get('perfil', {}).get('rol') else set()
    roles.update(item['rol'] for item in data.get('asignaciones', []) if item.get('activo', True))
    return roles


class RolesMarcadosTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.superuser)

    def test_un_director_solo_no_aparece_como_docente(self):
        response = self.client.post(
            '/api/usuarios/', self.datos_usuario('director_solo', 'director', self.carrera, 'RM-1'), format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        # Lo que devuelve la API (y muestra el frontend al crear).
        self.assertEqual(response.data['perfil']['rol'], 'director')
        self.assertEqual(_roles_en_respuesta(response.data), {'director'})
        # Lo que queda en la base.
        usuario = User.objects.get(username='director_solo')
        self.assertEqual(PerfilUsuario.objects.get(user=usuario).rol, 'director')
        self.assertEqual(
            list(AsignacionCarrera.objects.filter(user=usuario).values_list('rol', flat=True)), ['director'],
        )
        self.assertFalse(Docente.objects.filter(user=usuario).exists())
        self.assertIsNone(PerfilUsuario.objects.get(user=usuario).docente)
        self.assertFalse(DocenteCarrera.objects.filter(docente__user=usuario).exists())

    def test_cada_rol_solo_devuelve_ese_rol(self):
        for rol in ['jefe_estudios', 'iiisyp']:
            with self.subTest(rol=rol):
                carrera = self.carrera if rol == 'jefe_estudios' else self.otra_carrera
                response = self.client.post(
                    '/api/usuarios/', self.datos_usuario(f'solo_{rol}', rol, carrera, f'RM-{rol}'), format='json',
                )

                self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
                self.assertEqual(_roles_en_respuesta(response.data), {rol})

    def test_al_editar_la_respuesta_trae_el_rol_nuevo(self):
        usuario = self.crear_usuario('cambia_a_jefe', 'docente', carrera=self.carrera, ci='RM-3')

        response = self.client.patch(
            f'/api/usuarios/{usuario.pk}/',
            {'rol': 'jefe_estudios', 'carrera': self.carrera.pk, 'asignaciones': []},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(response.data['perfil']['rol'], 'jefe_estudios')
        self.assertEqual(_roles_en_respuesta(response.data), {'jefe_estudios'})


class CreacionAtomicaTests(UsuariosBaseTestCase):
    """Si la creación falla a mitad no queda nada: ni usuario ni el perfil 'docente' de la señal."""

    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.superuser)
        self.datos = self.datos_usuario('a_medias', 'director', self.carrera, 'AT-1')

    def _assert_no_quedo_nada(self):
        self.assertFalse(User.objects.filter(username='a_medias').exists())
        self.assertFalse(PerfilUsuario.objects.filter(user__username='a_medias').exists())
        self.assertFalse(PerfilUsuario.objects.filter(ci='AT-1').exists())
        self.assertFalse(AsignacionCarrera.objects.filter(user__isnull=True).exists())
        self.assertFalse(PerfilUsuario.objects.filter(user__isnull=True).exists())

    def test_falla_al_guardar_las_asignaciones(self):
        # El usuario y su perfil (de la señal) ya se crearon cuando esto falla.
        with mock.patch('fondos.serializers._guardar_asignaciones_usuario', side_effect=RuntimeError('falla')):
            with self.assertRaises(RuntimeError):
                self.client.post('/api/usuarios/', self.datos, format='json')

        self._assert_no_quedo_nada()

    def test_falla_despues_de_guardar_en_la_vista(self):
        # Falla ya fuera del serializer (la vista relee el usuario para responder).
        with mock.patch('fondos.views.UsuarioViewSet._releer_usuario', side_effect=RuntimeError('falla')):
            with self.assertRaises(RuntimeError):
                self.client.post('/api/usuarios/', self.datos, format='json')

        self._assert_no_quedo_nada()

    def test_sin_fallas_se_crea_normalmente(self):
        response = self.client.post('/api/usuarios/', self.datos, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(User.objects.filter(username='a_medias').exists())
