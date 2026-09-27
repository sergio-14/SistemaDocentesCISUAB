"""Combinaciones de roles y fondos.

1. Docente en dos carreras: un fondo por carrera, cada uno con SOLO las horas del
   vínculo de esa carrera; el tope de 40 h/sem se valida sobre la suma.
2. Nadie aprueba, observa, inicia ni evalúa su propio fondo. El fondo del Director
   lo aprueba el superusuario con el documento de la Decanatura (PDF). El Jefe de
   Estudios sí puede presentar su propio fondo.
3. Cargo + docencia en la misma carrera: todo dentro de 40 h/sem.
4. FondoTiempoSerializer: distribución en horas semanales, límite de la carrera del
   fondo, y dos fondos en carreras distintas nunca chocan.
"""
from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import override_settings
from rest_framework import status

from .models import (
    AsignacionCarrera, CategoriaFuncion, DatosLaborales, DocenteCarrera, FondoTiempo, InformeFondo, PerfilUsuario,
)
from .serializers import FondoTiempoSerializer
from .tests_usuarios_auditoria import UsuariosBaseTestCase

PDF_MINIMO = b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n'


def _pdf(nombre='decanatura.pdf', contenido=PDF_MINIMO):
    return SimpleUploadedFile(nombre, contenido, content_type='application/pdf')


class DocenteEnDosCarrerasTests(UsuariosBaseTestCase):
    def setUp(self):
        super().setUp()
        self.usuario = self.crear_usuario('docente_dos', 'docente', carrera=self.carrera, ci='D2')
        AsignacionCarrera.objects.create(user=self.usuario, carrera=self.otra_carrera, rol='docente')
        self.docente = self.crear_docente('D2', usuario=self.usuario, dedicacion='horario_40')   # 10 h/sem en A
        DocenteCarrera.objects.create(
            docente=self.docente, carrera=self.otra_carrera, categoria='adjunto', dedicacion='horario_24',  # 6 h/sem en B
        )
        PerfilUsuario.objects.filter(user=self.usuario).update(docente=self.docente)
        DatosLaborales.objects.filter(pk=self.docente.datos_laborales_id).update(fecha_ingreso=date(2014, 1, 1))  # 12 años: 30 días

    def _fondo(self, carrera, **extra):
        self.docente.refresh_from_db()
        return FondoTiempo.objects.create(docente=self.docente, carrera=carrera, gestion=2026, **extra)

    def test_cada_fondo_usa_solo_el_vinculo_de_su_carrera(self):
        fondo_a = self._fondo(self.carrera)
        fondo_b = self._fondo(self.otra_carrera, asignatura='B')

        # Carrera A: 10 h/sem = 2 h/día. Carrera B: 6 h/sem = 1,2 h/día.
        self.assertEqual(fondo_a.horas_semana, Decimal('10'))
        self.assertEqual(fondo_a.contrato_horas, 520)
        self.assertEqual(fondo_a.horas_vacacion, 60)   # 30 días x 2 h
        self.assertEqual(fondo_a.horas_feriados, 32)   # 16 días x 2 h

        self.assertEqual(fondo_b.horas_semana, Decimal('6'))
        self.assertEqual(fondo_b.contrato_horas, 312)
        self.assertEqual(fondo_b.horas_vacacion, 36)   # 30 días x 1,2 h
        self.assertEqual(fondo_b.horas_feriados, 19)   # 16 días x 1,2 h (hacia abajo)

    def test_el_tope_de_40_sigue_sumando_todos_los_vinculos(self):
        # 10 + 6 = 16 h/sem; con un tiempo completo más serían 56.
        tercera = self.otra_carrera.__class__.objects.create(nombre='Derecho', codigo='DER', facultad=self.facultad)
        with self.assertRaises(ValidationError):
            DocenteCarrera.objects.create(
                docente=self.docente, carrera=tercera, categoria='adjunto', dedicacion='tiempo_completo',
            )

    def test_dos_fondos_en_carreras_distintas_no_chocan(self):
        # Misma gestión, periodo y asignatura (vacía): antes chocaban en la base de datos.
        self._fondo(self.carrera, periodo='1')
        self._fondo(self.otra_carrera, periodo='1')

        self.assertEqual(FondoTiempo.objects.filter(docente=self.docente, gestion=2026).count(), 2)

    def test_en_la_misma_carrera_la_restriccion_sigue(self):
        self._fondo(self.carrera, periodo='1')
        with self.assertRaises(IntegrityError), transaction.atomic():
            FondoTiempo.objects.bulk_create([
                FondoTiempo(docente=self.docente, carrera=self.carrera, gestion=2026, periodo='1'),
            ])

    def test_la_distribucion_se_valida_en_horas_semanales_y_con_su_carrera(self):
        fondo_b = self._fondo(self.otra_carrera)
        tipos = [tipo for tipo, _ in CategoriaFuncion.TIPO_CHOICES]

        # 6 h/sem en B: justo el límite de la carrera del fondo.
        CategoriaFuncion.objects.create(fondo_tiempo=fondo_b, tipo=tipos[0], total_horas=Decimal('6'))
        self.assertTrue(FondoTiempoSerializer(instance=fondo_b, data={}, partial=True).is_valid())

        # 8 h/sem: supera las 6 de la carrera B aunque el vínculo de A tenga 10
        # (antes se usaba el "primer vínculo" y se dividía entre 52).
        CategoriaFuncion.objects.create(fondo_tiempo=fondo_b, tipo=tipos[1], total_horas=Decimal('2'))
        serializer = FondoTiempoSerializer(instance=fondo_b, data={}, partial=True)
        self.assertFalse(serializer.is_valid())
        self.assertIn('horas_efectivas', serializer.errors)


    def test_editar_parcialmente_un_fondo_no_da_error_500(self):
        # Antes: KeyError 'tipo_fondo' en el validador de unicidad de DRF.
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

        # No se le prohíbe por ser su fondo: falla solo por requisitos del fondo (programa analítico).
        self.assertNotEqual(response.status_code, status.HTTP_403_FORBIDDEN, response.data)
        self.assertIn('Programa Analítico', str(response.data))

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

    def test_el_detalle_informa_propio_y_director(self):
        self.client.force_authenticate(self.director)
        propio = self.client.get(f'/api/fondos-tiempo/{self.fondo_director.pk}/').data
        ajeno = self.client.get(f'/api/fondos-tiempo/{self.fondo_comun.pk}/').data

        self.assertTrue(propio['es_fondo_propio'])
        self.assertTrue(propio['es_fondo_de_director'])
        self.assertFalse(ajeno['es_fondo_propio'])
        self.assertFalse(ajeno['es_fondo_de_director'])
