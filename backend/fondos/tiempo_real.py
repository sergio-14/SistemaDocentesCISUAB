"""Publicación en tiempo real: lo que pasa en la API (gunicorn) se envía por Redis a
los WebSockets del servicio "realtime" (fondos/consumers.py).

- Se publica después de confirmar en la base (transaction.on_commit): nunca se avisa
  algo que luego se deshizo.
- Si Redis no responde, la acción del usuario NO falla: se registra el error y el
  cliente se pone al día con su consulta de respaldo (/fondos-tiempo/novedades/).
"""
import asyncio
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from fondos.avisos import AVISOS, aviso_de_evento, evento_de
from fondos.consumers import GRUPO_SUPERUSUARIOS, grupo_carrera, grupo_docente
from fondos.models import HistorialFondo

logger = logging.getLogger(__name__)

# Segundos como máximo para publicar: la respuesta de la API no espera más que esto.
TIEMPO_MAXIMO_PUBLICAR = 2


def publicar(mensajes):
    """Envía [(grupo, mensaje)] a la capa de canales. Nunca lanza."""
    if not mensajes:
        return
    capa = get_channel_layer()
    if capa is None:
        return

    async def _enviar():
        await asyncio.wait_for(
            asyncio.gather(*(capa.group_send(grupo, mensaje) for grupo, mensaje in mensajes)),
            TIEMPO_MAXIMO_PUBLICAR,
        )

    try:
        async_to_sync(_enviar)()
    except Exception:  # noqa: BLE001 - el tiempo real no debe romper la API
        logger.warning('No se pudo publicar en tiempo real', exc_info=True)


def _grupo_del_papel(papel, fondo):
    if papel == 'revisor':
        # El fondo del Director lo revisa el superusuario.
        return GRUPO_SUPERUSUARIOS if fondo.es_de_director_de_su_carrera() else grupo_carrera(fondo.carrera_id, 'director')
    if papel == 'jefe':
        return grupo_carrera(fondo.carrera_id, 'jefe')
    if papel == 'docente' and fondo.docente_id:
        return grupo_docente(fondo.docente_id)
    return None


def mensajes_de_aviso(historial):
    """[(grupo, mensaje)] de un evento: un aviso por papel de la tabla de avisos.py,
    con el mismo texto que entrega /novedades/. Quien hizo la acción lo descarta
    al recibirlo (actor_id)."""
    textos = AVISOS.get(evento_de(historial))
    if not textos:
        return []
    mensajes = []
    for papel in textos:
        if papel == 'tono':
            continue
        grupo = _grupo_del_papel(papel, historial.fondo_tiempo)
        aviso = aviso_de_evento(historial, papel)
        if grupo and aviso:
            aviso = {**aviso, 'fecha': aviso['fecha'].isoformat()}
            mensajes.append((grupo, {'type': 'aviso.nuevo', 'aviso': aviso, 'actor_id': historial.usuario_id}))
    return mensajes


@receiver(post_save, sender=HistorialFondo, dispatch_uid='tiempo_real_aviso_historial')
def publicar_aviso_de_historial(sender, instance, created, **kwargs):
    if not created or not evento_de(instance):
        return
    transaction.on_commit(lambda: publicar(mensajes_de_aviso(instance)))
