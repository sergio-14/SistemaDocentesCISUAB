"""Quién trabaja un fondo (rol activo). Lo usan las vistas y los indicadores del serializer,
para que la API y los botones del frontend sigan la misma regla:

- El fondo (carga horaria, programas y documentos, presentarlo al Director, corregirlo si
  está observado, devolverlo a borrador) lo trabaja el Jefe de Estudios de su carrera.
- El informe lo redacta y presenta el docente dueño (FondoTiempo.puede_redactar_informe).
- El superusuario y el Director no hacen nada de eso en lugar de otro: revisan, evalúan y
  finalizan (el superusuario, los fondos de los Directores, Art. 28) y lo ven en solo lectura.
"""
from .role_context import get_active_careers_for_user, get_effective_profile


def tiene_rol_en_carrera(request, rol, carrera_id):
    """True si el usuario trabaja con ``rol`` (rol activo) en la carrera dada."""
    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated or user.is_superuser:
        return False
    perfil = get_effective_profile(user, request)
    return bool(
        perfil and perfil.rol == rol
        and get_active_careers_for_user(user, request).filter(pk=carrera_id).exists()
    )


def es_jefatura_del_fondo(request, fondo):
    """Jefe de Estudios (rol activo) de la carrera del fondo."""
    return tiene_rol_en_carrera(request, 'jefe_estudios', fondo.carrera_id)


def es_revisor_del_fondo(request, fondo):
    """Quien aprueba, observa, evalúa y finaliza: nadie su propio fondo; el del Director de
    la carrera, el superusuario; el resto, el Director (rol activo) de la carrera."""
    user = request.user
    if fondo.pertenece_a(user):
        return False
    if fondo.es_de_director_de_su_carrera():
        return user.is_superuser
    return tiene_rol_en_carrera(request, 'director', fondo.carrera_id)


def puede_escribir_observaciones(request, fondo):
    """En el chat del fondo escriben el docente dueño, su revisor y Jefatura de la carrera."""
    return (
        fondo.pertenece_a(request.user)
        or es_revisor_del_fondo(request, fondo)
        or es_jefatura_del_fondo(request, fondo)
    )


def puede_resolver_observaciones(request, fondo):
    """Marcan una observación como resuelta el docente dueño y Jefatura de la carrera."""
    return fondo.pertenece_a(request.user) or es_jefatura_del_fondo(request, fondo)
