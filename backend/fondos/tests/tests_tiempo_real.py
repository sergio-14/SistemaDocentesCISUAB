"""Tiempo real (WebSockets, servicio "realtime"): base de Channels."""
from channels.layers import get_channel_layer
from django.test import TestCase

from .websocket_prueba import ClienteWebSocket


class BaseTiempoRealTests(TestCase):
    def test_la_entrada_asgi_carga_http_y_websocket(self):
        from channels.routing import ProtocolTypeRouter
        from config.asgi import application

        self.assertIsInstance(application, ProtocolTypeRouter)
        self.assertEqual(set(application.application_mapping), {'http', 'websocket'})

    def test_sin_redis_la_capa_queda_en_memoria(self):
        self.assertEqual(type(get_channel_layer()).__name__, 'InMemoryChannelLayer')

    async def test_una_ruta_ws_desconocida_se_rechaza(self):
        from config.asgi import application

        cliente = ClienteWebSocket(application, '/ws/no-existe/')
        with self.assertRaises(ValueError):
            await cliente.conectar()
