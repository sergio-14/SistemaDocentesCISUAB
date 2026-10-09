"""Rutas de WebSocket (servicio "realtime"). Todas bajo /ws/, que nginx envía a realtime.

Sin AllowedHostsOriginValidator: la conexión se autentica con el JWT en el primer
mensaje (no con cookies), así que otra página no puede usar la sesión del usuario.
"""
from django.urls import path

from fondos.consumers import TiempoRealConsumer

websocket_urlpatterns = [
    path('ws/tiempo-real/', TiempoRealConsumer.as_asgi()),
]
