"""Tests de la organización de MEDIA: logos, fotos de perfil y comando organizar_media."""
import io
import os
import shutil
import tempfile
from datetime import date

from django.contrib.auth.models import User
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import TestCase, override_settings
from PIL import Image

from fondos.models import Carrera, PerfilUsuario, _get_image_cipher
from poa_document.models import (
    Actividad as ActividadPOA,
    DocumentoPOA,
    Evidencia,
    EvidenciaArchivo,
    ObjetivoEspecifico,
)


def _imagen(color='red', formato='PNG'):
    buffer = io.BytesIO()
    Image.new('RGB', (8, 8), color).save(buffer, formato)
    return buffer.getvalue()


def _subida(nombre='logo.png', color='red', formato='PNG', mime='image/png'):
    return SimpleUploadedFile(nombre, _imagen(color, formato), content_type=mime)


class MediaTestCase(TestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media_root)
        self.override.enable()
        self.carrera = Carrera.objects.create(nombre='Carrera Media', codigo='CMED', facultad='Prueba')
        self.user = User.objects.create_user('usuario_media', password='x')
        self.perfil = PerfilUsuario.objects.get(user=self.user)

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media_root, ignore_errors=True)

    def existe(self, nombre):
        return os.path.exists(os.path.join(self.media_root, nombre))


class ImagenesEnMediaTests(MediaTestCase):
    def test_logo_se_guarda_organizado_por_carrera(self):
        self.carrera.set_logo_carrera(_subida())
        self.carrera.save()
        self.assertEqual(self.carrera.logo_carrera.name, f'carreras/carrera_{self.carrera.pk}/logo.png')
        self.assertTrue(self.existe(self.carrera.logo_carrera.name))
        self.assertTrue(self.carrera.get_logo_carrera_data_uri().startswith('data:image/png;base64,'))

    def test_reemplazar_logo_borra_el_anterior(self):
        self.carrera.set_logo_carrera(_subida())
        self.carrera.save()
        anterior = self.carrera.logo_carrera.name
        self.carrera.set_logo_carrera(_subida('nuevo.jpg', 'blue', 'JPEG', 'image/jpeg'))
        self.carrera.save()
        self.assertFalse(self.existe(anterior))
        self.assertEqual(self.carrera.logo_carrera.name, f'carreras/carrera_{self.carrera.pk}/logo.jpg')

    def test_quitar_logo_borra_el_archivo(self):
        self.carrera.set_logo_carrera(_subida())
        self.carrera.save()
        nombre = self.carrera.logo_carrera.name
        self.carrera.clear_logo_carrera()
        self.carrera.save()
        self.assertFalse(self.existe(nombre))
        self.assertIsNone(self.carrera.get_logo_carrera_data_uri())

    def test_foto_perfil_organizada_por_usuario(self):
        self.perfil.set_foto_perfil(_subida('selfie.png'))
        self.perfil.save()
        self.assertEqual(self.perfil.foto_perfil.name, f'usuarios/usuario_{self.user.pk}/foto_perfil.png')
        self.assertTrue(self.perfil.tiene_foto_propia)

    def test_sin_foto_propia_usa_logo_de_la_carrera(self):
        self.carrera.set_logo_carrera(_subida())
        self.carrera.save()
        self.perfil.carrera = self.carrera
        self.perfil.save()
        self.assertFalse(self.perfil.tiene_foto_propia)
        self.assertEqual(self.perfil.get_foto_perfil_data_uri(), self.carrera.get_logo_carrera_data_uri())

    def test_imagen_vacia_se_rechaza(self):
        from django.core.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            self.carrera.set_logo_carrera(SimpleUploadedFile('vacio.png', b'', content_type='image/png'))

    def test_imagenes_cifradas_antiguas_se_siguen_leyendo(self):
        contenido = _imagen('green')
        Carrera.objects.filter(pk=self.carrera.pk).update(
            logo_carrera_cifrada=_get_image_cipher().encrypt(contenido), logo_carrera_mime='image/png',
        )
        self.carrera.refresh_from_db()
        self.assertTrue(self.carrera.get_logo_carrera_data_uri().startswith('data:image/png;base64,'))


class OrganizarMediaTests(MediaTestCase):
    def test_pasa_imagenes_cifradas_a_media_sin_cambiar_el_contenido(self):
        cipher = _get_image_cipher()
        Carrera.objects.filter(pk=self.carrera.pk).update(
            logo_carrera_cifrada=cipher.encrypt(_imagen('green')), logo_carrera_mime='image/png',
        )
        PerfilUsuario.objects.filter(pk=self.perfil.pk).update(
            foto_perfil_cifrada=cipher.encrypt(_imagen('blue')), foto_perfil_mime='image/png',
        )
        self.carrera.refresh_from_db()
        self.perfil.refresh_from_db()
        logo_antes = self.carrera.get_logo_carrera_data_uri()
        foto_antes = self.perfil.get_foto_perfil_data_uri()

        call_command('organizar_media', stdout=io.StringIO(), stderr=io.StringIO())

        self.carrera.refresh_from_db()
        self.perfil.refresh_from_db()
        self.assertIsNone(self.carrera.logo_carrera_cifrada)
        self.assertIsNone(self.perfil.foto_perfil_cifrada)
        self.assertEqual(self.carrera.logo_carrera.name, f'carreras/carrera_{self.carrera.pk}/logo.png')
        self.assertEqual(self.perfil.foto_perfil.name, f'usuarios/usuario_{self.user.pk}/foto_perfil.png')
        self.assertEqual(self.carrera.get_logo_carrera_data_uri(), logo_antes)
        self.assertEqual(self.perfil.get_foto_perfil_data_uri(), foto_antes)

    def test_dry_run_no_modifica_nada(self):
        Carrera.objects.filter(pk=self.carrera.pk).update(
            logo_carrera_cifrada=_get_image_cipher().encrypt(_imagen()), logo_carrera_mime='image/png',
        )
        call_command('organizar_media', '--dry-run', stdout=io.StringIO(), stderr=io.StringIO())
        self.carrera.refresh_from_db()
        self.assertIsNotNone(self.carrera.logo_carrera_cifrada)
        self.assertFalse(self.carrera.logo_carrera)

    def test_reubica_logo_de_ruta_antigua_y_es_idempotente(self):
        antiguo = default_storage.save('carreras/viejo.png', ContentFile(_imagen()))
        Carrera.objects.filter(pk=self.carrera.pk).update(logo_carrera=antiguo)

        call_command('organizar_media', stdout=io.StringIO(), stderr=io.StringIO())
        self.carrera.refresh_from_db()
        nuevo = self.carrera.logo_carrera.name
        self.assertEqual(nuevo, f'carreras/carrera_{self.carrera.pk}/logo.png')
        self.assertTrue(self.existe(nuevo))
        self.assertFalse(self.existe(antiguo))

        call_command('organizar_media', stdout=io.StringIO(), stderr=io.StringIO())
        self.carrera.refresh_from_db()
        self.assertEqual(self.carrera.logo_carrera.name, nuevo)

    def test_reubica_evidencia_poa_conservando_anio_y_mes(self):
        documento = DocumentoPOA.objects.create(
            gestion=2030, unidad_solicitante=self.carrera, programa='Programa',
            objetivo_gestion_institucional='Objetivo', fecha_elaboracion=date(2030, 1, 1),
        )
        objetivo = ObjetivoEspecifico.objects.create(documento=documento, codigo='OE-1', descripcion='Objetivo')
        actividad = ActividadPOA.objects.create(
            objetivo=objetivo, codigo='A-1', nombre='Actividad', responsable='Responsable',
            productos_esperados='Producto', mes_inicio='enero', mes_fin='febrero',
            indicador_descripcion='Indicador', indicador_linea_base=0, indicador_meta=1,
        )
        evidencia = Evidencia.objects.create(actividad=actividad)
        antiguo = default_storage.save('evidencias/2025/03/foto.png', ContentFile(_imagen()))
        archivo = EvidenciaArchivo.objects.create(evidencia=evidencia, tipo='imagen', archivo=antiguo)

        call_command('organizar_media', stdout=io.StringIO(), stderr=io.StringIO())
        archivo.refresh_from_db()
        self.assertEqual(archivo.archivo.name, 'poa/evidencias/2025/03/foto.png')
        self.assertTrue(self.existe('poa/evidencias/2025/03/foto.png'))
        self.assertFalse(self.existe(antiguo))

    def test_archivo_inexistente_no_rompe_el_comando(self):
        Carrera.objects.filter(pk=self.carrera.pk).update(logo_carrera='carreras/no_existe.png')
        salida_error = io.StringIO()
        call_command('organizar_media', stdout=io.StringIO(), stderr=salida_error)
        self.carrera.refresh_from_db()
        self.assertEqual(self.carrera.logo_carrera.name, 'carreras/no_existe.png')
        self.assertIn('no existe', salida_error.getvalue())
