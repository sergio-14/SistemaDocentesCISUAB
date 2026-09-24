# -*- coding: utf-8 -*-
"""
Organiza la carpeta MEDIA con la estructura actual del sistema:

  media/
  ├── carreras/carrera_<id>/logo.<ext>
  ├── usuarios/usuario_<id>/foto_perfil.<ext>
  ├── fondos/
  │   ├── evidencias_actividades/docente_<id>/gestion_<año>/<categoria>/
  │   ├── evidencias_carga/docente_<id>/gestion_<año>/<categoria>/actividad_<id>/
  │   └── informes/docente_<id>/gestion_<año>/{adjuntos,evidencias}/
  └── poa/
      ├── compras/<año>/<mes>/   recepciones/...   entregas/...
      └── evidencias/<año>/<mes>/

Hace tres cosas, y se puede ejecutar varias veces sin efectos repetidos:

1. Pasa a archivos en media las fotos de perfil y logos de carrera que
   estaban guardados cifrados dentro de la base de datos.
2. Mueve los archivos subidos con la estructura anterior (uploads/,
   evidencias_carga/, informes_evidencia/, evidencias/, perfiles/, carreras/)
   a su carpeta nueva y actualiza la ruta en la base de datos.
3. Extrae las imágenes que el editor de informes guardaba en base64 dentro
   del HTML y las deja en fondos/informes/.../imagenes/.

Uso:
  python manage.py organizar_media --dry-run   # solo muestra lo que haría
  python manage.py organizar_media

Hacer un backup antes (docker compose -f docker-compose.prod.yml exec backup /backup.sh once).
"""
import os

from django.conf import settings
from django.core.files.base import ContentFile, File
from django.core.management.base import BaseCommand
from django.db.models import Q
from cryptography.fernet import InvalidToken

from fondos.utils.informe_imagenes import CAMPOS_HTML_INFORME, carpeta_imagenes, extraer_imagenes_informe

from fondos.models import (
    Actividad,
    Carrera,
    EvidenciaCargaHoraria,
    InformeFondo,
    PerfilUsuario,
    _extension_imagen,
    _get_image_cipher,
)
from poa_document.models import EvidenciaArchivo


# (modelo, campo, carpeta nueva). Un archivo que ya está bajo su carpeta nueva no se toca.
CAMPOS_REUBICABLES = [
    (Carrera, 'logo_carrera', 'carreras/carrera_'),
    (PerfilUsuario, 'foto_perfil', 'usuarios/usuario_'),
    (Actividad, 'archivo_evidencia', 'fondos/evidencias_actividades/'),
    (EvidenciaCargaHoraria, 'archivo', 'fondos/evidencias_carga/'),
    (InformeFondo, 'archivo_adjunto', 'fondos/informes/'),
    (InformeFondo, 'evidencia', 'fondos/informes/'),
]

# Campos con carpetas por fecha: se conserva el año/mes original.
PREFIJOS_POR_FECHA = [
    (EvidenciaArchivo, 'archivo', 'evidencias/', 'poa/evidencias/'),
]


class Command(BaseCommand):
    help = 'Organiza media/: pasa las imágenes cifradas a archivos y reubica los archivos antiguos.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Solo mostrar los cambios, sin aplicarlos.')

    def handle(self, *args, **options):
        self.dry_run = options['dry_run']
        self.resumen = {'imagenes': 0, 'informes': 0, 'movidos': 0, 'faltantes': 0, 'errores': 0}
        if self.dry_run:
            self.stdout.write(self.style.WARNING('Modo simulación: no se modifica nada.'))

        self._extraer_imagenes_cifradas(Carrera, 'logo_carrera', 'logo_carrera_cifrada', 'logo_carrera_mime', 'logo')
        self._extraer_imagenes_cifradas(PerfilUsuario, 'foto_perfil', 'foto_perfil_cifrada', 'foto_perfil_mime', 'foto_perfil')

        for modelo, campo, carpeta in CAMPOS_REUBICABLES:
            self._reubicar(modelo, campo, carpeta)
        for modelo, campo, anterior, nuevo in PREFIJOS_POR_FECHA:
            self._reubicar_prefijo(modelo, campo, anterior, nuevo)

        self._extraer_imagenes_de_informes()

        if not self.dry_run:
            self._borrar_carpetas_vacias()

        r = self.resumen
        self.stdout.write(self.style.SUCCESS(
            f"Listo. Imágenes pasadas a media: {r['imagenes']} | informes con imágenes extraídas: {r['informes']} | "
            f"archivos reubicados: {r['movidos']} | "
            f"archivos no encontrados: {r['faltantes']} | errores: {r['errores']}"
        ))

    # ------------------------------------------------------------------
    def _extraer_imagenes_cifradas(self, modelo, campo, campo_cifrado, campo_mime, nombre_base):
        cipher = _get_image_cipher()
        pendientes = modelo.objects.exclude(**{f'{campo_cifrado}__isnull': True})
        for obj in pendientes:
            if getattr(obj, campo).name:
                continue  # ya tiene archivo: el dato cifrado es un resto antiguo
            mime = getattr(obj, campo_mime) or ''
            try:
                contenido = cipher.decrypt(bytes(getattr(obj, campo_cifrado)))
            except InvalidToken:
                self.resumen['errores'] += 1
                self.stderr.write(f'  {modelo.__name__} {obj.pk}: no se pudo descifrar (clave distinta); se deja como está.')
                continue

            nombre = f'{nombre_base}{_extension_imagen("", mime)}'
            if self.dry_run:
                self.stdout.write(f'  {modelo.__name__} {obj.pk}: imagen cifrada -> archivo en media')
                self.resumen['imagenes'] += 1
                continue

            field_file = getattr(obj, campo)
            field_file.save(nombre, ContentFile(contenido), save=False)
            modelo.objects.filter(pk=obj.pk).update(**{campo: field_file.name, campo_cifrado: None})
            self.stdout.write(f'  {modelo.__name__} {obj.pk}: -> {field_file.name}')
            self.resumen['imagenes'] += 1

    def _extraer_imagenes_de_informes(self):
        """Imágenes base64 dentro del HTML de los informes -> archivos en media."""
        filtro = Q()
        for campo in CAMPOS_HTML_INFORME:
            filtro |= Q(**{f'{campo}__icontains': 'data:image/'})
        for informe in InformeFondo.objects.filter(filtro).select_related('fondo_tiempo'):
            if self.dry_run:
                self.stdout.write(f'  InformeFondo {informe.pk}: imágenes base64 -> archivos en media')
                self.resumen['informes'] += 1
                continue
            cambiados = extraer_imagenes_informe(informe)
            if cambiados:
                # update() evita tocar fecha_modificacion: el contenido visible no cambia.
                InformeFondo.objects.filter(pk=informe.pk).update(**{c: getattr(informe, c) for c in cambiados})
                self.stdout.write(f'  InformeFondo {informe.pk}: imágenes -> {carpeta_imagenes(informe)}/')
                self.resumen['informes'] += 1

    def _reubicar(self, modelo, campo, carpeta):
        field = modelo._meta.get_field(campo)
        for obj in modelo.objects.exclude(**{campo: ''}).exclude(**{f'{campo}__isnull': True}):
            actual = getattr(obj, campo).name
            if actual.startswith(carpeta):
                continue
            nuevo = field.generate_filename(obj, os.path.basename(actual))
            self._mover(modelo, obj, campo, field.storage, actual, nuevo)

    def _reubicar_prefijo(self, modelo, campo, anterior, nuevo_prefijo):
        field = modelo._meta.get_field(campo)
        for obj in modelo.objects.filter(**{f'{campo}__startswith': anterior}):
            actual = getattr(obj, campo).name
            self._mover(modelo, obj, campo, field.storage, actual, nuevo_prefijo + actual[len(anterior):])

    def _mover(self, modelo, obj, campo, storage, actual, nuevo):
        if not storage.exists(actual):
            self.resumen['faltantes'] += 1
            self.stderr.write(f'  {modelo.__name__} {obj.pk}: no existe el archivo {actual}; se deja la ruta sin cambios.')
            return
        if self.dry_run:
            self.stdout.write(f'  {actual} -> {nuevo}')
            self.resumen['movidos'] += 1
            return
        try:
            with storage.open(actual, 'rb') as origen:
                guardado = storage.save(nuevo, File(origen))
            # update() evita señales e historial: es un cambio de ubicación, no de contenido.
            modelo.objects.filter(pk=obj.pk).update(**{campo: guardado})
            storage.delete(actual)
        except OSError as exc:
            self.resumen['errores'] += 1
            self.stderr.write(f'  {modelo.__name__} {obj.pk}: error moviendo {actual}: {exc}')
            return
        self.stdout.write(f'  {actual} -> {guardado}')
        self.resumen['movidos'] += 1

    def _borrar_carpetas_vacias(self):
        raiz = str(settings.MEDIA_ROOT)
        for carpeta, subcarpetas, archivos in os.walk(raiz, topdown=False):
            if carpeta != raiz and not os.listdir(carpeta):
                try:
                    os.rmdir(carpeta)
                except OSError:
                    pass
