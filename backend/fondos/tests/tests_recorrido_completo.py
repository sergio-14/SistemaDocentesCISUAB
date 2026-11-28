"""Recorrido completo del fondo por la API, paso a paso y con el rol de cada usuario, como en
los documentos reales de la carrera: el Jefe crea el fondo y asigna la materia; el docente
completa su fondo, sube el programa analítico y lo presenta; el Director lo observa y lo
aprueba; el docente redacta y presenta su informe; el Director pide correcciones, lo evalúa
y finaliza; y la carrera genera sus documentos."""
from datetime import date

from rest_framework import status

from fondos.models import AsignacionCarrera, CalendarioAcademico, FondoTiempo, Materia, PerfilUsuario
from .tests_carrera_auditoria import _logo
from .tests_combinaciones import _pdf
from .tests_usuarios_auditoria import UsuariosBaseTestCase


class RecorridoCompletoTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        # Datos legales que toda carrera real tiene (la API exige el logo al crearla).
        self.carrera.resolucion_ministerial = 'Res. HCU 001/2010'
        self.carrera.fecha_resolucion = date(2010, 1, 1)
        self.carrera.logo_carrera = _logo('logo.png')
        self.carrera.save()
        self.director = self.crear_usuario('director_rec', 'director', carrera=self.carrera)
        self.jefe = self.crear_usuario('jefe_rec', 'jefe_estudios', carrera=self.carrera)
        self.usuario_docente = self.crear_usuario('docente_rec', 'docente', carrera=self.carrera)
        self.docente = self.crear_docente('REC', usuario=self.usuario_docente)
        PerfilUsuario.objects.filter(user=self.usuario_docente).update(docente=self.docente)
        AsignacionCarrera.objects.filter(user=self.usuario_docente).update(docente=self.docente)
        self.calendario = CalendarioAcademico.objects.create(
            carrera=self.carrera, gestion=2026, periodo='anual', dias_feriados_gestion=3,
            fecha_inicio=date(2026, 2, 2), fecha_fin=date(2026, 12, 11), activo=True,
            fecha_inicio_presentacion_proyectos=date(2026, 2, 2), fecha_limite_presentacion_proyectos=date(2026, 12, 11),
            fecha_limite_programas_analiticos=date(2026, 12, 11),
        )
        self.materia = Materia.objects.create(
            nombre='Álgebra I', sigla='ALG-REC', carrera=self.carrera, semestre=1, horas_teoricas=2, horas_practicas=2,
        )

    def _como(self, usuario):
        self.client.force_authenticate(usuario)

    def _paso(self, respuesta, esperado, paso):
        self.assertEqual(respuesta.status_code, esperado, f'{paso}: {getattr(respuesta, "data", respuesta)}')
        return respuesta

    def _avisos(self, usuario):
        self._como(usuario)
        return [aviso['evento'] for aviso in self.client.get('/api/fondos-tiempo/novedades/').data['avisos']]

    def test_recorrido_completo_del_fondo(self):
        # 1. Jefe: crea el fondo.
        self._como(self.jefe)
        creado = self._paso(self.client.post('/api/fondos-tiempo/', {
            'docente': self.docente.pk, 'carrera': self.carrera.pk, 'gestion': 2026,
        }, format='json'), status.HTTP_201_CREATED, '1. Jefe crea el fondo')
        fondo = FondoTiempo.objects.get(pk=creado.data['id'])
        self.assertIn('fondo_creado', self._avisos(self.usuario_docente), '1. Aviso al docente')

        # 2. Jefe: asigna la materia (clases en aula).
        self._como(self.jefe)
        self._paso(self.client.post('/api/cargas-horarias/', {
            'docente': self.docente.pk, 'categoria': 'academica', 'tipo_actividad': 'clases_aula',
            'materia': self.materia.pk, 'calendario': self.calendario.pk, 'paralelo': 'A',
            'dia_semana': 'lunes', 'hora_inicio': '08:00', 'hora_fin': '10:00', 'aula': 'A1', 'horas': 1,
        }, format='json'), status.HTTP_201_CREATED, '2. Jefe asigna la materia')

        # 3. Docente: completa su fondo hasta las horas efectivas y sube el programa analítico.
        self._como(self.usuario_docente)
        detalle = self._paso(self.client.get(f'/api/fondos-tiempo/{fondo.pk}/'), status.HTTP_200_OK, '3. Docente abre su fondo')
        self.assertTrue(detalle.data['puede_editar'], '3. El docente puede editar su fondo')
        faltan = int(round(float(detalle.data['horas_efectivas']) - float(detalle.data['total_asignado'])))
        self.assertGreater(faltan, 0, '3. Quedan horas por distribuir')
        self._paso(self.client.post('/api/cargas-horarias/', {
            'docente': self.docente.pk, 'categoria': 'academica', 'tipo_actividad': 'elaboracion_examenes',
            'titulo_actividad': 'Elaboración de Exámenes', 'horas': 20, 'materia': self.materia.pk,
            'calendario': self.calendario.pk,
        }, format='json'), status.HTTP_201_CREATED, '3. Docente registra una sub-actividad de su materia')
        self._paso(self.client.post('/api/cargas-horarias/', {
            'docente': self.docente.pk, 'categoria': 'gestion', 'tipo_actividad': 'reuniones',
            'titulo_actividad': 'Reuniones de carrera', 'horas': faltan - 20, 'gestion': 2026,
        }, format='json'), status.HTTP_201_CREATED, '3. Docente completa sus horas')
        self._paso(self.client.post('/api/programas-analiticos/', {
            'fondo': fondo.pk, 'materia': self.materia.pk, 'calendario': self.calendario.pk, 'archivo': _pdf('programa.pdf'),
        }, format='multipart'), status.HTTP_201_CREATED, '3. Docente sube el programa analítico')

        # 4. Docente: presenta el fondo al Director.
        self._paso(self.client.patch(f'/api/fondos-tiempo/{fondo.pk}/presentar-a-director/'), status.HTTP_200_OK,
                   '4. Docente presenta el fondo')
        self.assertIn('fondo_presentado', self._avisos(self.director), '4. Aviso al Director')

        # 5. Director: observa; el docente corrige y vuelve a presentar.
        self._como(self.director)
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/observar/', {
            'accion': 'observar', 'observacion': 'Detalle mejor las reuniones de carrera.',
        }, format='json'), status.HTTP_200_OK, '5. Director observa')
        self.assertIn('fondo_observado', self._avisos(self.usuario_docente), '5. Aviso al docente')
        self._como(self.usuario_docente)
        self._paso(self.client.patch(f'/api/fondos-tiempo/{fondo.pk}/presentar-a-director/'), status.HTTP_200_OK,
                   '5. Docente vuelve a presentar')

        # 6. Director: aprueba (queda en ejecución).
        self._como(self.director)
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/aprobar/', {}, format='json'), status.HTTP_200_OK,
                   '6. Director aprueba')
        fondo.refresh_from_db()
        self.assertEqual(fondo.estado, 'en_ejecucion', '6. Queda en ejecución')

        # 7. Docente: guarda y presenta su informe.
        informe = {'seccion_academica': '<p>Dicté Álgebra I.</p>', 'conclusiones_generales': '<p>Cumplí.</p>'}
        self._como(self.usuario_docente)
        self._paso(self.client.patch(f'/api/fondos-tiempo/{fondo.pk}/guardar-informe-borrador/', informe, format='json'),
                   status.HTTP_200_OK, '7. Docente guarda el borrador del informe')
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/presentar/', informe, format='json'),
                   status.HTTP_200_OK, '7. Docente presenta el informe')

        # 8. Director: pide correcciones; el docente corrige y vuelve a presentar.
        self._como(self.director)
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/observar-informe/', {
            'comentario': 'Agregue los resultados de los estudiantes.',
        }, format='json'), status.HTTP_200_OK, '8. Director pide correcciones al informe')
        self._como(self.usuario_docente)
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/presentar/', {
            **informe, 'seccion_academica': '<p>Dicté Álgebra I: 30 aprobados.</p>',
        }, format='json'), status.HTTP_200_OK, '8. Docente vuelve a presentar el informe')

        # 9. Director: evalúa y finaliza.
        self._como(self.director)
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/evaluar-informe/', {
            'cumplimiento': 'cumplido', 'evaluacion_director': 'Buen trabajo.',
        }, format='json'), status.HTTP_200_OK, '9. Director evalúa')
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/finalizar/', {}, format='json'),
                   status.HTTP_200_OK, '9. Director finaliza')
        fondo.refresh_from_db()
        self.assertEqual(fondo.estado, 'finalizado')
        self.assertIn('fondo_finalizado', self._avisos(self.usuario_docente), '9. Aviso al docente')

        # 10. Documentos: fondo, informe e informe de gestión de la carrera.
        for usuario, url, paso in (
            (self.usuario_docente, f'/api/fondos-tiempo/{fondo.pk}/pdf-oficial/', '10. Fondo en PDF'),
            (self.usuario_docente, f'/api/fondos-tiempo/{fondo.pk}/pdf-informe/', '10. Informe en PDF'),
            (self.usuario_docente, f'/api/fondos-tiempo/{fondo.pk}/word-informe/', '10. Informe en Word'),
            (self.director, f'/api/carreras/{self.carrera.pk}/informe-gestion/?gestion=2026', '10. Informe de gestión'),
        ):
            self._como(usuario)
            self._paso(self.client.get(url), status.HTTP_200_OK, paso)

    # --- Recorridos alternativos ------------------------------------------------------------

    def _fondo_listo(self, elabora, docente, asignacion=None):
        """Jefe crea el fondo y asigna la materia; `elabora` completa las horas y sube el programa."""
        self._como(self.jefe)
        fondo = FondoTiempo.objects.get(pk=self._paso(self.client.post('/api/fondos-tiempo/', {
            'docente': docente.pk, 'carrera': self.carrera.pk, 'gestion': 2026,
        }, format='json'), status.HTTP_201_CREATED, 'Jefe crea el fondo').data['id'])
        self._paso(self.client.post('/api/cargas-horarias/', {
            'docente': docente.pk, 'categoria': 'academica', 'tipo_actividad': 'clases_aula', 'horas': 1,
            'materia': self.materia.pk, 'calendario': self.calendario.pk, 'paralelo': 'A',
            'dia_semana': 'martes', 'hora_inicio': '08:00', 'hora_fin': '10:00', 'aula': 'A2',
        }, format='json'), status.HTTP_201_CREATED, 'Jefe asigna la materia')
        cabeceras = {'HTTP_X_ACTIVE_ASSIGNMENT': str(asignacion.pk)} if asignacion else {}
        self._como(elabora)
        detalle = self.client.get(f'/api/fondos-tiempo/{fondo.pk}/', **cabeceras).data
        faltan = int(round(float(detalle['horas_efectivas']) - float(detalle['total_asignado'])))
        self._paso(self.client.post('/api/cargas-horarias/', {
            'docente': docente.pk, 'categoria': 'gestion', 'tipo_actividad': 'reuniones',
            'titulo_actividad': 'Reuniones', 'horas': faltan, 'gestion': 2026,
        }, format='json', **cabeceras), status.HTTP_201_CREATED, 'Completa las horas')
        self._paso(self.client.post('/api/programas-analiticos/', {
            'fondo': fondo.pk, 'materia': self.materia.pk, 'calendario': self.calendario.pk, 'archivo': _pdf('p.pdf'),
        }, format='multipart', **cabeceras), status.HTTP_201_CREATED, 'Sube el programa analitico')
        self._paso(self.client.patch(f'/api/fondos-tiempo/{fondo.pk}/presentar-a-director/', **cabeceras),
                   status.HTTP_200_OK, 'Presenta el fondo')
        return fondo, cabeceras

    def test_recorrido_del_fondo_del_director(self):
        como_docente = AsignacionCarrera.objects.create(user=self.director, carrera=self.carrera, rol='docente')
        docente_director = self.crear_docente('DIRREC', usuario=self.director)
        AsignacionCarrera.objects.filter(pk=como_docente.pk).update(docente=docente_director)
        PerfilUsuario.objects.filter(user=self.director).update(docente=docente_director)
        fondo, cabeceras = self._fondo_listo(self.director, docente_director, como_docente)

        self._como(self.superuser)
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/aprobar/', {'documento_decanatura': _pdf()},
                                    format='multipart'), status.HTTP_200_OK, 'Superusuario aprueba con la Decanatura')
        self._como(self.director)
        informe = {'seccion_academica': '<p>Dicte.</p>', 'conclusiones_generales': '<p>Cumpli.</p>'}
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/presentar/', informe, format='json', **cabeceras),
                   status.HTTP_200_OK, 'El Director, como docente, presenta su informe')
        self._como(self.superuser)
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/evaluar-informe/', {'cumplimiento': 'cumplido'},
                                    format='json'), status.HTTP_200_OK, 'Superusuario evalua')
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/finalizar/', {'documento_decanatura': _pdf()},
                                    format='multipart'), status.HTTP_200_OK, 'Superusuario finaliza con la Decanatura')

    def test_recorrido_del_fondo_rechazado(self):
        fondo, _ = self._fondo_listo(self.usuario_docente, self.docente)
        self._como(self.director)
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/observar/', {
            'accion': 'rechazar', 'observacion': 'No corresponde a la gestion.',
        }, format='json'), status.HTTP_200_OK, 'Director rechaza')
        self._como(self.usuario_docente)
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/volver-a-borrador/'), status.HTTP_200_OK,
                   'Docente lo devuelve a borrador')
        self._paso(self.client.patch(f'/api/fondos-tiempo/{fondo.pk}/presentar-a-director/'), status.HTTP_200_OK,
                   'Docente lo vuelve a presentar')

    def test_recorrido_del_docente_con_acceso_pausado(self):
        # Como en el sistema: pausar el acceso también deja inactiva la ficha del docente.
        self._como(self.superuser)
        self._paso(self.client.post(f'/api/usuarios/{self.usuario_docente.pk}/toggle_activo/'), status.HTTP_200_OK,
                   'Superusuario pausa el acceso del docente')
        self.docente.refresh_from_db()
        self.assertFalse(self.docente.activo)
        fondo, _ = self._fondo_listo(self.jefe, self.docente)

        self._como(self.director)
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/aprobar/', {}, format='json'), status.HTTP_200_OK,
                   'Director aprueba')
        self._como(self.jefe)
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/presentar/', {
            'seccion_academica': '<p>Informe entregado en papel.</p>', 'conclusiones_generales': '<p>Cumplio.</p>',
        }, format='json'), status.HTTP_200_OK, 'Jefe registra el informe en papel')
        self._como(self.director)
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/evaluar-informe/', {'cumplimiento': 'parcial'},
                                    format='json'), status.HTTP_200_OK, 'Director evalua')
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/finalizar/', {}, format='json'),
                   status.HTTP_200_OK, 'Director finaliza')

    def test_recorrido_sin_informe_al_terminar_el_periodo(self):
        from unittest import mock
        fondo, _ = self._fondo_listo(self.usuario_docente, self.docente)
        self._como(self.director)
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/aprobar/', {}, format='json'), status.HTTP_200_OK,
                   'Director aprueba')
        with mock.patch('django.utils.timezone.localdate', return_value=date(2026, 12, 12)):
            self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/calificar-sin-informe/'), status.HTTP_200_OK,
                       'Director califica Incumplido sin informe')
        self._paso(self.client.post(f'/api/fondos-tiempo/{fondo.pk}/finalizar/', {}, format='json'),
                   status.HTTP_200_OK, 'Director finaliza')
        self._paso(self.client.get(f'/api/carreras/{self.carrera.pk}/informe-gestion/?gestion=2026'), status.HTTP_200_OK,
                   'Informe de gestion con el Incumplido')
