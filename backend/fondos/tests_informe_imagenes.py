"""Tests de las imágenes del editor de informes guardadas en MEDIA."""
import base64
import io
import os
import shutil
import tempfile

from django.contrib.auth.models import User
from django.core.management import call_command
from django.test import RequestFactory, TestCase, override_settings
from PIL import Image

from fondos.models import Carrera, DatosLaborales, Docente, FondoTiempo, InformeFondo
from fondos.serializers import InformeFondoSerializer
from fondos.utils.informe_imagenes import leer_imagen


def _data_uri(color='red'):
    buffer = io.BytesIO()
    Image.new('RGB', (10, 10), color).save(buffer, 'PNG')
    return 'data:image/png;base64,' + base64.b64encode(buffer.getvalue()).decode()


class InformeImagenesTests(TestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media_root)
        self.override.enable()
        carrera = Carrera.objects.create(nombre='Carrera Informe', codigo='CINF', facultad='Prueba')
        docente = Docente.objects.create(nombres='Ana', apellido_paterno='Rojas', datos_laborales=DatosLaborales.objects.create(ci='999'))
        self.fondo = FondoTiempo.objects.create(docente=docente, carrera=carrera, gestion=2026)
        self.user = User.objects.create_user('docente_informe', password='x')
        self.carpeta = f'fondos/informes/docente_{docente.pk}/gestion_2026/imagenes'

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)

    def _informe(self, **campos):
        return InformeFondo.objects.create(fondo_tiempo=self.fondo, elaborado_por=self.user, tipo='parcial', **campos)

    def _archivos(self):
        ruta = os.path.join(self.media_root, self.carpeta)
        return sorted(os.listdir(ruta)) if os.path.isdir(ruta) else []

    def test_imagen_base64_se_guarda_en_media_y_la_bd_solo_tiene_la_ruta(self):
        informe = self._informe(seccion_academica=f'<p>Hola</p><img src="{_data_uri()}" style="width:100px">')
        informe.refresh_from_db()
        self.assertNotIn('base64', informe.seccion_academica)
        self.assertIn(f'src="/media/{self.carpeta}/img_', informe.seccion_academica)
        self.assertIn('style="width:100px"', informe.seccion_academica)
        self.assertEqual(len(self._archivos()), 1)

    def test_reenviar_la_misma_imagen_no_la_duplica(self):
        imagen = _data_uri('blue')
        informe = self._informe(seccion_academica=f'<img src="{imagen}">')
        informe.seccion_investigacion = f'<img src="{imagen}">'
        informe.save()
        self.assertEqual(len(self._archivos()), 1)

    @override_settings(ALLOWED_HOSTS=['midominio.com'])
    def test_lectura_devuelve_url_firmada_y_al_guardar_se_normaliza(self):
        informe = self._informe(seccion_academica=f'<img src="{_data_uri()}">')
        request = RequestFactory().get('/', HTTP_HOST='midominio.com', secure=True)
        data = InformeFondoSerializer(informe, context={'request': request}).data
        self.assertIn('src="https://midominio.com/media/', data['seccion_academica'])
        self.assertIn('?t=', data['seccion_academica'])

        # El editor reenvía el HTML tal como lo recibió (con URL firmada absoluta).
        informe.seccion_academica = data['seccion_academica']
        informe.save()
        informe.refresh_from_db()
        self.assertNotIn('?t=', informe.seccion_academica)
        self.assertNotIn('midominio.com', informe.seccion_academica)
        self.assertEqual(len(self._archivos()), 1)

    def test_quitar_la_imagen_borra_el_archivo(self):
        informe = self._informe(seccion_academica=f'<img src="{_data_uri()}">')
        self.assertEqual(len(self._archivos()), 1)
        informe.seccion_academica = '<p>Sin imagen</p>'
        informe.save()
        self.assertEqual(self._archivos(), [])

    def test_borrar_el_informe_borra_sus_imagenes(self):
        informe = self._informe(seccion_academica=f'<img src="{_data_uri()}">')
        informe.delete()
        self.assertEqual(self._archivos(), [])

    def test_imagen_compartida_entre_informes_no_se_borra(self):
        imagen = _data_uri('green')
        parcial = self._informe(seccion_academica=f'<img src="{imagen}">')
        InformeFondo.objects.create(
            fondo_tiempo=self.fondo, elaborado_por=self.user, tipo='final', seccion_academica=f'<img src="{imagen}">',
        )
        parcial.seccion_academica = ''
        parcial.save()
        self.assertEqual(len(self._archivos()), 1)

    def test_el_pdf_puede_leer_la_imagen_desde_media(self):
        informe = self._informe(seccion_academica=f'<img src="{_data_uri()}">')
        informe.refresh_from_db()
        src = informe.seccion_academica.split('src="')[1].split('"')[0]
        self.assertTrue(leer_imagen(src).startswith(b'\x89PNG'))
        self.assertTrue(leer_imagen(_data_uri()).startswith(b'\x89PNG'))

    def test_organizar_media_extrae_imagenes_de_informes_antiguos(self):
        informe = self._informe()
        # Informe guardado por la versión anterior: base64 directo en la BD.
        InformeFondo.objects.filter(pk=informe.pk).update(seccion_academica=f'<img src="{_data_uri()}">')
        call_command('organizar_media', stdout=io.StringIO(), stderr=io.StringIO())
        informe.refresh_from_db()
        self.assertNotIn('base64', informe.seccion_academica)
        self.assertEqual(len(self._archivos()), 1)

    def test_enlaces_externos_no_se_tocan(self):
        html = '<img src="https://otro-sitio.com/imagen.png">'
        informe = self._informe(seccion_academica=html)
        informe.refresh_from_db()
        self.assertEqual(informe.seccion_academica, html)
