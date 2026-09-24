"""Endpoint de salud para el healthcheck de Docker.

Solo es accesible desde la red interna: nginx no reenvía /health/ al backend.
Comprueba que Django responde y que la base de datos acepta conexiones.
"""
from django.db import connection
from django.http import JsonResponse


def health(request):
    try:
        connection.ensure_connection()
    except Exception:
        return JsonResponse({'status': 'error', 'db': 'no disponible'}, status=503)
    return JsonResponse({'status': 'ok'})
