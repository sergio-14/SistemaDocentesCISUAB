"""Conexión de tiempo real (WebSocket /ws/tiempo-real/, servicio "realtime").

Protocolo (JSON):
- El cliente se conecta y en el primer mensaje se autentica:
    {"tipo": "auth", "token": "<JWT de acceso>", "asignacion": <id de la asignación activa o null>}
  El token no va en la URL para que no quede en los logs de nginx. Sin autenticarse
  a tiempo, con un token inválido o vencido, se cierra con 4401; con una asignación
  que no es suya, con 4403. Si va bien responde {"tipo": "listo"}.
- Cuando el token vence se cierra con 4401: el cliente lo renueva y se reconecta.
- {"tipo": "ping"} -> {"tipo": "pong"} (mantiene viva la conexión).

Grupos: según el rol activo, como en la API (get_effective_profile con la misma
asignación que manda la cabecera X-Active-Assignment). Ver grupos_de_conexion.
"""
import asyncio
from types import SimpleNamespace

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from fondos.role_context import get_active_careers_for_user, get_effective_profile

CIERRE_NO_AUTENTICADO = 4401
CIERRE_ASIGNACION_AJENA = 4403


def grupo_carrera(carrera_id, rol):
    return f'carrera_{carrera_id}_{rol}'


def grupo_docente(docente_id):
    return f'docente_{docente_id}'


GRUPO_SUPERUSUARIOS = 'superusuarios'


class AsignacionAjena(Exception):
    """La asignación pedida no es una asignación activa del usuario."""


def grupos_de_conexion(user, asignacion_id=None):
    """Grupos a los que entra una conexión, según el rol activo (igual que la API).

    - Superusuario: 'superusuarios' (revisa el fondo del Director de cada carrera).
    - Director / Jefe de Estudios: carrera_<id>_director / carrera_<id>_jefe.
    - Docente: docente_<id> (su propio fondo).
    - Instituto: ninguno (no recibe avisos).
    """
    if user.is_superuser:
        return [GRUPO_SUPERUSUARIOS]
    if asignacion_id and not user.asignaciones_carrera.filter(id=asignacion_id, activo=True).exists():
        raise AsignacionAjena()
    peticion = SimpleNamespace(user=user, headers={'X-Active-Assignment': str(asignacion_id or '')})
    perfil = get_effective_profile(user, peticion)
    rol = getattr(perfil, 'rol', None)
    if rol in ('director', 'jefe_estudios'):
        sufijo = 'director' if rol == 'director' else 'jefe'
        return [grupo_carrera(carrera_id, sufijo) for carrera_id in get_active_careers_for_user(user, peticion).values_list('id', flat=True)]
    if rol == 'docente' and getattr(perfil, 'docente_id', None):
        return [grupo_docente(perfil.docente_id)]
    return []


def autenticar(token, asignacion_id):
    """(usuario, grupos, segundos hasta que vence el token). Lanza TokenError,
    User.DoesNotExist o AsignacionAjena."""
    acceso = AccessToken(token)
    user = User.objects.select_related('perfil').get(pk=acceso['user_id'], is_active=True)
    vence_en = acceso['exp'] - timezone.now().timestamp()
    return user, grupos_de_conexion(user, asignacion_id), vence_en


class TiempoRealConsumer(AsyncJsonWebsocketConsumer):
    # Segundos para autenticarse después de conectar.
    TIEMPO_PARA_AUTENTICAR = 10

    async def connect(self):
        self.usuario_id = None
        self.grupos = []
        self._tareas = []
        await self.accept()
        self._tareas.append(asyncio.ensure_future(self._cerrar_si_no_autentica()))

    async def disconnect(self, code):
        for tarea in self._tareas:
            tarea.cancel()
        for grupo in self.grupos:
            await self.channel_layer.group_discard(grupo, self.channel_name)

    async def receive_json(self, content, **kwargs):
        tipo = content.get('tipo') if isinstance(content, dict) else None
        if tipo == 'auth':
            await self._autenticar(content)
        elif tipo == 'ping':
            await self.send_json({'tipo': 'pong'})

    async def _autenticar(self, content):
        if self.usuario_id is not None:
            return
        try:
            user, grupos, vence_en = await database_sync_to_async(autenticar)(
                str(content.get('token') or ''), content.get('asignacion'),
            )
        except AsignacionAjena:
            await self.close(code=CIERRE_ASIGNACION_AJENA)
            return
        except (TokenError, User.DoesNotExist, KeyError):
            await self.close(code=CIERRE_NO_AUTENTICADO)
            return
        if vence_en <= 0:
            await self.close(code=CIERRE_NO_AUTENTICADO)
            return

        self.usuario_id = user.id
        self.grupos = grupos
        for grupo in grupos:
            await self.channel_layer.group_add(grupo, self.channel_name)
        self._tareas.append(asyncio.ensure_future(self._cerrar_al_vencer(vence_en)))
        await self.send_json({'tipo': 'listo'})

    # --- mensajes de los grupos (fondos/tiempo_real.py) ---
    async def aviso_nuevo(self, event):
        """Aviso de fondos/avisos.py; el de su propia acción no le llega."""
        if event.get('actor_id') == self.usuario_id:
            return
        await self.send_json({'tipo': 'aviso', 'aviso': event['aviso']})

    async def _cerrar_si_no_autentica(self):
        await asyncio.sleep(self.TIEMPO_PARA_AUTENTICAR)
        if self.usuario_id is None:
            await self.close(code=CIERRE_NO_AUTENTICADO)

    async def _cerrar_al_vencer(self, segundos):
        await asyncio.sleep(segundos)
        await self.close(code=CIERRE_NO_AUTENTICADO)
