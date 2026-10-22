"""Nadie trabaja el fondo o el informe de otro en su lugar.

- El fondo (editarlo, cargas, presentarlo al Director, corregirlo observado, devolverlo a
  borrador) solo lo trabaja el Jefe de Estudios de su carrera.
- El informe (guardarlo y presentarlo, también observado) solo el docente dueño.
- En el chat escriben el dueño, su revisor y Jefatura; resuelven el dueño y Jefatura.
- El superusuario y el Director lo ven en solo lectura: el superusuario solo revisa el
  fondo de un Director (Art. 28).
"""
from rest_framework import status

from fondos.models import (
    AsignacionCarrera, FondoTiempo, InformeFondo, MensajeObservacion, ObservacionFondo, PerfilUsuario,
)
from .tests_usuarios_auditoria import UsuariosBaseTestCase
from .utilidades import forzar_campos

# El Director ni siquiera ve los borradores de otros docentes (404); en los demás casos, 403.
RECHAZADO = (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)


class PermisosDelDuenoTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.director = self.crear_usuario('director_sis', 'director', carrera=self.carrera)
        self.jefe = self.crear_usuario('jefe_sis', 'jefe_estudios', carrera=self.carrera)
        self.dueno = self.crear_usuario('docente_dueno', 'docente', carrera=self.carrera)
        docente = self.crear_docente('DUENO', usuario=self.dueno)
        PerfilUsuario.objects.filter(user=self.dueno).update(docente=docente)
        AsignacionCarrera.objects.filter(user=self.dueno).update(docente=docente)
        self.fondo = FondoTiempo.objects.create(docente=docente, carrera=self.carrera, gestion=2026)

    def _como(self, usuario):
        self.client.force_authenticate(usuario)

    def _estado(self, estado):
        forzar_campos(FondoTiempo.objects.filter(pk=self.fondo.pk), estado=estado)

    def _informe(self, estado):
        self._estado('en_ejecucion')
        InformeFondo.objects.create(
            fondo_tiempo=self.fondo, tipo='parcial', estado=estado, elaborado_por=self.dueno,
        )

    def _hilo(self):
        observacion = ObservacionFondo.objects.create(fondo_tiempo=self.fondo, resuelta=False)
        MensajeObservacion.objects.create(observacion=observacion, autor=self.director, texto='Corregir', es_admin=True)
        return observacion

    # --- El fondo ------------------------------------------------------------------------

    def test_superusuario_y_director_no_editan_el_fondo_en_borrador_ni_observado(self):
        for estado in ('borrador', 'observado'):
            self._estado(estado)
            for usuario in (self.superuser, self.director):
                with self.subTest(estado=estado, usuario=usuario.username):
                    self._como(usuario)
                    response = self.client.patch(f'/api/fondos-tiempo/{self.fondo.pk}/', {'observaciones': 'x'}, format='json')
                    self.assertIn(response.status_code, RECHAZADO, response.data)

    def test_el_jefe_de_estudios_si_edita_el_fondo_observado(self):
        self._estado('observado')
        self._como(self.jefe)

        response = self.client.patch(f'/api/fondos-tiempo/{self.fondo.pk}/', {'observaciones': 'Corregido'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_superusuario_y_director_no_presentan_el_fondo_al_director(self):
        for estado in ('borrador', 'observado'):
            self._estado(estado)
            for usuario in (self.superuser, self.director):
                with self.subTest(estado=estado, usuario=usuario.username):
                    self._como(usuario)
                    response = self.client.patch(f'/api/fondos-tiempo/{self.fondo.pk}/presentar-a-director/')
                    self.assertIn(response.status_code, RECHAZADO, response.data)
        self.fondo.refresh_from_db()
        self.assertEqual(self.fondo.estado, 'observado')

    def test_superusuario_y_director_no_devuelven_a_borrador_un_fondo_rechazado(self):
        self._estado('rechazado')
        for usuario in (self.superuser, self.director):
            with self.subTest(usuario=usuario.username):
                self._como(usuario)
                response = self.client.post(f'/api/fondos-tiempo/{self.fondo.pk}/volver-a-borrador/')
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, response.data)

    def test_superusuario_y_director_no_registran_cargas_horarias(self):
        for usuario in (self.superuser, self.director):
            with self.subTest(usuario=usuario.username):
                self._como(usuario)
                response = self.client.post('/api/cargas-horarias/', {
                    'fondo': self.fondo.pk, 'docente': self.fondo.docente_id, 'categoria': 'investigacion',
                    'tipo_actividad': 'participacion_iic_cis', 'titulo_actividad': 'Ítem', 'horas': 10,
                }, format='json')
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, response.data)

    def test_superusuario_no_crea_fondos_ni_los_genera_en_masa(self):
        self._como(self.superuser)

        crear = self.client.post('/api/fondos-tiempo/', {
            'docente': self.fondo.docente_id, 'carrera': self.carrera.pk, 'gestion': 2027,
        }, format='json')
        masivo = self.client.post('/api/fondos-tiempo/generar-masivo/', {'gestion': 2027}, format='json')

        self.assertEqual(crear.status_code, status.HTTP_403_FORBIDDEN, crear.data)
        self.assertEqual(masivo.status_code, status.HTTP_403_FORBIDDEN, masivo.data)

    # --- El informe ----------------------------------------------------------------------

    def test_nadie_mas_guarda_ni_presenta_el_informe_del_docente(self):
        for estado_informe in ('borrador', 'observado'):
            InformeFondo.objects.filter(fondo_tiempo=self.fondo).delete()
            self._informe(estado_informe)
            for usuario in (self.superuser, self.director, self.jefe):
                with self.subTest(informe=estado_informe, usuario=usuario.username):
                    self._como(usuario)
                    guardar = self.client.patch(
                        f'/api/fondos-tiempo/{self.fondo.pk}/guardar-informe-borrador/',
                        {'seccion_academica': '<p>Texto ajeno</p>'}, format='json',
                    )
                    presentar = self.client.post(
                        f'/api/fondos-tiempo/{self.fondo.pk}/presentar/',
                        {'seccion_academica': '<p>Texto</p>', 'conclusiones_generales': '<p>Fin</p>'}, format='json',
                    )
                    self.assertEqual(guardar.status_code, status.HTTP_403_FORBIDDEN, guardar.data)
                    self.assertEqual(presentar.status_code, status.HTTP_403_FORBIDDEN, presentar.data)
        self.fondo.refresh_from_db()
        self.assertEqual(self.fondo.estado, 'en_ejecucion')

    def test_el_docente_dueno_si_guarda_su_informe_observado(self):
        self._informe('observado')
        self._como(self.dueno)

        response = self.client.patch(
            f'/api/fondos-tiempo/{self.fondo.pk}/guardar-informe-borrador/',
            {'seccion_academica': '<p>Corregido</p>'}, format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_el_superusuario_tampoco_edita_el_informe_del_director(self):
        # Revisa el fondo del Director (Art. 28), pero el informe lo redacta el Director.
        AsignacionCarrera.objects.create(user=self.dueno, carrera=self.carrera, rol='director')
        self.assertTrue(self.fondo.es_de_director_de_su_carrera())
        self._informe('observado')
        self._como(self.superuser)

        response = self.client.patch(
            f'/api/fondos-tiempo/{self.fondo.pk}/guardar-informe-borrador/',
            {'seccion_academica': '<p>Texto ajeno</p>'}, format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, response.data)

    # --- Chat de observaciones -----------------------------------------------------------

    def test_en_el_chat_escriben_el_dueno_su_revisor_y_jefatura(self):
        self._estado('observado')
        hilo = self._hilo()
        casos = ((self.superuser, 403), (self.dueno, 200), (self.director, 200), (self.jefe, 200))
        for usuario, esperado in casos:
            with self.subTest(usuario=usuario.username):
                self._como(usuario)
                response = self.client.post(
                    f'/api/observaciones/{hilo.pk}/agregar-mensaje/', {'texto': 'Mensaje'}, format='json',
                )
                self.assertEqual(response.status_code, esperado, response.data)

    def test_el_superusuario_escribe_en_el_chat_del_fondo_de_un_director(self):
        AsignacionCarrera.objects.create(user=self.dueno, carrera=self.carrera, rol='director')
        self._estado('observado')
        hilo = self._hilo()
        self._como(self.superuser)

        response = self.client.post(f'/api/observaciones/{hilo.pk}/agregar-mensaje/', {'texto': 'Revisión'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    def test_superusuario_y_director_no_resuelven_la_observacion(self):
        self._estado('observado')
        hilo = self._hilo()
        for usuario in (self.superuser, self.director):
            with self.subTest(usuario=usuario.username):
                self._como(usuario)
                response = self.client.post(f'/api/observaciones/{hilo.pk}/marcar-resuelta/')
                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN, response.data)
        self._como(self.dueno)
        response = self.client.post(f'/api/observaciones/{hilo.pk}/marcar-resuelta/')
        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)

    # --- Indicadores para el frontend ----------------------------------------------------

    def test_el_detalle_del_fondo_queda_en_solo_lectura_para_superusuario_y_director(self):
        self._informe('observado')
        for usuario in (self.superuser, self.director):
            with self.subTest(usuario=usuario.username):
                self._como(usuario)
                data = self.client.get(f'/api/fondos-tiempo/{self.fondo.pk}/').data
                self.assertFalse(data['puede_editar'])
                self.assertFalse(data['puede_editar_informe'])
                self.assertFalse(data['puede_resolver_observaciones'])
        self._como(self.superuser)
        self.assertFalse(self.client.get(f'/api/fondos-tiempo/{self.fondo.pk}/').data['puede_escribir_observaciones'])

        self._como(self.dueno)
        data = self.client.get(f'/api/fondos-tiempo/{self.fondo.pk}/').data
        self.assertTrue(data['puede_editar_informe'])
        self.assertTrue(data['puede_escribir_observaciones'])
        self.assertTrue(data['puede_resolver_observaciones'])
