"""Publicación en tiempo real: lo que pasa en la API (gunicorn) se envía por Redis a
los WebSockets del servicio "realtime" (fondos/consumers.py).

- Se publica después de confirmar en la base (transaction.on_commit): nunca se avisa
  algo que luego se deshizo.
- Si Redis no responde, la acción del usuario NO falla: se registra el error y el
  cliente se pone al día con su consulta de respaldo (/fondos-tiempo/novedades/).
"""
import asyncio
import json
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.serializers.json import DjangoJSONEncoder
from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from fondos.avisos import AVISOS, aviso_de_evento, evento_de
from fondos.consumers import GRUPO_SUPERUSUARIOS, grupo_carrera, grupo_chat, grupo_docente
from fondos.models import CargaHoraria, FondoTiempo, HistorialFondo, InformeFondo, MensajeObservacion, ObservacionFondo

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


# --- Chat de observaciones del fondo ---
# Las notas internas (Director <-> Jefe) van solo al grupo interno del fondo; el resto,
# al grupo del chat. Quien ve las internas está en los dos.

def _plano(datos):
    """Datos de un serializer como dict simple (fechas en texto) para la capa de canales."""
    return json.loads(json.dumps(datos, cls=DjangoJSONEncoder))


def _mensaje_chat(fondo_id, evento, datos, internos=False):
    return (grupo_chat(fondo_id, internos), {'type': 'chat.evento', 'evento': evento, 'fondo': fondo_id, 'datos': datos})


def mensajes_de_leidos(fondo_id, mensajes):
    """'leidos' por autor: el autor ve sus mensajes hasta ese id como leídos."""
    hasta = {}
    for mensaje in mensajes:
        clave = (mensaje.autor_id, mensaje.es_interno)
        hasta[clave] = max(hasta.get(clave, 0), mensaje.id)
    return [
        _mensaje_chat(fondo_id, 'leidos', {'autor': autor, 'hasta_id': hasta_id}, internos=interno)
        for (autor, interno), hasta_id in hasta.items()
    ]


def publicar_leidos(fondo_id, mensajes):
    """Para lecturas hechas con update() (sin señal), p. ej. /observaciones/novedades/."""
    if mensajes:
        transaction.on_commit(lambda: publicar(mensajes_de_leidos(fondo_id, mensajes)))


@receiver(post_save, sender=MensajeObservacion, dispatch_uid='tiempo_real_chat_mensaje')
def publicar_mensaje_de_chat(sender, instance, created, update_fields=None, **kwargs):
    fondo_id = instance.observacion.fondo_tiempo_id
    if created:
        def enviar():
            from fondos.serializers import MensajeObservacionSerializer
            datos = _plano(MensajeObservacionSerializer(instance).data)
            publicar([_mensaje_chat(fondo_id, 'mensaje', datos, internos=instance.es_interno)])
        transaction.on_commit(enviar)
    elif update_fields and 'leido_en' in update_fields and instance.leido_en:
        publicar_leidos(fondo_id, [instance])


@receiver(post_save, sender=ObservacionFondo, dispatch_uid='tiempo_real_chat_hilo')
def publicar_hilo_de_chat(sender, instance, **kwargs):
    """Hilo creado (observar) o resuelto: va antes que sus mensajes (mismo orden de commit)."""
    def enviar():
        from fondos.serializers import HiloObservacionSerializer
        publicar([_mensaje_chat(instance.fondo_tiempo_id, 'hilo', _plano(HiloObservacionSerializer(instance).data))])
    transaction.on_commit(enviar)


# --- Fondo actualizado: la lista y el detalle se vuelven a pedir ---
# Cualquier cambio del fondo (estado, cargas, informe, observaciones; también crearlo,
# archivarlo o borrarlo) se avisa a quien lo ve, en lugar de consultar cada tanto.
# Varios eventos seguidos del mismo fondo los junta el frontend.

def grupos_que_ven_el_fondo(fondo):
    """Los mismos alcances que la lista: Jefe, Instituto y superusuario de la carrera;
    el Director, salvo los borradores ajenos; el docente, el suyo."""
    grupos = [grupo_carrera(fondo.carrera_id, 'jefe'), grupo_carrera(fondo.carrera_id, 'instituto'), GRUPO_SUPERUSUARIOS]
    if fondo.estado != 'borrador' or fondo.es_de_director_de_su_carrera():
        grupos.append(grupo_carrera(fondo.carrera_id, 'director'))
    if fondo.docente_id:
        grupos.append(grupo_docente(fondo.docente_id))
    return grupos


def mensajes_de_fondo_actualizado(fondo):
    return [(grupo, {'type': 'fondo.actualizado', 'fondo': fondo.pk}) for grupo in grupos_que_ven_el_fondo(fondo)]


def avisar_fondo_actualizado(fondo_id, eliminado=None):
    """Al confirmarse, con el fondo como quedó (o el eliminado, tal como era)."""
    def enviar():
        fondo = eliminado or FondoTiempo.objects.filter(pk=fondo_id).first()
        if fondo:
            publicar(mensajes_de_fondo_actualizado(fondo))
    transaction.on_commit(enviar)


@receiver(post_save, sender=FondoTiempo, dispatch_uid='tiempo_real_fondo_guardado')
def fondo_guardado(sender, instance, **kwargs):
    avisar_fondo_actualizado(instance.pk)


@receiver(post_delete, sender=FondoTiempo, dispatch_uid='tiempo_real_fondo_eliminado')
def fondo_eliminado(sender, instance, **kwargs):
    avisar_fondo_actualizado(instance.pk, eliminado=instance)


@receiver(post_save, sender=CargaHoraria, dispatch_uid='tiempo_real_carga_guardada')
@receiver(post_delete, sender=CargaHoraria, dispatch_uid='tiempo_real_carga_eliminada')
def carga_cambiada(sender, instance, **kwargs):
    if instance.fondo_id:
        avisar_fondo_actualizado(instance.fondo_id)


@receiver(post_save, sender=InformeFondo, dispatch_uid='tiempo_real_informe_guardado')
@receiver(post_save, sender=ObservacionFondo, dispatch_uid='tiempo_real_observacion_fondo')
def informe_u_observacion_cambiada(sender, instance, **kwargs):
    avisar_fondo_actualizado(instance.fondo_tiempo_id)
