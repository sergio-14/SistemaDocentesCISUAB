"""Auditoría: historial (HistoricalRecords) de usuarios, docentes y sus vínculos.

AsignacionCarrera, PerfilUsuario, Docente, DocenteCarrera y DatosLaborales guardan
cada cambio con el usuario que lo hizo (HistoryRequestMiddleware). Los cambios
masivos que antes usaban queryset.update() (sin historial) ahora pasan por
actualizar_con_historial.
"""
from datetime import date

from django.contrib.auth.models import User
from rest_framework import status

from fondos.models import AsignacionCarrera, DatosLaborales, Docente, DocenteCarrera, PerfilUsuario
from .tests_usuarios_auditoria import UsuariosBaseTestCase


class HistorialUsuariosTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.client.force_authenticate(self.superuser)

    def test_los_cinco_modelos_tienen_historial(self):
        for modelo in (AsignacionCarrera, PerfilUsuario, Docente, DocenteCarrera, DatosLaborales):
            with self.subTest(modelo=modelo.__name__):
                self.assertTrue(hasattr(modelo, 'history'))

    def test_crear_un_usuario_registra_quien_lo_hizo(self):
        response = self.client.post(
            '/api/usuarios/', self.datos_usuario('auditado', 'jefe_estudios', self.carrera, 'H-1'), format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        usuario = User.objects.get(username='auditado')

        asignacion = AsignacionCarrera.objects.get(user=usuario, rol='jefe_estudios')
        registro = asignacion.history.earliest()
        self.assertEqual(registro.history_type, '+')
        self.assertEqual(registro.history_user, self.superuser)

        perfil = PerfilUsuario.objects.get(user=usuario)
        self.assertEqual(perfil.history.latest().history_user, self.superuser)
        self.assertEqual(perfil.history.latest().rol, 'jefe_estudios')

    def test_desactivar_en_cascada_deja_historial(self):
        # Antes era un queryset.update(activo=False) y no quedaba rastro.
        usuario = self.crear_usuario('cascada', 'jefe_estudios', carrera=self.carrera, is_staff=True, ci='H-2')
        asignacion = AsignacionCarrera.objects.get(user=usuario)

        response = self.client.post(f'/api/usuarios/{usuario.pk}/toggle_activo/')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        ultimo = asignacion.history.latest()
        self.assertFalse(ultimo.activo)
        self.assertEqual(ultimo.history_type, '~')
        self.assertEqual(ultimo.history_user, self.superuser)

    def test_editar_la_ficha_de_docente_registra_el_cambio_y_su_autor(self):
        usuario = self.crear_usuario('docente_auditado', 'docente', carrera=self.carrera, ci='H-3')
        response = self.client.post('/api/docentes/', {
            'user': usuario.pk, 'carrera': self.carrera.pk, 'categoria': 'catedratico', 'dedicacion': 'horario_40', 'condicion': 'titular',
            'fecha_ingreso': '2015-01-01',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        docente = Docente.objects.get(pk=response.data['id'])

        self.assertEqual(docente.history.earliest().history_user, self.superuser)
        self.assertEqual(docente.vinculos_carrera.get().history.earliest().history_user, self.superuser)

        response = self.client.patch(f'/api/docentes/{docente.pk}/', {'fecha_ingreso': '2012-03-01'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        historial = docente.datos_laborales.history.order_by('history_date')
        self.assertEqual(historial.last().fecha_ingreso, date(2012, 3, 1))
        self.assertEqual(historial.last().history_user, self.superuser)
        # Se ve el valor anterior: la auditoría permite saber qué cambió.
        self.assertIn(date(2015, 1, 1), set(historial.values_list('fecha_ingreso', flat=True)))

    def test_la_foto_antigua_no_se_copia_al_historial(self):
        campos = {campo.name for campo in PerfilUsuario.history.model._meta.get_fields()}

        self.assertNotIn('foto_perfil_cifrada', campos)
        self.assertIn('rol', campos)
