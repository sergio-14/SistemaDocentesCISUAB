"""Imágenes insertadas en el editor del Informe de Fondo de Tiempo.

El editor (InformeFormatToolbar.jsx) inserta las imágenes como data URI
(base64) dentro del HTML de cada sección. Guardarlas así hace crecer la base de
datos y los backups, así que al guardar el informe se extraen a archivos:

    media/fondos/informes/docente_<id>/gestion_<año>/imagenes/img_<hash>.<ext>

y en la BD solo queda la ruta canónica ``/media/<ruta>`` (sin firma ni dominio).

- Solo se aceptan PNG, JPG y GIF reales (se comprueba el contenido, no el tipo
  declarado), de hasta TAMANO_MAXIMO_IMAGEN_MB cada una y como mucho
  MAXIMO_IMAGENES_INFORME por informe. Las imágenes con dirección externa y las
  que apuntan a otros archivos de media se rechazan: validar_imagenes_informe
  da el mensaje al guardar y, por si acaso, al extraerlas se descartan.
- Al leer, la ruta se convierte en una URL firmada (ver config.media) para que
  el navegador la pueda mostrar. Solo se firman rutas de imágenes de informe.
- Al volver a guardar, las URLs firmadas se normalizan otra vez a la ruta
  canónica; el nombre por hash evita duplicar una imagen que se reenvía.
- Las imágenes que ya no aparecen en ningún informe del docente en esa gestión
  se borran.
- El generador de PDF lee la imagen directamente del almacenamiento.
"""
import base64
import binascii
import hashlib
import io
import re
from urllib.parse import unquote, urlsplit

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from PIL import Image

from fondos.utils.informe_html import CAMPOS_HTML_RICO_INFORME, sanitizar_html_informe

TAMANO_MAXIMO_IMAGEN_MB = 3
MAXIMO_IMAGENES_INFORME = 20

MENSAJE_IMAGEN_EXTERNA = (
    'Las imágenes con dirección externa (copiadas de una página web o de otro documento) no se admiten: '
    'guárdala en tu equipo e insértala con el botón Imagen.'
)
MENSAJE_IMAGEN_WEBP = 'Las imágenes WEBP no se admiten: guárdala como PNG o JPG e insértala de nuevo.'
MENSAJE_IMAGEN_FORMATO = 'Solo se admiten imágenes PNG, JPG o GIF.'
MENSAJE_IMAGEN_TAMANO = f'Cada imagen puede pesar como máximo {TAMANO_MAXIMO_IMAGEN_MB} MB.'
MENSAJE_IMAGENES_CANTIDAD = f'El informe admite como máximo {MAXIMO_IMAGENES_INFORME} imágenes.'

_IMG_TAG_RE = re.compile(r'<img\b[^>]*>', re.IGNORECASE)
_IMG_SRC_RE = re.compile(r'(<img\b[^>]*?\bsrc\s*=\s*)(["\'])(.*?)\2', re.IGNORECASE | re.DOTALL)
_DATA_URI_RE = re.compile(r'^data:image/(png|jpe?g|gif);base64,(?P<data>.+)$', re.IGNORECASE | re.DOTALL)
_RUTA_IMAGEN_INFORME_RE = re.compile(r'^fondos/informes/(?:[^/]+/)+imagenes/img_[0-9a-f]+\.(?:png|jpg|gif)$')
_EXTENSION_POR_FORMATO = {'PNG': 'png', 'JPEG': 'jpg', 'GIF': 'gif'}
_PREFIJO_IMAGEN = 'img_'


class ImagenInformeInvalida(ValueError):
    """Imagen del informe que no se admite; el mensaje es para el docente."""


def carpeta_imagenes(informe):
    from fondos.models import _carpeta_informe
    return f'{_carpeta_informe(informe)}/imagenes'


def ruta_media(src):
    """Ruta relativa dentro de MEDIA si ``src`` apunta a un archivo propio, si no None.

    Acepta la ruta canónica (/media/x), URLs firmadas (/media/x?t=...) y las
    absolutas (https://dominio/media/x?t=...).
    """
    if not src or src.startswith('data:'):
        return None
    path = urlsplit(src.strip()).path
    prefijo = settings.MEDIA_URL if settings.MEDIA_URL.startswith('/') else f'/{settings.MEDIA_URL}'
    if not path.startswith(prefijo):
        return None
    ruta = unquote(path[len(prefijo):])
    if not ruta or '..' in ruta.split('/'):
        return None
    return ruta


def _url_canonica(ruta):
    return f"{settings.MEDIA_URL}{ruta}"


def _imagen_de_data_uri(data_uri):
    """(contenido, extensión) de una imagen en base64, comprobando su formato real y su tamaño."""
    cabecera, _, datos = data_uri.partition(',')
    tipo = cabecera[len('data:'):].split(';')[0].strip().lower()
    if tipo == 'image/webp':
        raise ImagenInformeInvalida(MENSAJE_IMAGEN_WEBP)
    if ';base64' not in cabecera.lower() or not datos:
        raise ImagenInformeInvalida(MENSAJE_IMAGEN_FORMATO)
    # Cada 4 caracteres base64 son 3 bytes: se rechaza antes de decodificar.
    if len(datos) * 3 // 4 > TAMANO_MAXIMO_IMAGEN_MB * 1024 * 1024 + 2:
        raise ImagenInformeInvalida(MENSAJE_IMAGEN_TAMANO)
    try:
        contenido = base64.b64decode(datos, validate=True)
    except (binascii.Error, ValueError):
        raise ImagenInformeInvalida(MENSAJE_IMAGEN_FORMATO)
    if len(contenido) > TAMANO_MAXIMO_IMAGEN_MB * 1024 * 1024:
        raise ImagenInformeInvalida(MENSAJE_IMAGEN_TAMANO)
    try:
        with Image.open(io.BytesIO(contenido)) as imagen:
            formato = imagen.format
            imagen.verify()
    except Exception:
        raise ImagenInformeInvalida(MENSAJE_IMAGEN_FORMATO)
    if formato == 'WEBP':
        raise ImagenInformeInvalida(MENSAJE_IMAGEN_WEBP)
    if formato not in _EXTENSION_POR_FORMATO:
        raise ImagenInformeInvalida(MENSAJE_IMAGEN_FORMATO)
    return contenido, _EXTENSION_POR_FORMATO[formato]


def _ruta_propia(src, carpeta):
    """Ruta en media si ``src`` es una imagen ya guardada en la carpeta del informe."""
    ruta = ruta_media(src)
    return ruta if ruta and ruta.startswith(f'{carpeta}/') else None


def _guardar_data_uri(carpeta, data_uri):
    contenido, extension = _imagen_de_data_uri(data_uri)
    ruta = f'{carpeta}/{_PREFIJO_IMAGEN}{hashlib.sha256(contenido).hexdigest()[:24]}.{extension}'
    if not default_storage.exists(ruta):
        ruta = default_storage.save(ruta, ContentFile(contenido))
    return ruta


def validar_imagenes_informe(campos, carpeta):
    """Revisa las imágenes del HTML que envía el editor antes de guardarlo.

    Lanza ImagenInformeInvalida con el mensaje para el docente si alguna no se
    admite o si son demasiadas.
    """
    total = 0
    for campo in CAMPOS_HTML_RICO_INFORME:
        html = sanitizar_html_informe(campos.get(campo) or '')
        for etiqueta in _IMG_TAG_RE.findall(html):
            total += 1
            match = _IMG_SRC_RE.search(etiqueta)
            src = match.group(3) if match else ''
            if src.startswith('data:'):
                _imagen_de_data_uri(src)
            elif not _ruta_propia(src, carpeta):
                raise ImagenInformeInvalida(MENSAJE_IMAGEN_EXTERNA)
    if total > MAXIMO_IMAGENES_INFORME:
        raise ImagenInformeInvalida(MENSAJE_IMAGENES_CANTIDAD)


def extraer_imagenes_html(html, carpeta):
    """Pasa a archivos las imágenes base64 y deja rutas canónicas en el HTML.

    Descarta las imágenes que no se admiten (externas, de otra carpeta de
    media, de formato o tamaño inválido): validar_imagenes_informe ya las
    rechazó con un mensaje en el guardado normal.
    """
    if not html or '<img' not in html.lower():
        return html

    def reemplazar(match_etiqueta):
        etiqueta = match_etiqueta.group(0)
        match = _IMG_SRC_RE.search(etiqueta)
        if not match:
            return ''
        src = match.group(3)
        if src.startswith('data:'):
            try:
                ruta = _guardar_data_uri(carpeta, src)
            except ImagenInformeInvalida:
                return ''
        else:
            ruta = _ruta_propia(src, carpeta)
        if not ruta:
            return ''
        nuevo_src = f'{match.group(1)}{match.group(2)}{_url_canonica(ruta)}{match.group(2)}'
        return etiqueta[:match.start()] + nuevo_src + etiqueta[match.end():]

    return _IMG_TAG_RE.sub(reemplazar, html)


def firmar_imagenes_html(html, request=None):
    """Convierte las rutas canónicas en URLs firmadas que el navegador puede cargar.

    Solo firma imágenes de informe: una ruta a otro archivo de media escrita en
    el HTML no debe convertirse en un enlace válido a ese archivo.
    """
    if not html or '<img' not in html.lower():
        return html

    def reemplazar(match):
        ruta = ruta_media(match.group(3))
        if not ruta or not _RUTA_IMAGEN_INFORME_RE.match(ruta):
            return match.group(0)
        url = default_storage.url(ruta)
        if request is not None:
            url = request.build_absolute_uri(url)
        return f'{match.group(1)}{match.group(2)}{url}{match.group(2)}'

    return _IMG_SRC_RE.sub(reemplazar, html)


def rutas_referenciadas(html):
    if not html:
        return set()
    return {ruta for ruta in (ruta_media(m.group(3)) for m in _IMG_SRC_RE.finditer(html)) if ruta}


def leer_imagen(src):
    """Bytes de una imagen del informe (data URI o archivo en MEDIA), o None."""
    match = _DATA_URI_RE.match(src or '')
    if match:
        try:
            return base64.b64decode(match.group('data'))
        except (binascii.Error, ValueError):
            return None
    ruta = ruta_media(src)
    if not ruta:
        return None
    try:
        with default_storage.open(ruta, 'rb') as archivo:
            return archivo.read()
    except OSError:
        return None


def extraer_imagenes_informe(informe):
    """Aplica extraer_imagenes_html a los campos del informe. Devuelve los campos cambiados."""
    carpeta = carpeta_imagenes(informe)
    cambiados = []
    for campo in CAMPOS_HTML_RICO_INFORME:
        valor = getattr(informe, campo, None)
        nuevo = extraer_imagenes_html(valor, carpeta)
        if nuevo != valor:
            setattr(informe, campo, nuevo)
            cambiados.append(campo)
    return cambiados


def limpiar_imagenes_huerfanas(informe):
    """Borra las imágenes de la carpeta que ya no usa ningún informe de ese docente y gestión."""
    from fondos.models import InformeFondo

    fondo = informe.fondo_tiempo
    carpeta = carpeta_imagenes(informe)
    try:
        _, archivos = default_storage.listdir(carpeta)
    except (FileNotFoundError, NotADirectoryError, OSError):
        return
    en_uso = set()
    informes = InformeFondo.objects.filter(
        fondo_tiempo__docente_id=fondo.docente_id, fondo_tiempo__gestion=fondo.gestion,
    ).values_list(*CAMPOS_HTML_RICO_INFORME)
    for valores in informes:
        for html in valores:
            en_uso |= rutas_referenciadas(html)
    for nombre in archivos:
        ruta = f'{carpeta}/{nombre}'
        if nombre.startswith(_PREFIJO_IMAGEN) and ruta not in en_uso:
            default_storage.delete(ruta)
