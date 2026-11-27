"""Flujo del fondo según el reglamento (RR 14-A/2017):

- Art. 18: aprobado, el fondo se ejecuta en su gestión: aprobar lo deja en ejecución.
- Archivar también en ejecución (el docente deja la carrera a mitad de la gestión).
- Art. 28: el informe se presenta a la finalización de la gestión; después queda
  registrado "fuera de plazo" (sin bloquear).
- Art. 8: sin Director activo en la carrera, el fondo presentado espera su revisión.
"""
from datetime import date
from unittest import mock

from rest_framework import status

from fondos.models import AsignacionCarrera, CalendarioAcademico, CargaHoraria, FondoTiempo, Materia, PerfilUsuario
from .tests_usuarios_auditoria import UsuariosBaseTestCase
from .utilidades import forzar_campos

INFORME = {'seccion_academica': '<p>Dicté mis materias.</p>', 'conclusiones_generales': '<p>Cumplí.</p>'}


class BaseFlujo(UsuariosBaseTestCase):
    """Director, Jefe y docente dueño de un fondo 2026 con dos calendarios."""

    def setUp(self):
        super().setUp()
        self.director = self.crear_usuario('director_flujo', 'director', carrera=self.carrera)
        self.jefe = self.crear_usuario('jefe_flujo', 'jefe_estudios', carrera=self.carrera)
        self.dueno = self.crear_usuario('docente_flujo', 'docente', carrera=self.carrera)
        docente = self.crear_docente('FLUJO', usuario=self.dueno)
        PerfilUsuario.objects.filter(user=self.dueno).update(docente=docente)
        AsignacionCarrera.objects.filter(user=self.dueno).update(docente=docente)
        for periodo, inicio, fin in (('1', date(2026, 2, 1), date(2026, 6, 30)), ('2', date(2026, 8, 1), date(2026, 12, 15))):
            CalendarioAcademico.objects.create(
                carrera=self.carrera, gestion=2026, periodo=periodo, dias_feriados_gestion=3,
                fecha_inicio=inicio, fecha_fin=fin,
                fecha_inicio_presentacion_proyectos=inicio, fecha_limite_presentacion_proyectos=fin,
            )
        self.fondo = FondoTiempo.objects.create(docente=docente, carrera=self.carrera, gestion=2026)

    def _estado(self, estado):
        forzar_campos(FondoTiempo.objects.filter(pk=self.fondo.pk), estado=estado)

    def _presentar_informe(self, hoy):
        self._estado('en_ejecucion')
        self.client.force_authenticate(self.dueno)
        with mock.patch('django.utils.timezone.localdate', return_value=hoy):
            response = self.client.post(f'/api/fondos-tiempo/{self.fondo.pk}/presentar/', INFORME, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.fondo.refresh_from_db()


class FlujoDelReglamentoTests(BaseFlujo):
    # --- Art. 18: aprobar deja el fondo en ejecución -------------------------------------

    def test_aprobar_deja_el_fondo_en_ejecucion_con_la_aprobacion_en_el_historial(self):
        self._estado('presentado_director')
        self.client.force_authenticate(self.director)

        response = self.client.post(f'/api/fondos-tiempo/{self.fondo.pk}/aprobar/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.fondo.refresh_from_db()
        self.assertEqual(self.fondo.estado, 'en_ejecucion')
        self.assertEqual(self.fondo.aprobado_por, self.director)
        self.assertIsNotNone(self.fondo.fecha_aprobacion)
        self.assertIsNotNone(self.fondo.fecha_inicio_ejecucion)
        registro = self.fondo.historial.get(tipo_cambio='aprobacion')
        self.assertEqual((registro.estado_anterior, registro.estado_nuevo), ('presentado_director', 'en_ejecucion'))

    # --- Archivar en ejecución -----------------------------------------------------------

    def test_se_archiva_en_ejecucion_pero_no_con_el_informe_presentado(self):
        self.client.force_authenticate(self.director)
        self._estado('informe_presentado')
        no = self.client.delete(f'/api/fondos-tiempo/{self.fondo.pk}/')
        self.assertEqual(no.status_code, status.HTTP_400_BAD_REQUEST, no.data)

        self._estado('en_ejecucion')
        si = self.client.delete(f'/api/fondos-tiempo/{self.fondo.pk}/')
        self.assertEqual(si.status_code, status.HTTP_200_OK, si.data)
        self.fondo.refresh_from_db()
        self.assertTrue(self.fondo.archivado)

    # --- Art. 28: plazo del informe ------------------------------------------------------

    def test_el_plazo_del_informe_es_el_fin_del_ultimo_calendario_de_la_gestion(self):
        calendario, limite = self.fondo.plazo_informe()
        self.assertEqual(limite, date(2026, 12, 15))
        self.assertEqual(calendario.periodo, '2')

    def test_informe_presentado_a_tiempo_no_queda_fuera_de_plazo(self):
        self._presentar_informe(date(2026, 12, 10))

        self.assertEqual(self.fondo.estado, 'informe_presentado')
        self.assertEqual(self.fondo.fuera_de_plazo, [])

    def test_informe_presentado_despues_del_fin_de_la_gestion_queda_fuera_de_plazo(self):
        self._presentar_informe(date(2026, 12, 20))

        self.assertEqual(self.fondo.estado, 'informe_presentado')
        self.assertEqual(len(self.fondo.fuera_de_plazo), 1)
        vencido = self.fondo.fuera_de_plazo[0]
        self.assertEqual(vencido['plazo'], 'informe')
        self.assertEqual(vencido['fecha_limite'], '2026-12-15')
        self.assertEqual(vencido['fecha_presentacion'], '2026-12-20')
        self.assertIn('fuera de plazo', self.fondo.historial.get(tipo_cambio='informe_presentado').descripcion)

    def test_el_reenvio_del_informe_no_registra_el_plazo_dos_veces(self):
        self._presentar_informe(date(2026, 12, 20))
        self._presentar_informe(date(2026, 12, 28))

        self.assertEqual([v['plazo'] for v in self.fondo.fuera_de_plazo], ['informe'])

    # --- Art. 8: carrera sin Director ----------------------------------------------------

    def test_el_fondo_presentado_sin_director_en_la_carrera_queda_marcado(self):
        self._estado('presentado_director')
        self.client.force_authenticate(self.jefe)

        def sin_director():
            response = self.client.get('/api/fondos-tiempo/')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            filas = response.data['results'] if isinstance(response.data, dict) else response.data
            return next(f for f in filas if f['id'] == self.fondo.pk)['sin_director']

        self.assertFalse(sin_director())
        AsignacionCarrera.objects.filter(user=self.director, rol='director').update(activo=False)
        self.assertTrue(sin_director())


class QuienElaboraElFondoTests(BaseFlujo):
    """Fondos e informes reales de 2024 y plantilla general de 2023: el docente elabora,
    firma y presenta su fondo; el Jefe de Estudios asigna las materias (Arts. 9, 14 y 18)."""

    ITEM = {'categoria': 'investigacion', 'tipo_actividad': 'participacion_iic_cis',
            'titulo_actividad': 'Participación en el instituto', 'horas': 10, 'gestion': 2026}

    def _item(self, usuario):
        self.client.force_authenticate(usuario)
        return self.client.post('/api/cargas-horarias/', {**self.ITEM, 'docente': self.fondo.docente_id}, format='json')

    def test_el_docente_registra_los_items_de_su_fondo_y_el_jefe_no(self):
        jefe = self._item(self.jefe)
        self.assertEqual(jefe.status_code, status.HTTP_403_FORBIDDEN, jefe.data)

        docente = self._item(self.dueno)
        self.assertEqual(docente.status_code, status.HTTP_201_CREATED, docente.data)
        self.assertTrue(self.fondo.cargas.filter(tipo_actividad='participacion_iic_cis').exists())

    def test_el_docente_presenta_su_fondo_y_el_jefe_no(self):
        url = f'/api/fondos-tiempo/{self.fondo.pk}/presentar-a-director/'
        self.client.force_authenticate(self.jefe)
        self.assertEqual(self.client.patch(url).status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.dueno)
        response = self.client.patch(url)
        # Pasa el permiso: falla solo por los requisitos del fondo (unidades vacías).
        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN, response.data)
        self.assertIn('La suma de las unidades', str(response.data))

    def test_el_docente_devuelve_a_borrador_su_fondo_rechazado(self):
        self._estado('rechazado')
        url = f'/api/fondos-tiempo/{self.fondo.pk}/volver-a-borrador/'
        self.client.force_authenticate(self.jefe)
        self.assertEqual(self.client.post(url).status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(self.dueno)
        self.assertEqual(self.client.post(url).status_code, status.HTTP_200_OK)
        self.fondo.refresh_from_db()
        self.assertEqual(self.fondo.estado, 'borrador')

    def test_el_detalle_dice_quien_elabora_y_quien_asigna_materias(self):
        for usuario, editar, materias in ((self.dueno, True, False), (self.jefe, False, True), (self.director, False, False)):
            with self.subTest(usuario=usuario.username):
                self.client.force_authenticate(usuario)
                response = self.client.get(f'/api/fondos-tiempo/{self.fondo.pk}/')
                if usuario is self.director:
                    # El Director no ve los borradores ajenos.
                    self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
                    continue
                self.assertEqual(response.status_code, status.HTTP_200_OK)
                self.assertEqual(response.data['puede_editar'], editar)
                self.assertEqual(response.data['puede_asignar_materias'], materias)

    def test_la_sub_actividad_academica_es_de_una_materia_asignada_por_el_jefe(self):
        calendario = CalendarioAcademico.objects.get(carrera=self.carrera, gestion=2026, periodo='1')
        materia = Materia.objects.create(nombre='Álgebra', sigla='ALG-FLUJO', carrera=self.carrera, semestre=1, horas_teoricas=2)
        datos = {
            'docente': self.fondo.docente_id, 'categoria': 'academica', 'tipo_actividad': 'elaboracion_examenes',
            'titulo_actividad': 'Elaboración de Exámenes', 'horas': 10, 'materia': materia.pk, 'calendario': calendario.pk,
        }
        self.client.force_authenticate(self.dueno)

        sin_asignar = self.client.post('/api/cargas-horarias/', datos, format='json')
        self.assertEqual(sin_asignar.status_code, status.HTTP_400_BAD_REQUEST, sin_asignar.data)
        self.assertIn('materia', sin_asignar.data)

        # El Jefe le asignó la materia (clases en aula) en ese calendario.
        CargaHoraria.objects.bulk_create([CargaHoraria(
            docente_id=self.fondo.docente_id, fondo=self.fondo, categoria='academica', tipo_actividad='clases_aula',
            materia=materia, calendario=calendario, horas=80, titulo_actividad='Álgebra', creado_por=self.jefe,
        )])
        asignada = self.client.post('/api/cargas-horarias/', datos, format='json')
        self.assertEqual(asignada.status_code, status.HTTP_201_CREATED, asignada.data)
