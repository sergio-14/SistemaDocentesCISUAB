"""Manejador global de excepciones de la API (REST_FRAMEWORK['EXCEPTION_HANDLER']).

Los mensajes estándar de DRF ya salen en español por LANGUAGE_CODE. Aquí se corrigen
los que no: el 404 de Django (get_object_or_404 dice "No <Modelo> matches the given
query.", en inglés y con el nombre interno del modelo), el detalle del JSON mal formado
(lo arma la librería json de Python) y la lista interna en inglés de simplejwt.
"""
from django.http import Http404, JsonResponse
from django.views.defaults import page_not_found
from rest_framework import exceptions
from rest_framework.views import exception_handler
from rest_framework_simplejwt.exceptions import InvalidToken

MENSAJE_NO_ENCONTRADO = 'No se encontró el registro o no tiene acceso.'
MENSAJE_JSON_INVALIDO = 'El contenido de la petición no tiene un formato válido.'
MENSAJE_TOKEN_INVALIDO = 'La sesión no es válida o expiró. Vuelva a iniciar sesión.'


def manejador_excepciones(exc, context):
    # Un 404 no distingue "no existe" de "no es de su carrera": no revela qué registros hay.
    if isinstance(exc, (Http404, exceptions.NotFound)):
        exc = exceptions.NotFound(MENSAJE_NO_ENCONTRADO)
    elif isinstance(exc, exceptions.ParseError):
        exc = exceptions.ParseError(MENSAJE_JSON_INVALIDO)

    response = exception_handler(exc, context)

    # simplejwt agrega 'messages' (detalle por tipo de token, en inglés); basta 'detail' y
    # 'code'. Su traducción al español además va sin tildes.
    if response is not None and isinstance(response.data, dict):
        response.data.pop('messages', None)
        if isinstance(exc, InvalidToken):
            response.data['detail'] = MENSAJE_TOKEN_INVALIDO
    return response


def no_encontrado(request, exception):
    """handler404 (rutas que no existen; Django lo usa solo con DEBUG=False): bajo /api/
    responde JSON con el mismo mensaje que el resto de la API, en vez de la página HTML."""
    if request.path.startswith('/api/'):
        return JsonResponse({'detail': MENSAJE_NO_ENCONTRADO}, status=404)
    return page_not_found(request, exception)
