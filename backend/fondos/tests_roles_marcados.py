"""Un usuario tiene SOLO los roles que se marcan al crearlo.

Error encontrado a mano: al crear un Director (sin segundo rol) la respuesta de la
API lo mostraba como "Director/Docente". En la base estaba bien; la respuesta
usaba el perfil que la señal crea con rol 'docente' y que quedaba en caché.
"""
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
