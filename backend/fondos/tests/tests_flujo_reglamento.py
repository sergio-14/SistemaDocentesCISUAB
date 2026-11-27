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

    def test_el_plazo_del_informe_es_el_fin_de_la_gestion(self):
        calendario, limite = self.fondo.plazo_informe()
        self.assertEqual(limite, date(2026, 12, 31))
        self.assertEqual(calendario.periodo, '2')

    def test_informe_presentado_a_tiempo_no_queda_fuera_de_plazo(self):
        self._presentar_informe(date(2026, 12, 20))

        self.assertEqual(self.fondo.estado, 'informe_presentado')
        self.assertEqual(self.fondo.fuera_de_plazo, [])

    def test_informe_presentado_despues_del_fin_de_la_gestion_queda_fuera_de_plazo(self):
        self._presentar_informe(date(2027, 1, 5))

        self.assertEqual(self.fondo.estado, 'informe_presentado')
        self.assertEqual(len(self.fondo.fuera_de_plazo), 1)
        vencido = self.fondo.fuera_de_plazo[0]
        self.assertEqual(vencido['plazo'], 'informe')
        self.assertEqual(vencido['fecha_limite'], '2026-12-31')
        self.assertEqual(vencido['fecha_presentacion'], '2027-01-05')
        self.assertIn('fuera de plazo', self.fondo.historial.get(tipo_cambio='informe_presentado').descripcion)

    def test_el_reenvio_del_informe_no_registra_el_plazo_dos_veces(self):
        self._presentar_informe(date(2027, 1, 5))
        self._presentar_informe(date(2027, 1, 10))

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


class FaltantesDeLosFlujosTests(BaseFlujo):
    """El docente se entera de su fondo y de su plazo; el Jefe ve sus pendientes reales."""

    def test_el_docente_recibe_el_aviso_de_su_fondo_creado(self):
        from fondos.avisos import avisos_para_usuario, clave_rol
        from fondos.models import HistorialFondo
        HistorialFondo.objects.create(
            fondo_tiempo=self.fondo, usuario=self.jefe, tipo_cambio='creacion', descripcion='Fondo creado',
        )
        perfil = self.dueno.perfil
        avisos = avisos_para_usuario(self.dueno, perfil, FondoTiempo.objects.filter(pk=self.fondo.pk), 'base')
        self.assertEqual([a['evento'] for a in avisos], ['fondo_creado'])
        self.assertEqual(avisos[0]['accion'], 'Completar')

        # Una vez presentado, el aviso de creación ya no vale.
        HistorialFondo.objects.create(
            fondo_tiempo=self.fondo, usuario=self.dueno, tipo_cambio='presentacion', descripcion='Presentado',
            estado_anterior='borrador', estado_nuevo='presentado_director',
        )
        self.assertEqual(avisos_para_usuario(self.dueno, perfil, FondoTiempo.objects.filter(pk=self.fondo.pk), 'base'), [])

    def test_la_lista_marca_fondos_sin_materias_y_el_plazo_del_informe(self):
        self.client.force_authenticate(self.jefe)
        fila = self._fila()
        self.assertTrue(fila['sin_materias'])
        self.assertIsNone(fila['plazo_informe'])

        self._estado('en_ejecucion')
        fila = self._fila()
        self.assertFalse(fila['sin_materias'])
        self.assertEqual(fila['plazo_informe'], '2026-12-31')

    def _fila(self):
        response = self.client.get('/api/fondos-tiempo/')
        filas = response.data['results'] if isinstance(response.data, dict) else response.data
        return next(f for f in filas if f['id'] == self.fondo.pk)

    def test_el_jefe_elabora_y_presenta_el_fondo_del_docente_sin_cuenta(self):
        sin_cuenta = self.crear_docente('SINCUENTA')
        fondo = FondoTiempo.objects.create(docente=sin_cuenta, carrera=self.carrera, gestion=2026)
        self.client.force_authenticate(self.jefe)

        item = self.client.post('/api/cargas-horarias/', {
            'docente': sin_cuenta.pk, 'categoria': 'investigacion', 'tipo_actividad': 'participacion_iic_cis',
            'titulo_actividad': 'Instituto', 'horas': 10, 'gestion': 2026,
        }, format='json')
        self.assertEqual(item.status_code, status.HTTP_201_CREATED, item.data)
        presentar = self.client.patch(f'/api/fondos-tiempo/{fondo.pk}/presentar-a-director/')
        self.assertNotEqual(presentar.status_code, status.HTTP_403_FORBIDDEN, presentar.data)
        self.assertTrue(self.client.get(f'/api/fondos-tiempo/{fondo.pk}/').data['jefatura_trabaja_el_fondo'])

    def test_el_director_califica_incumplido_sin_informe_vencido_el_plazo(self):
        self._estado('en_ejecucion')
        url = f'/api/fondos-tiempo/{self.fondo.pk}/calificar-sin-informe/'
        self.client.force_authenticate(self.director)
        with mock.patch('django.utils.timezone.localdate', return_value=date(2026, 12, 10)):
            self.assertEqual(self.client.post(url).status_code, status.HTTP_400_BAD_REQUEST)
        self.client.force_authenticate(self.dueno)
        with mock.patch('django.utils.timezone.localdate', return_value=date(2027, 1, 5)):
            self.assertIn(self.client.post(url).status_code, (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND))

        self.client.force_authenticate(self.director)
        with mock.patch('django.utils.timezone.localdate', return_value=date(2027, 1, 5)):
            response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.fondo.refresh_from_db()
        self.assertEqual(self.fondo.estado, 'informe_evaluado')
        informe = self.fondo.informes.get(tipo='parcial')
        self.assertEqual(informe.cumplimiento, 'incumplido')
        self.assertIn('31/12/2026', informe.evaluacion_director)

    def test_el_superusuario_ve_las_carreras_sin_director(self):
        self.client.force_authenticate(self.superuser)
        nombres = lambda: [c['nombre'] for c in self.client.get('/api/mi-cuenta/').data['superusuario']['carreras_sin_director']]
        self.assertNotIn(self.carrera.nombre, nombres())
        AsignacionCarrera.objects.filter(user=self.director, rol='director').update(activo=False)
        self.assertIn(self.carrera.nombre, nombres())

    def test_el_docente_registra_sub_actividades_de_su_materia_en_otra_carrera(self):
        calendario_civil = CalendarioAcademico.objects.create(
            carrera=self.otra_carrera, gestion=2026, periodo='1', dias_feriados_gestion=3,
            fecha_inicio=date(2026, 2, 1), fecha_fin=date(2026, 6, 30),
            fecha_inicio_presentacion_proyectos=date(2026, 2, 1), fecha_limite_presentacion_proyectos=date(2026, 6, 30),
        )
        materia_civil = Materia.objects.create(nombre='Estática', sigla='EST-CIV', carrera=self.otra_carrera, semestre=2, horas_teoricas=2)
        # El Jefe de Civil le asignó la materia (entra al fondo del docente en Sistemas).
        CargaHoraria.objects.bulk_create([CargaHoraria(
            docente_id=self.fondo.docente_id, fondo=self.fondo, categoria='academica', tipo_actividad='clases_aula',
            materia=materia_civil, calendario=calendario_civil, horas=80, titulo_actividad='Estática', creado_por=self.jefe,
        )])
        self.client.force_authenticate(self.dueno)

        calendarios = self.client.get(f'/api/fondos-tiempo/{self.fondo.pk}/').data['calendarios_materias']
        civil = next(c for c in calendarios if c['id'] == calendario_civil.pk)
        self.assertIn('Civil', civil['nombre'])

        response = self.client.post('/api/cargas-horarias/', {
            'docente': self.fondo.docente_id, 'categoria': 'academica', 'tipo_actividad': 'elaboracion_examenes',
            'titulo_actividad': 'Elaboración de Exámenes', 'horas': 10, 'materia': materia_civil.pk, 'calendario': calendario_civil.pk,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_el_informe_trae_la_planificacion_como_parte_i(self):
        import io
        from docx import Document
        self._estado('en_ejecucion')
        CargaHoraria.objects.bulk_create([CargaHoraria(
            docente_id=self.fondo.docente_id, fondo=self.fondo, categoria='investigacion',
            tipo_actividad='participacion_iic_cis', titulo_actividad='Instituto', horas=40, creado_por=self.dueno,
        )])
        self.client.force_authenticate(self.dueno)

        word = self.client.get(f'/api/fondos-tiempo/{self.fondo.pk}/word-informe/')
        self.assertEqual(word.status_code, status.HTTP_200_OK)
        documento = Document(io.BytesIO(b''.join(word.streaming_content) if word.streaming else word.content))
        textos = [p.text for p in documento.paragraphs]
        self.assertIn('PARTE I: PLANIFICACIÓN', textos)
        self.assertIn('PARTE II: EJECUCIÓN', textos)
        celdas = [celda.text for tabla in documento.tables for fila in tabla.rows for celda in fila.cells]
        self.assertIn('Investigación', celdas)
        self.assertIn('40', celdas)

        pdf = self.client.get(f'/api/fondos-tiempo/{self.fondo.pk}/pdf-informe/')
        self.assertEqual(pdf.status_code, status.HTTP_200_OK)

    def test_el_jefe_registra_el_informe_del_docente_sin_cuenta(self):
        sin_cuenta = self.crear_docente('SININFORME')
        fondo = FondoTiempo.objects.create(docente=sin_cuenta, carrera=self.carrera, gestion=2026)
        forzar_campos(FondoTiempo.objects.filter(pk=fondo.pk), estado='en_ejecucion')
        self.client.force_authenticate(self.jefe)

        self.assertTrue(self.client.get(f'/api/fondos-tiempo/{fondo.pk}/').data['puede_editar_informe'])
        response = self.client.post(f'/api/fondos-tiempo/{fondo.pk}/presentar/', INFORME, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        fondo.refresh_from_db()
        self.assertEqual(fondo.estado, 'informe_presentado')
        self.assertIn('Jefatura de Estudios registró', fondo.historial.get(tipo_cambio='informe_presentado').descripcion)

        # Con cuenta, el Jefe no redacta el informe del docente.
        self._estado('en_ejecucion')
        self.assertEqual(
            self.client.post(f'/api/fondos-tiempo/{self.fondo.pk}/presentar/', INFORME, format='json').status_code,
            status.HTTP_403_FORBIDDEN,
        )
