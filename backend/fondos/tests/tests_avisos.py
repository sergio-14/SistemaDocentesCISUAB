"""Avisos del Fondo de Tiempo (fondos/avisos.py, GET /fondos-tiempo/novedades/).

Cada fila de la tabla de avisos: el evento se provoca con la acción real de la API
(salvo presentar al Director, que exige un fondo completo: se registra como lo
hace esa acción) y se revisa qué le llega a cada rol y con qué texto.
"""
from django.test import override_settings
from rest_framework import status

from fondos.models import FondoTiempo, HistorialFondo, InformeFondo, PerfilUsuario
from .tests_combinaciones import _pdf
from .tests_usuarios_auditoria import UsuariosBaseTestCase

EVALUACION = {'cumplimiento': 'cumplido', 'evaluacion_director': 'Cumplió todas las actividades planificadas en la gestión.'}


@override_settings(MEDIA_ROOT='/tmp/test_media_avisos')
class AvisosPorRolTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.director = self.crear_usuario('director_av', 'director', carrera=self.carrera, is_staff=True, ci='DAV')
        self.jefe = self.crear_usuario('jefe_av', 'jefe_estudios', carrera=self.carrera, is_staff=True, ci='JAV')
        self.instituto = self.crear_usuario('instituto_av', 'iiisyp', carrera=self.carrera, ci='IAV')
        self.usuario_docente = self.crear_usuario('docente_av', 'docente', carrera=self.carrera, ci='CAV')
        self.docente = self.crear_docente('CAV', usuario=self.usuario_docente)
        PerfilUsuario.objects.filter(user=self.usuario_docente).update(docente=self.docente)
        self.usuario_docente = type(self.usuario_docente).objects.get(pk=self.usuario_docente.pk)
        self.fondo = FondoTiempo.objects.create(docente=self.docente, carrera=self.carrera, gestion=2026)
        self.nombre = self.docente.nombre_completo

    # --- ayudas ---
    def _estado(self, estado):
        FondoTiempo.objects.filter(pk=self.fondo.pk).update(estado=estado)

    def _accion(self, usuario, ruta, datos=None, formato='json'):
        self.client.force_authenticate(usuario)
        response = self.client.post(f'/api/fondos-tiempo/{self.fondo.pk}/{ruta}/', datos or {}, format=formato)
        self.assertEqual(response.status_code, status.HTTP_200_OK, getattr(response, 'data', None))

    def _avisos(self, usuario):
        self.client.force_authenticate(usuario)
        response = self.client.get('/api/fondos-tiempo/novedades/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        return [aviso['texto'] for aviso in response.data['avisos']]

    def _reciben(self, esperado):
        """esperado: {usuario: [textos]}; los demás roles no reciben nada."""
        todos = (self.director, self.jefe, self.usuario_docente, self.instituto)
        for usuario in todos:
            with self.subTest(usuario=usuario.username):
                self.assertEqual(self._avisos(usuario), esperado.get(usuario, []))

    # --- la tabla ---
    def test_jefe_presenta_el_fondo_avisa_al_director(self):
        self._estado('presentado_director')
        HistorialFondo.objects.create(
            fondo_tiempo=self.fondo, usuario=self.jefe, tipo_cambio='presentacion',
            descripcion='Fondo presentado por Jefatura de Estudios al Director.',
            estado_anterior='borrador', estado_nuevo='presentado_director',
        )
        self._reciben({self.director: [f'Nuevo fondo para revisar: {self.nombre} (gestión 2026).']})

    def test_director_observa_el_fondo(self):
        self._estado('presentado_director')
        self._accion(self.director, 'observar', {'accion': 'observar', 'observacion': 'Revisar la distribución de horas.'})
        self._reciben({
            self.jefe: [f'El fondo de {self.nombre} recibió observaciones.'],
            self.usuario_docente: ['Tu fondo de tiempo recibió observaciones.'],
        })

    def test_director_rechaza_el_fondo(self):
        self._estado('presentado_director')
        self._accion(self.director, 'observar', {'accion': 'rechazar', 'observacion': 'No corresponde a la gestión.'})
        self._reciben({
            self.jefe: [f'El fondo de {self.nombre} fue rechazado.'],
            self.usuario_docente: ['Tu fondo de tiempo fue rechazado.'],
        })

    def test_director_aprueba_el_fondo(self):
        self._estado('presentado_director')
        self._accion(self.director, 'aprobar')
        self._reciben({
            self.jefe: [f'El fondo de {self.nombre} fue aprobado.'],
            self.usuario_docente: ['Tu fondo de tiempo fue aprobado.'],
        })

    def test_director_inicia_la_ejecucion(self):
        self._estado('aprobado_director')
        self._accion(self.director, 'iniciar_ejecucion')
        self._reciben({
            self.jefe: [f'El fondo de {self.nombre} está en ejecución.'],
            self.usuario_docente: ['Tu fondo está en ejecución. Ya puedes redactar tu informe.'],
        })

    def test_docente_presenta_el_informe(self):
        self._estado('en_ejecucion')
        self._accion(self.usuario_docente, 'presentar', {
            'seccion_academica': '<p>Dicté mis materias.</p>', 'conclusiones_generales': '<p>Cumplí lo planificado.</p>',
        })
        self._reciben({
            self.director: [f'{self.nombre} presentó su informe para evaluar.'],
            self.jefe: [f'{self.nombre} presentó su informe.'],
        })

    def _informe_presentado(self):
        self._estado('informe_presentado')
        InformeFondo.objects.create(fondo_tiempo=self.fondo, elaborado_por=self.usuario_docente, tipo='parcial', estado='enviado')

    def test_director_solicita_correcciones_al_informe(self):
        self._informe_presentado()
        self._accion(self.director, 'observar-informe', {'comentario': 'Falta detallar la sección académica.'})
        self._reciben({
            self.usuario_docente: ['Tu informe fue observado. Revisa las correcciones y vuelve a presentarlo.'],
            self.jefe: [f'El informe de {self.nombre} fue observado.'],
        })

    def test_director_evalua_y_finaliza(self):
        self._informe_presentado()
        self._accion(self.director, 'evaluar-y-finalizar', EVALUACION)
        self._reciben({
            self.usuario_docente: ['Tu fondo fue finalizado. Cumplimiento: Cumplido.'],
            self.jefe: [f'El fondo de {self.nombre} fue finalizado.'],
        })

    # --- reglas generales ---
    def _reclamar(self, usuario, ids, asignacion=None):
        self.client.force_authenticate(usuario)
        cabeceras = {'HTTP_X_ACTIVE_ASSIGNMENT': str(asignacion)} if asignacion else {}
        response = self.client.post('/api/fondos-tiempo/novedades/vistos/', {'ids': ids}, format='json', **cabeceras)
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        return response.data['nuevos']

    def test_el_mismo_aviso_sale_una_sola_vez(self):
        # El primero que lo reclama (una pantalla, otra pestaña, el socket o la consulta)
        # lo muestra; después ya no vuelve.
        self._estado('presentado_director')
        self._accion(self.director, 'aprobar')
        self.client.force_authenticate(self.jefe)
        aviso = self.client.get('/api/fondos-tiempo/novedades/').data['avisos'][0]

        self.assertEqual(self._reclamar(self.jefe, [aviso['id']]), [aviso['id']])
        self.assertEqual(self._reclamar(self.jefe, [aviso['id']]), [])
        self.assertEqual(self._avisos(self.jefe), [])

    def test_lo_visto_es_por_usuario_y_por_rol(self):
        from fondos.models import AsignacionCarrera
        # El Jefe que además es docente: lo visto como Jefe no cuenta como docente.
        como_docente = AsignacionCarrera.objects.create(user=self.jefe, carrera=self.carrera, rol='docente', docente=self.docente)
        self._estado('presentado_director')
        self._accion(self.director, 'aprobar')
        self.client.force_authenticate(self.jefe)
        aviso = self.client.get('/api/fondos-tiempo/novedades/').data['avisos'][0]

        self.assertEqual(self._reclamar(self.jefe, [aviso['id']]), [aviso['id']])
        self.assertEqual(self._reclamar(self.jefe, [aviso['id']], asignacion=como_docente.pk), [aviso['id']])
        self.assertEqual(self._reclamar(self.usuario_docente, [aviso['id']]), [aviso['id']])

    def test_marcar_visto_funciona_con_la_carrera_inactiva(self):
        self._estado('presentado_director')
        self._accion(self.director, 'aprobar')
        self.carrera.activo = False
        self.carrera.save(update_fields=['activo'])
        self.client.force_authenticate(self.jefe)
        aviso = self.client.get('/api/fondos-tiempo/novedades/').data['avisos'][0]
        self.assertEqual(self._reclamar(self.jefe, [aviso['id']]), [aviso['id']])

    def test_el_aviso_trae_el_fondo_y_el_tono(self):
        self._estado('presentado_director')
        self._accion(self.director, 'aprobar')
        self.client.force_authenticate(self.usuario_docente)
        aviso = self.client.get('/api/fondos-tiempo/novedades/').data['avisos'][0]

        self.assertEqual(aviso['fondo_id'], self.fondo.pk)
        self.assertEqual(aviso['evento'], 'fondo_aprobado')
        self.assertEqual(aviso['tono'], 'exito')

    def test_la_lista_trae_el_estado_del_informe(self):
        self.client.force_authenticate(self.jefe)
        sin_informe = self.client.get('/api/fondos-tiempo/').data
        self._informe_presentado()
        self._accion(self.director, 'observar-informe', {'comentario': 'Falta detallar la sección académica.'})
        self.client.force_authenticate(self.jefe)
        con_informe = self.client.get('/api/fondos-tiempo/').data

        filas = lambda data: data['results'] if isinstance(data, dict) else data  # noqa: E731
        self.assertIsNone(filas(sin_informe)[0]['estado_informe'])
        self.assertEqual(filas(con_informe)[0]['estado'], 'en_ejecucion')
        self.assertEqual(filas(con_informe)[0]['estado_informe'], 'observado')

    def test_un_aviso_superado_por_un_estado_posterior_ya_no_sale(self):
        # El docente presenta el informe y el Director lo finaliza antes de que el Jefe
        # entre: el Jefe solo ve "finalizado", y "presentó su informe" ya no se muestra.
        self._estado('en_ejecucion')
        self._accion(self.usuario_docente, 'presentar', {
            'seccion_academica': '<p>Dicté mis materias.</p>', 'conclusiones_generales': '<p>Cumplí lo planificado.</p>',
        })
        presentado = HistorialFondo.objects.filter(fondo_tiempo=self.fondo, estado_nuevo='informe_presentado').latest('id')
        self._accion(self.director, 'evaluar-y-finalizar', EVALUACION)

        self.assertEqual(self._avisos(self.jefe), [f'El fondo de {self.nombre} fue finalizado.'])
        self.assertEqual(self._reclamar(self.jefe, [presentado.pk]), [])

    def test_un_jefe_de_otra_carrera_no_recibe_nada(self):
        jefe_ajeno = self.crear_usuario('jefe_ajeno', 'jefe_estudios', carrera=self.otra_carrera, is_staff=True, ci='JAJ')
        self._estado('presentado_director')
        self._accion(self.director, 'aprobar')
        self.assertEqual(self._avisos(jefe_ajeno), [])


@override_settings(MEDIA_ROOT='/tmp/test_media_avisos')
class AvisosFondoDelDirectorTests(UsuariosBaseTestCase):
    """En el fondo del propio Director, el superusuario ocupa el lugar del Director."""

    def setUp(self):
        super().setUp()
        self.director = self.crear_usuario('director_propio', 'director', carrera=self.carrera, is_staff=True, ci='DPR')
        self.docente_director = self.crear_docente('DPR', usuario=self.director)
        PerfilUsuario.objects.filter(user=self.director).update(docente=self.docente_director)
        self.jefe = self.crear_usuario('jefe_dpr', 'jefe_estudios', carrera=self.carrera, is_staff=True, ci='JDP')
        self.fondo = FondoTiempo.objects.create(docente=self.docente_director, carrera=self.carrera, gestion=2026)

    def _novedades(self, usuario):
        self.client.force_authenticate(usuario)
        return [a['texto'] for a in self.client.get('/api/fondos-tiempo/novedades/').data['avisos']]

    def test_presentar_y_el_informe_le_avisan_al_superusuario_y_no_al_director(self):
        nombre = self.docente_director.nombre_completo
        esperado = {
            'presentado_director': f'Nuevo fondo para revisar: {nombre} (gestión 2026).',
            'informe_presentado': f'{nombre} presentó su informe para evaluar.',
        }
        for anterior, nuevo in (('borrador', 'presentado_director'), ('en_ejecucion', 'informe_presentado')):
            with self.subTest(estado=nuevo):
                FondoTiempo.objects.filter(pk=self.fondo.pk).update(estado=nuevo)
                HistorialFondo.objects.create(
                    fondo_tiempo=self.fondo, usuario=self.jefe, tipo_cambio='presentacion',
                    descripcion='-', estado_anterior=anterior, estado_nuevo=nuevo,
                )
                # Solo el último cambio del fondo: el anterior quedó superado.
                self.assertEqual(self._novedades(self.superuser), [esperado[nuevo]])
                self.assertEqual(self._novedades(self.director), [])

    def test_el_superusuario_aprueba_y_le_avisa_al_jefe(self):
        FondoTiempo.objects.filter(pk=self.fondo.pk).update(estado='presentado_director')
        self.client.force_authenticate(self.superuser)
        response = self.client.post(
            f'/api/fondos-tiempo/{self.fondo.pk}/aprobar/', {'documento_decanatura': _pdf()}, format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

        self.assertEqual(self._novedades(self.jefe), [f'El fondo de {self.docente_director.nombre_completo} fue aprobado.'])
        self.assertEqual(self._novedades(self.superuser), [])
