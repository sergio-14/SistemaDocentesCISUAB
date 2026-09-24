"""Imágenes insertadas en el editor del Informe de Fondo de Tiempo.

El editor (InformeFormatToolbar.jsx) inserta las imágenes como data URI
(base64) dentro del HTML de cada sección. Guardarlas así hace crecer la base de
datos y los backups, así que al guardar el informe se extraen a archivos:

    media/fondos/informes/docente_<id>/gestion_<año>/imagenes/img_<hash>.<ext>

y en la BD solo queda la ruta canónica ``/media/<ruta>`` (sin firma ni dominio).

- Al leer, la ruta se convierte en una URL firmada (ver config.media) para que
  el navegador la pueda mostrar.
- Al volver a guardar, las URLs firmadas se normalizan otra vez a la ruta
  canónica; el nombre por hash evita duplicar una imagen que se reenvía.
- Las imágenes que ya no aparecen en ningún informe del docente en esa gestión
  se borran.
- El generador de PDF lee la imagen directamente del almacenamiento.
"""
import base64
import binascii
import hashlib
import re
from urllib.parse import unquote, urlsplit

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from fondos.utils.informe_texto import CAMPOS_TEXTO_INFORME

# Campos del informe que el editor puede llenar con HTML (y por tanto con <img>).
CAMPOS_HTML_INFORME = [
    'seccion_academica', 'seccion_investigacion', 'seccion_extension_interaccion',
    'seccion_asesorias_tutorias', 'seccion_academica_administrativa',
    'seccion_social_cultural_deportiva', 'conclusiones_generales',
    *CAMPOS_TEXTO_INFORME,
]

_IMG_SRC_RE = re.compile(r'(<img\b[^>]*?\bsrc\s*=\s*)(["\'])(.*?)\2', re.IGNORECASE | re.DOTALL)
_DATA_URI_RE = re.compile(r'^data:image/(png|jpe?g|gif);base64,(?P<data>.+)$', re.IGNORECASE | re.DOTALL)
_EXTENSIONES = {'png': 'png', 'jpeg': 'jpg', 'jpg': 'jpg', 'gif': 'gif'}
_PREFIJO_IMAGEN = 'img_'


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


def _guardar_data_uri(carpeta, data_uri):
    match = _DATA_URI_RE.match(data_uri)
    if not match:
        return None
    try:
        contenido = base64.b64decode(match.group('data'), validate=False)
    except (binascii.Error, ValueError):
        return None
    if not contenido:
        return None
    extension = _EXTENSIONES[match.group(1).lower()]
    ruta = f'{carpeta}/{_PREFIJO_IMAGEN}{hashlib.sha256(contenido).hexdigest()[:24]}.{extension}'
    if not default_storage.exists(ruta):
        ruta = default_storage.save(ruta, ContentFile(contenido))
    return ruta


def extraer_imagenes_html(html, carpeta):
    """Pasa a archivos las imágenes base64 y deja rutas canónicas en el HTML."""
    if not html or '<img' not in html.lower():
        return html

    def reemplazar(match):
        src = match.group(3)
        if src.startswith('data:'):
            ruta = _guardar_data_uri(carpeta, src)
        else:
            ruta = ruta_media(src)
        if not ruta:
            return match.group(0)
        return f'{match.group(1)}{match.group(2)}{_url_canonica(ruta)}{match.group(2)}'

    return _IMG_SRC_RE.sub(reemplazar, html)


def firmar_imagenes_html(html, request=None):
    """Convierte las rutas canónicas en URLs firmadas que el navegador puede cargar."""
    if not html or '<img' not in html.lower():
        return html

    def reemplazar(match):
        ruta = ruta_media(match.group(3))
        if not ruta:
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
    for campo in CAMPOS_HTML_INFORME:
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
    ).values_list(*CAMPOS_HTML_INFORME)
    for valores in informes:
        for html in valores:
            en_uso |= rutas_referenciadas(html)
    for nombre in archivos:
        ruta = f'{carpeta}/{nombre}'
        if nombre.startswith(_PREFIJO_IMAGEN) and ruta not in en_uso:
            default_storage.delete(ruta)
