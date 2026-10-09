"""Avisos del Fondo de Tiempo: quién se entera de cada cambio de estado y con qué texto.

Cada cambio de estado de un fondo queda en HistorialFondo (estado anterior y nuevo);
cada uno de esos registros es un evento. Aquí se decide, para el usuario y su rol
activo, qué eventos le corresponden y qué dice el aviso. Es el único lugar con esa
lógica y esos textos: hoy los entrega la consulta periódica
(GET /fondos-tiempo/novedades/) y mañana puede entregarlos un WebSocket con
avisos_para_usuario o aviso_de_evento, sin rehacer nada.

Quién recibe:
- revisor: el Director de la carrera; en el fondo del propio Director, el superusuario.
- jefe: el Jefe de Estudios de la carrera.
- docente: el docente dueño del fondo.
El Instituto no recibe avisos y nadie recibe el aviso de lo que hizo él mismo.
"""
from datetime import timedelta

from django.db.models import Max
from django.utils import timezone

from fondos.models import HistorialFondo

# Tono del toast: 'aviso' (celeste), 'exito' (verde) o 'atencion' (rojo suave).
AVISOS = {
    'fondo_presentado': {
        'tono': 'aviso',
        'revisor': 'Nuevo fondo para revisar: {docente} (gestión {gestion}).',
    },
    'fondo_observado': {
        'tono': 'atencion',
        'jefe': 'El fondo de {docente} recibió observaciones.',
        'docente': 'Tu fondo de tiempo recibió observaciones.',
    },
    'fondo_rechazado': {
        'tono': 'atencion',
        'jefe': 'El fondo de {docente} fue rechazado.',
        'docente': 'Tu fondo de tiempo fue rechazado.',
    },
    'fondo_aprobado': {
        'tono': 'exito',
        'jefe': 'El fondo de {docente} fue aprobado.',
        'docente': 'Tu fondo de tiempo fue aprobado.',
    },
    'ejecucion_iniciada': {
        'tono': 'exito',
        'jefe': 'El fondo de {docente} está en ejecución.',
        'docente': 'Tu fondo está en ejecución. Ya puedes redactar tu informe.',
    },
    'informe_presentado': {
        'tono': 'aviso',
        'revisor': '{docente} presentó su informe para evaluar.',
        'jefe': '{docente} presentó su informe.',
    },
    'informe_observado': {
        'tono': 'atencion',
        'docente': 'Tu informe fue observado. Revisa las correcciones y vuelve a presentarlo.',
        'jefe': 'El informe de {docente} fue observado.',
    },
    'fondo_finalizado': {
        'tono': 'exito',
        'docente': 'Tu fondo fue finalizado. Cumplimiento: {nivel}.',
        'jefe': 'El fondo de {docente} fue finalizado.',
    },
}

# Estados a los que llega un fondo en algún evento con aviso (para filtrar en la BD).
ESTADOS_CON_AVISO = [
    'presentado_director', 'observado', 'rechazado', 'aprobado_director',
    'en_ejecucion', 'informe_presentado', 'finalizado',
]

# Sin cursor (primera consulta en ese navegador) se entregan los de las últimas horas.
HORAS_SIN_CURSOR = 24
MAXIMO_AVISOS = 20


def evento_de(historial):
    """Evento de un registro del historial, o None si ese cambio no tiene aviso."""
    nuevo, anterior = historial.estado_nuevo, historial.estado_anterior
    if nuevo == 'en_ejecucion':
        # A ejecución se llega al iniciarla o cuando el Director observa el informe.
        return {'aprobado_director': 'ejecucion_iniciada', 'informe_presentado': 'informe_observado'}.get(anterior)
    return {
        'presentado_director': 'fondo_presentado',
        'observado': 'fondo_observado',
        'rechazado': 'fondo_rechazado',
        'aprobado_director': 'fondo_aprobado',
        'informe_presentado': 'informe_presentado',
        'finalizado': 'fondo_finalizado',
    }.get(nuevo)


def destinatario(user, perfil, fondo):
    """Papel del usuario frente al fondo ('revisor', 'jefe', 'docente') o None. Se
    asume que el fondo ya está en el alcance de su rol activo (get_queryset)."""
    if user.is_superuser:
        return 'revisor' if fondo.es_de_director_de_su_carrera() else None
    rol = getattr(perfil, 'rol', None)
    if rol == 'director':
        return None if fondo.es_de_director_de_su_carrera() else 'revisor'
    if rol == 'jefe_estudios':
        return 'jefe'
    if rol == 'docente' and perfil.docente_id and fondo.docente_id == perfil.docente_id:
        return 'docente'
    return None


def _nivel_cumplimiento(fondo):
    informe = fondo.informes.filter(tipo='parcial').order_by('-fecha_elaboracion').first()
    return informe.get_cumplimiento_display() if informe and informe.cumplimiento else 'sin registrar'


def aviso_de_evento(historial, papel):
    """El aviso de un evento para ese papel: dict listo para el frontend, o None."""
    evento = evento_de(historial)
    textos = AVISOS.get(evento)
    if not textos or papel not in textos:
        return None
    fondo = historial.fondo_tiempo
    datos = {
        'docente': fondo.docente.nombre_completo if fondo.docente else 'el docente',
        'gestion': fondo.gestion,
        'nivel': _nivel_cumplimiento(fondo) if evento == 'fondo_finalizado' else '',
    }
    return {
        'id': historial.id,
        'evento': evento,
        'fondo_id': fondo.id,
        'texto': textos[papel].format(**datos),
        'tono': textos['tono'],
        'fecha': historial.fecha,
    }


def avisos_para_usuario(user, perfil, fondos_visibles, desde=None):
    """(avisos, ultimo_id): los avisos nuevos para el usuario en su rol activo.

    fondos_visibles: queryset de los fondos a su alcance (el mismo de la lista).
    desde: id del último evento ya visto; sin él, los de las últimas HORAS_SIN_CURSOR.
    ultimo_id: el cursor para la próxima consulta (el último evento que existe).
    """
    ultimo_id = HistorialFondo.objects.aggregate(maximo=Max('id'))['maximo'] or 0
    if getattr(perfil, 'rol', None) == 'iiisyp' and not user.is_superuser:
        return [], ultimo_id

    eventos = HistorialFondo.objects.filter(
        fondo_tiempo__in=fondos_visibles, estado_nuevo__in=ESTADOS_CON_AVISO,
    ).exclude(usuario=user).select_related('fondo_tiempo__docente', 'fondo_tiempo__carrera')
    if desde is None:
        eventos = eventos.filter(fecha__gte=timezone.now() - timedelta(hours=HORAS_SIN_CURSOR))
    else:
        eventos = eventos.filter(id__gt=desde)

    avisos = []
    for historial in eventos.order_by('id'):
        papel = destinatario(user, perfil, historial.fondo_tiempo)
        aviso = aviso_de_evento(historial, papel) if papel else None
        if aviso:
            avisos.append(aviso)
    return avisos[-MAXIMO_AVISOS:], ultimo_id
