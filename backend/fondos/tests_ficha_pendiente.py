"""Usuario con rol docente sin ficha de docente.

Nunca se desactiva por eso: queda activo, sus cargos (director, jefe, instituto)
funcionan normal y solo su parte docente queda "pendiente de ficha" (sin fondo de
tiempo ni carga horaria hasta vincularle la ficha). La API avisa con
ficha_docente_pendiente.
"""
from datetime import date

from django.contrib.auth.models import User
from rest_framework import status

from .models import AsignacionCarrera, CalendarioAcademico, Docente, FondoTiempo
from .tests_usuarios_auditoria import UsuariosBaseTestCase


class FichaDocentePendienteTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.superuser)
        CalendarioAcademico.objects.create(
            carrera=self.carrera, gestion=2026, periodo='1', activo=True,
            fecha_inicio=date(2026, 2, 1), fecha_fin=date(2026, 6, 30),
            fecha_inicio_presentacion_proyectos=date(2026, 2, 1),
            fecha_limite_presentacion_proyectos=date(2026, 2, 28),
        )
        self.jefe = self.crear_usuario('jefe_generador', 'jefe_estudios', carrera=self.carrera, is_staff=True, ci='GEN')

    def _crear(self, username, rol, ci, asignaciones=(), carrera=None):
        response = self.client.post(
            '/api/usuarios/',
            self.datos_usuario(username, rol, carrera or self.carrera, ci, asignaciones=list(asignaciones)),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response, User.objects.get(username=username)

    def _generar_fondos(self):
        self.client.force_authenticate(self.jefe)
        response = self.client.post('/api/fondos-tiempo/generar-masivo/', {}, format='json')
        self.client.force_authenticate(self.superuser)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        return response

    def test_jefe_mas_docente_sin_ficha_queda_activo_con_su_cargo(self):
        # En la otra carrera: en la principal ya hay un Jefe (el que genera fondos).
        response, usuario = self._crear(
            'jefe_docente', 'jefe_estudios', 'FP-1', [{'rol': 'docente', 'carrera': self.otra_carrera.pk}],
            carrera=self.otra_carrera,
        )

        self.assertTrue(response.data['ficha_docente_pendiente'])
        # Ni al crearlo ni al listar usuarios se desactiva (antes lo hacía la sincronización).
        self.client.get('/api/usuarios/')
        usuario.refresh_from_db()
        self.assertTrue(usuario.is_active)
        self.assertTrue(usuario.is_staff)
        # Su cargo sigue activo: no se disparó la desactivación en cascada.
        self.assertTrue(AsignacionCarrera.objects.filter(
            user=usuario, rol='jefe_estudios', carrera=self.otra_carrera, activo=True,
        ).exists())
        self.assertTrue(AsignacionCarrera.objects.filter(user=usuario, rol='docente', activo=True).exists())

    def test_docente_solo_sin_ficha_queda_activo_pero_sin_fondo(self):
        response, usuario = self._crear('docente_sin_ficha', 'docente', 'FP-2')

        self.assertTrue(response.data['ficha_docente_pendiente'])
        self.client.get('/api/usuarios/')
        usuario.refresh_from_db()
        self.assertTrue(usuario.is_active)

        self._generar_fondos()

        self.assertFalse(Docente.objects.filter(user=usuario).exists())
        self.assertFalse(FondoTiempo.objects.filter(docente__user=usuario).exists())

    def test_al_vincular_la_ficha_ya_puede_tener_fondo(self):
        _, usuario = self._crear('docente_con_ficha', 'docente', 'FP-3')

        response = self.client.post('/api/docentes/', {
            'user': usuario.pk, 'carrera': self.carrera.pk, 'categoria': 'catedratico', 'dedicacion': 'horario_40',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        detalle = self.client.get(f'/api/usuarios/{usuario.pk}/')
        self.assertFalse(detalle.data['ficha_docente_pendiente'])

        self._generar_fondos()

        self.assertTrue(FondoTiempo.objects.filter(docente__user=usuario, carrera=self.carrera).exists())

    def test_se_puede_reactivar_sin_ficha(self):
        _, usuario = self._crear('reactivable', 'docente', 'FP-4')

        desactivar = self.client.post(f'/api/usuarios/{usuario.pk}/toggle_activo/')
        reactivar = self.client.post(f'/api/usuarios/{usuario.pk}/toggle_activo/')

        self.assertEqual(desactivar.status_code, status.HTTP_200_OK, desactivar.data)
        self.assertEqual(reactivar.status_code, status.HTTP_200_OK, reactivar.data)
        usuario.refresh_from_db()
        self.assertTrue(usuario.is_active)

    def test_sin_rol_docente_no_hay_aviso(self):
        response, _ = self._crear('director_sin_docencia', 'director', 'FP-5')

        self.assertFalse(response.data['ficha_docente_pendiente'])
