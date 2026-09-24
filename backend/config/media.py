"""URLs firmadas y temporales para los archivos subidos (MEDIA).

El frontend muestra evidencias, actas y respaldos con <img src> / <a href>, que
no pueden enviar la cabecera Authorization del JWT. En lugar de dejar /media/
público, el almacenamiento añade a cada URL una firma con marca de tiempo
(``?t=...``) y la vista ``serve_signed_media`` solo entrega el archivo si la
firma es válida y no ha caducado (``MEDIA_URL_MAX_AGE``).

Como las URLs se generan desde el almacenamiento, cualquier FileField/ImageField
serializado por la API o mostrado en el admin sale ya firmado.
"""
from urllib.parse import quote

from django.conf import settings
from django.core import signing
from django.core.files.storage import FileSystemStorage
from django.http import Http404
from django.views.static import serve

_SALT = 'config.media.signed-url'


def _signer():
    return signing.TimestampSigner(salt=_SALT)


def firmar_ruta(name):
    """Devuelve el token (timestamp:firma) para la ruta relativa ``name``."""
    firmado = _signer().sign(name)
    return firmado[len(name) + 1:]


class SignedMediaStorage(FileSystemStorage):
    def url(self, name):
        base = super().url(name)
        if not name:
            return base
        return f'{base}?t={quote(firmar_ruta(name), safe="")}'


def serve_signed_media(request, path):
    token = request.GET.get('t', '')
    if not token:
        raise Http404
    try:
        _signer().unsign(f'{path}:{token}', max_age=settings.MEDIA_URL_MAX_AGE)
    except signing.BadSignature:
        raise Http404
    response = serve(request, path, document_root=settings.MEDIA_ROOT)
    response['Cache-Control'] = 'private, max-age=3600'
    response['X-Content-Type-Options'] = 'nosniff'
    return response
