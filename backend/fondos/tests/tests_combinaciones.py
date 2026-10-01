"""Combinaciones de roles y fondos.

1. Un docente tiene un solo vínculo (una dedicación), en la carrera de su usuario:
   el fondo sale de las horas de ese vínculo.
2. Nadie aprueba, observa, inicia ni evalúa su propio fondo. El fondo del Director
   lo aprueba el superusuario con el documento de la Decanatura (PDF). El Jefe de
   Estudios sí puede presentar su propio fondo.
3. Cargo + docencia en la misma carrera: todo dentro de 40 h/sem.
4. Cada unidad del fondo suma sus ítems (horas por año); su porcentaje es sobre las horas efectivas.
"""
from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import override_settings
from rest_framework import status

from fondos.models import (
    AsignacionCarrera, CargaHoraria, DatosLaborales, DocenteCarrera, FondoTiempo, InformeFondo, PerfilUsuario,
)
from fondos.serializers import unidades_del_fondo
from .tests_usuarios_ajustes import calendario_con_feriados
from .tests_usuarios_auditoria import UsuariosBaseTestCase

PDF_MINIMO = b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'


def _pdf(nombre='decanatura.pdf', contenido=PDF_MINIMO):
    return SimpleUploadedFile(nombre, contenido, content_type='application/pdf')


class DocenteUnVinculoTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.usuario = self.crear_usuario('docente_uno', 'docente', carrera=self.carrera, ci='D2')
        self.docente = self.crear_docente('D2', usuario=self.usuario, dedicacion='horario_24')   # 6 h/sem
        PerfilUsuario.objects.filter(user=self.usuario).update(docente=self.docente)
        DatosLaborales.objects.filter(pk=self.docente.datos_laborales_id).update(fecha_ingreso=date(2014, 1, 1))  # 12 años: 30 días

    def _fondo(self, carrera, **extra):
        self.docente.refresh_from_db()
        return FondoTiempo.objects.create(docente=self.docente, carrera=carrera, gestion=2026, **extra)

    def test_el_fondo_usa_las_horas_de_su_vinculo(self):
        calendario_con_feriados(self.carrera, dias=3)
        fondo = self._fondo(self.carrera)

        # 6 h/sem = 1,2 h/día.
        self.assertEqual(fondo.horas_semana, Decimal('6'))
        self.assertEqual(fondo.contrato_horas, 312)
        self.assertEqual(fondo.horas_vacacion, 36)   # 30 días x 1,2 h
        self.assertEqual(fondo.horas_feriados, 3)    # 3 días x 1,2 h (hacia abajo)

    def test_un_segundo_vinculo_se_rechaza(self):
        with self.assertRaises(ValidationError):
            DocenteCarrera.objects.create(
                docente=self.docente, carrera=self.otra_carrera, categoria='adjunto', dedicacion='horario_16',
            )
        self.assertEqual(self.docente.vinculos_carrera.count(), 1)

    def test_un_solo_fondo_vigente_por_docente_y_gestion(self):
        self._fondo(self.carrera)
        with self.assertRaises(IntegrityError), transaction.atomic():
            FondoTiempo.objects.bulk_create([
                FondoTiempo(docente=self.docente, carrera=self.otra_carrera, gestion=2026),
            ])

    def test_un_fondo_archivado_no_cuenta(self):
        FondoTiempo.objects.filter(pk=self._fondo(self.carrera).pk).update(archivado=True)
        FondoTiempo.objects.bulk_create([
            FondoTiempo(docente=self.docente, carrera=self.carrera, gestion=2026),
        ])
        self.assertEqual(FondoTiempo.objects.filter(docente=self.docente, gestion=2026).count(), 2)

    def test_la_unidad_suma_sus_items_y_su_porcentaje_es_sobre_horas_efectivas(self):
        fondo = self._fondo(self.carrera)   # 312 contrato - 36 vacación = 276 horas efectivas
        for tipo_actividad, horas in (('participacion_iic_cis', 50), ('organizacion_eventos_cientificos', 19)):
            CargaHoraria.objects.create(
                fondo=fondo, docente=self.docente, categoria='investigacion',
                tipo_actividad=tipo_actividad, titulo_actividad='Ítem', horas=horas,
            )
        self.assertEqual(fondo.total_asignado, 69)
        unidades = {unidad['tipo']: unidad for unidad in unidades_del_fondo(fondo)}
        self.assertEqual(len(unidades), 7)
        self.assertEqual(unidades['investigacion']['total_horas'], 69)
        self.assertEqual(unidades['investigacion']['porcentaje'], Decimal('25.00'))
        self.assertEqual(unidades['gestion']['total_horas'], 0)

    def test_editar_parcialmente_un_fondo_no_da_error_500(self):
        # Antes: KeyError en el validador de unicidad de DRF.
        fondo = self._fondo(self.carrera)
        self.client.force_authenticate(self.superuser)

        response = self.client.patch(f'/api/fondos-tiempo/{fondo.pk}/', {'observaciones': 'Nota'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)


class CargoMasDocenciaTests(UsuariosBaseTestCase):
    def test_el_director_docente_queda_en_40_horas(self):
        director = self.crear_usuario('director_40', 'director', carrera=self.carrera, is_staff=True, ci='D40')
        AsignacionCarrera.objects.create(user=director, carrera=self.carrera, rol='docente')
        docente = self.crear_docente('D40', usuario=director, dedicacion='horario_40')
        PerfilUsuario.objects.filter(user=director).update(docente=docente)

        fondo = FondoTiempo.objects.create(docente=docente, carrera=self.carrera, gestion=2026)

        self.assertEqual(fondo.horas_semana, Decimal('40'))


@override_settings(MEDIA_ROOT='/tmp/test_media_combinaciones')
class AutoaprobacionTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        # Director que además es docente de su carrera.
        self.director = self.crear_usuario('director_docente', 'director', carrera=self.carrera, is_staff=True, ci='DIR')
        AsignacionCarrera.objects.create(user=self.director, carrera=self.carrera, rol='docente')
        self.docente_director = self.crear_docente('DIR', usuario=self.director)
        PerfilUsuario.objects.filter(user=self.director).update(docente=self.docente_director)
        self.fondo_director = self._fondo(self.docente_director)

        # Docente común de la misma carrera.
        self.usuario_docente = self.crear_usuario('docente_comun', 'docente', carrera=self.carrera, ci='COM')
        self.docente_comun = self.crear_docente('COM', usuario=self.usuario_docente)
        PerfilUsuario.objects.filter(user=self.usuario_docente).update(docente=self.docente_comun)
        self.fondo_comun = self._fondo(self.docente_comun)

    def _fondo(self, docente, estado='presentado_director'):
        fondo = FondoTiempo.objects.create(docente=docente, carrera=self.carrera, gestion=2026)
        FondoTiempo.objects.filter(pk=fondo.pk).update(estado=estado)
        fondo.refresh_from_db()
        return fondo

    def _estado(self, fondo, estado):
        FondoTiempo.objects.filter(pk=fondo.pk).update(estado=estado)

    def test_el_director_no_revisa_su_propio_fondo(self):
        self.client.force_authenticate(self.director)
        acciones = {
            'aprobar': ('presentado_director', 'aprobar', {}),
            'observar': ('presentado_director', 'observar', {'accion': 'observar', 'observacion': 'x'}),
            'iniciar': ('aprobado_director', 'iniciar_ejecucion', {}),
            'evaluar': ('informe_presentado', 'evaluar-y-finalizar', {}),
            'observar informe': ('informe_presentado', 'observar-informe', {'comentario': 'x'}),
        }
        for accion, (estado, ruta, datos) in acciones.items():
            with self.subTest(accion=accion):
                self._estado(self.fondo_director, estado)

                response = self.client.post(f'/api/fondos-tiempo/{self.fondo_director.pk}/{ruta}/', datos, format='json')

                self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
                self.assertIn('tu propio fondo', str(response.data['detail']))
                self.fondo_director.refresh_from_db()
                self.assertEqual(self.fondo_director.estado, estado)

    def test_el_director_si_aprueba_el_fondo_de_otro_docente(self):
        self.client.force_authenticate(self.director)

        response = self.client.post(f'/api/fondos-tiempo/{self.fondo_comun.pk}/aprobar/', {}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.fondo_comun.refresh_from_db()
        self.assertEqual(self.fondo_comun.estado, 'aprobado_director')

    def test_el_superusuario_aprueba_el_fondo_del_director_con_el_pdf_de_decanatura(self):
        self.client.force_authenticate(self.superuser)
        url = f'/api/fondos-tiempo/{self.fondo_director.pk}/aprobar/'

        sin_pdf = self.client.post(url, {}, format='multipart')
        no_pdf = self.client.post(url, {'documento_decanatura': _pdf('nota.pdf', b'no es un pdf')}, format='multipart')
        self.assertEqual(sin_pdf.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('documento_decanatura', sin_pdf.data)
        self.assertEqual(no_pdf.status_code, status.HTTP_400_BAD_REQUEST)
        self.fondo_director.refresh_from_db()
        self.assertEqual(self.fondo_director.estado, 'presentado_director')

        response = self.client.post(url, {'documento_decanatura': _pdf()}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.fondo_director.refresh_from_db()
        self.assertEqual(self.fondo_director.estado, 'aprobado_director')
        self.assertEqual(self.fondo_director.aprobado_por, self.superuser)
        self.assertTrue(self.fondo_director.documento_decanatura.name.endswith('.pdf'))

    def test_el_fondo_del_director_solo_lo_revisa_el_superusuario(self):
        # Otro director (de otra carrera) tampoco puede: el fondo del Director es del superusuario.
        self.client.force_authenticate(self.superuser)
        response = self.client.post(
            f'/api/fondos-tiempo/{self.fondo_director.pk}/observar/',
            {'accion': 'observar', 'observacion': 'Revisar distribución'}, format='json',
        )
        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN, getattr(response, 'data', None))

    def test_el_jefe_de_estudios_si_puede_presentar_su_propio_fondo(self):
        jefe = self.crear_usuario('jefe_docente', 'jefe_estudios', carrera=self.otra_carrera, is_staff=True, ci='JEF')
        AsignacionCarrera.objects.create(user=jefe, carrera=self.otra_carrera, rol='docente')
        docente_jefe = self.crear_docente('JEF', usuario=jefe, carrera=self.otra_carrera)
        PerfilUsuario.objects.filter(user=jefe).update(docente=docente_jefe)
        fondo = FondoTiempo.objects.create(docente=docente_jefe, carrera=self.otra_carrera, gestion=2026)
        self.client.force_authenticate(jefe)

        response = self.client.patch(f'/api/fondos-tiempo/{fondo.pk}/presentar-a-director/', {}, format='json')

        # No se le prohíbe por ser su fondo: falla solo por requisitos del fondo (unidades vacías).
        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN, response.data)
        self.assertIn('La suma de las unidades', str(response.data))

    def _con_informe(self, fondo):
        self._estado(fondo, 'informe_presentado')
        InformeFondo.objects.create(fondo_tiempo=fondo, elaborado_por=self.superuser, tipo='parcial')

    def test_evaluar_el_fondo_del_director_exige_el_pdf_de_decanatura(self):
        self._con_informe(self.fondo_director)
        self.client.force_authenticate(self.superuser)
        url = f'/api/fondos-tiempo/{self.fondo_director.pk}/evaluar-y-finalizar/'
        evaluacion = {'cumplimiento': 'cumplido', 'evaluacion_director': 'Cumplió todas las actividades planificadas en la gestión.'}

        sin_pdf = self.client.post(url, evaluacion, format='multipart')
        no_pdf = self.client.post(url, {**evaluacion, 'documento_decanatura': _pdf('nota.pdf', b'texto plano')}, format='multipart')
        self.assertEqual(sin_pdf.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('documento_decanatura', sin_pdf.data)
        self.assertEqual(no_pdf.status_code, status.HTTP_400_BAD_REQUEST)
        self.fondo_director.refresh_from_db()
        self.assertEqual(self.fondo_director.estado, 'informe_presentado')

        response = self.client.post(url, {**evaluacion, 'documento_decanatura': _pdf('informe.pdf')}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.fondo_director.refresh_from_db()
        self.assertEqual(self.fondo_director.estado, 'finalizado')
        self.assertTrue(self.fondo_director.documento_decanatura_informe.name.endswith('.pdf'))

    def test_evaluar_el_fondo_de_un_docente_no_pide_pdf(self):
        self._con_informe(self.fondo_comun)
        self.client.force_authenticate(self.director)

        response = self.client.post(
            f'/api/fondos-tiempo/{self.fondo_comun.pk}/evaluar-y-finalizar/',
            {'cumplimiento': 'cumplido', 'evaluacion_director': 'Cumplió todas las actividades planificadas en la gestión.'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.fondo_comun.refresh_from_db()
        self.assertEqual(self.fondo_comun.estado, 'finalizado')

    def test_un_director_de_otra_carrera_no_puede_evaluar_el_fondo(self):
        # 404 y no 403: fuera de su alcance no se revela que el fondo existe.
        director_ajeno = self.crear_usuario('director_ajeno', 'director', carrera=self.otra_carrera, is_staff=True, ci='AJE')
        self._con_informe(self.fondo_comun)
        self.client.force_authenticate(director_ajeno)

        response = self.client.post(
            f'/api/fondos-tiempo/{self.fondo_comun.pk}/evaluar-y-finalizar/',
            {'cumplimiento': 'cumplido', 'evaluacion_director': 'Cumplió todas las actividades planificadas en la gestión.'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.fondo_comun.refresh_from_db()
        self.assertEqual(self.fondo_comun.estado, 'informe_presentado')

    def test_un_docente_no_puede_evaluar_ningun_fondo(self):
        # Ni un fondo ajeno (404: no ve que existe) ni el suyo (403: no puede evaluarlo).
        otro_usuario = self.crear_usuario('otro_docente', 'docente', carrera=self.carrera, ci='OTR')
        otro_docente = self.crear_docente('OTR', usuario=otro_usuario)
        PerfilUsuario.objects.filter(user=otro_usuario).update(docente=otro_docente)
        fondo_propio = self._fondo(otro_docente, estado='informe_presentado')
        self._con_informe(self.fondo_comun)
        InformeFondo.objects.create(fondo_tiempo=fondo_propio, elaborado_por=otro_usuario, tipo='parcial')
        self.client.force_authenticate(otro_usuario)
        evaluacion = {'cumplimiento': 'cumplido', 'evaluacion_director': 'Cumplió todas las actividades planificadas en la gestión.'}

        casos = ((self.fondo_comun, status.HTTP_404_NOT_FOUND), (fondo_propio, status.HTTP_403_FORBIDDEN))
        for fondo, esperado in casos:
            with self.subTest(fondo=fondo.pk):
                response = self.client.post(f'/api/fondos-tiempo/{fondo.pk}/evaluar-y-finalizar/', evaluacion, format='json')

                self.assertEqual(response.status_code, esperado)
                fondo.refresh_from_db()
                self.assertEqual(fondo.estado, 'informe_presentado')

    def test_el_detalle_informa_propio_y_director(self):
        self.client.force_authenticate(self.director)
        propio = self.client.get(f'/api/fondos-tiempo/{self.fondo_director.pk}/').data
        ajeno = self.client.get(f'/api/fondos-tiempo/{self.fondo_comun.pk}/').data

        self.assertTrue(propio['es_fondo_propio'])
        self.assertTrue(propio['es_fondo_de_director'])
        self.assertFalse(ajeno['es_fondo_propio'])
        self.assertFalse(ajeno['es_fondo_de_director'])
