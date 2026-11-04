"""El Instituto (IIISyP), como unidad de investigación y desarrollo tecnológico, consulta los
reportes de su carrera: fondos vigentes y archivados, comparativas e informe de gestión.
Solo los consulta: no restaura ni archiva, y no ve los de otra carrera."""
from rest_framework import status

from fondos.models import AsignacionCarrera, FondoTiempo
from fondos.tests.tests_usuarios_auditoria import UsuariosBaseTestCase
from fondos.tests.utilidades import forzar_campos


class ReportesDelInstitutoTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.instituto = self.crear_usuario('inst_sis', 'iiisyp', carrera=self.carrera)
        self.instituto_civil = self.crear_usuario('inst_civ', 'iiisyp', carrera=self.otra_carrera)
        self.usuario_docente = self.crear_usuario('docente_sis', 'docente', carrera=self.carrera, ci='A1')
        self.docente = self.crear_docente('A1', usuario=self.usuario_docente, dedicacion='tiempo_completo')
        self.archivado = FondoTiempo.objects.create(docente=self.docente, carrera=self.carrera, gestion=2025)
        forzar_campos(FondoTiempo.objects.filter(pk=self.archivado.pk), estado='finalizado', archivado=True)
        self.vigente = FondoTiempo.objects.create(docente=self.docente, carrera=self.carrera, gestion=2026)
        forzar_campos(FondoTiempo.objects.filter(pk=self.vigente.pk), estado='finalizado')

    def como(self, usuario):
        self.client.force_authenticate(usuario)
        return self.client

    def comparar(self, usuario, **cabeceras):
        return self.como(usuario).get(
            f'/api/fondos-tiempo/comparar/?docente={self.docente.pk}&gestion1=2025&gestion2=2026', **cabeceras,
        )

    def informe_gestion(self, usuario, carrera=None):
        carrera = carrera or self.carrera
        return self.como(usuario).get(f'/api/carreras/{carrera.pk}/informe-gestion/?gestion=2026')

    def test_consulta_los_archivados_de_su_carrera(self):
        respuesta = self.como(self.instituto).get('/api/fondos-tiempo/archivados/')

        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual([fondo['id'] for fondo in respuesta.data], [self.archivado.pk])

    def test_abre_el_fondo_archivado_y_su_pdf(self):
        cliente = self.como(self.instituto)

        self.assertEqual(cliente.get(f'/api/fondos-tiempo/{self.archivado.pk}/').status_code, status.HTTP_200_OK)
        # El fondo de la prueba está vacío: el PDF responde 400 por sus datos, no por permisos.
        self.assertNotIn(
            cliente.get(f'/api/fondos-tiempo/{self.archivado.pk}/pdf-oficial/').status_code,
            [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND],
        )

    def test_compara_fondos_de_su_carrera(self):
        respuesta = self.comparar(self.instituto)

        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual([fondo['id'] for fondo in respuesta.data], [self.archivado.pk, self.vigente.pk])
        self.assertEqual([fondo['archivado'] for fondo in respuesta.data], [True, False])

    def test_en_una_gestion_rehecha_compara_el_fondo_vigente(self):
        rehecho = FondoTiempo.objects.create(docente=self.docente, carrera=self.carrera, gestion=2025)

        respuesta = self.comparar(self.instituto)

        self.assertEqual([fondo['id'] for fondo in respuesta.data], [rehecho.pk, self.vigente.pk])

    def test_descarga_el_informe_de_gestion_de_su_carrera(self):
        respuesta = self.informe_gestion(self.instituto)

        self.assertEqual(respuesta.status_code, status.HTTP_200_OK)
        self.assertEqual(respuesta['Content-Type'], 'application/pdf')

    def test_no_ve_nada_de_otra_carrera(self):
        self.assertEqual(self.como(self.instituto_civil).get('/api/fondos-tiempo/archivados/').data, [])
        self.assertEqual(self.comparar(self.instituto_civil).data, [])
        self.assertIn(
            self.informe_gestion(self.instituto, carrera=self.otra_carrera).status_code,
            [status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND],
        )

    def test_no_restaura_ni_archiva(self):
        cliente = self.como(self.instituto)

        restaurar = cliente.post(f'/api/fondos-tiempo/{self.archivado.pk}/restaurar/')
        archivar = cliente.delete(f'/api/fondos-tiempo/{self.vigente.pk}/')

        self.assertEqual(restaurar.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(archivar.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(FondoTiempo.objects.get(pk=self.archivado.pk).archivado)
        self.assertFalse(FondoTiempo.objects.get(pk=self.vigente.pk).archivado)

    def test_el_docente_sigue_sin_acceso(self):
        self.assertEqual(
            self.como(self.usuario_docente).get('/api/fondos-tiempo/archivados/').status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(self.comparar(self.usuario_docente).status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.informe_gestion(self.usuario_docente).status_code, status.HTTP_403_FORBIDDEN)

    def test_decide_el_rol_activo_y_no_el_rol_base(self):
        # Instituto que también es docente: con el rol Docente activo no consulta los reportes.
        asignacion_instituto = AsignacionCarrera.objects.get(user=self.instituto)
        asignacion_docente = AsignacionCarrera.objects.create(
            user=self.instituto, carrera=self.carrera, rol='docente', docente=self.crear_docente('I1'),
        )

        self.assertEqual(
            self.comparar(self.instituto, HTTP_X_ACTIVE_ASSIGNMENT=str(asignacion_docente.pk)).status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.comparar(self.instituto, HTTP_X_ACTIVE_ASSIGNMENT=str(asignacion_instituto.pk)).status_code,
            status.HTTP_200_OK,
        )
