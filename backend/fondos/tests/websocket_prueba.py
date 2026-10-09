"""Cliente WebSocket para los tests, sin daphne.

channels.testing.WebsocketCommunicator importa daphne (y con él Twisted) solo por
otra clase del mismo paquete; esto es lo mismo sobre asgiref, que ya viene con Django.
"""
import json

from asgiref.testing import ApplicationCommunicator


class ClienteWebSocket(ApplicationCommunicator):
    def __init__(self, application, ruta, headers=None):
        super().__init__(application, {
            'type': 'websocket',
            'path': ruta,
            'raw_path': ruta.encode(),
            'query_string': b'',
            'headers': headers or [(b'host', b'localhost'), (b'origin', b'http://localhost')],
            'subprotocols': [],
            'client': ('127.0.0.1', 12345),
            'server': ('localhost', 80),
        })

    async def conectar(self, timeout=2):
        """True si el servidor aceptó la conexión."""
        await self.send_input({'type': 'websocket.connect'})
        respuesta = await self.receive_output(timeout)
        return respuesta['type'] == 'websocket.accept'

    async def enviar(self, datos):
        await self.send_input({'type': 'websocket.receive', 'text': json.dumps(datos)})

    async def recibir(self, timeout=2):
        """El próximo mensaje (dict), o {'cerrado': código} si el servidor cerró."""
        respuesta = await self.receive_output(timeout)
        if respuesta['type'] == 'websocket.close':
            return {'cerrado': respuesta.get('code')}
        return json.loads(respuesta['text'])

    async def nada_pendiente(self, timeout=0.3):
        return await self.receive_nothing(timeout)

    async def desconectar(self, codigo=1000):
        await self.send_input({'type': 'websocket.disconnect', 'code': codigo})
        await self.wait(1)
