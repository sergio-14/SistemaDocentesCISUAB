"""
Entrada ASGI: la usa el servicio "realtime" (uvicorn), que atiende los WebSockets
de /ws/. La API (HTTP) la sigue atendiendo gunicorn con config.wsgi; aquí también
queda la parte HTTP para que esta misma aplicación se pueda levantar sola en local.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Django se inicializa antes de importar nada que use modelos.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402

from config.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': URLRouter(websocket_urlpatterns),
})
