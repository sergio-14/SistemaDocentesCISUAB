"""Quién trabaja un fondo (rol activo). Lo usan las vistas y los indicadores del serializer,
para que la API y los botones del frontend sigan la misma regla. Sale de los fondos e
informes reales de la carrera (2024) y de la plantilla general de 2023:

- El Jefe de Estudios crea los fondos y asigna las materias (clases en aula) de cada
  docente (Art. 9: Jefatura implanta el control).
- El docente dueño elabora su fondo: distribuye el resto de sus horas en las 7 unidades,
  sube los programas analíticos y los documentos de sus proyectos, lo presenta al Director,
  lo corrige si está observado y lo devuelve a borrador si fue rechazado (Arts. 14 y 18; en
  la práctica cada docente arma, firma y entrega su fondo). También redacta su informe.
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


def es_docente_del_fondo(request, fondo):
    """Docente dueño del fondo trabajando con su rol de docente (rol activo)."""
    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated or user.is_superuser or not fondo.docente_id:
        return False
    perfil = get_effective_profile(user, request)
    return bool(perfil and perfil.rol == 'docente' and perfil.docente_id == fondo.docente_id)


def docente_tiene_cuenta(fondo):
    """True si el docente del fondo tiene una cuenta activa con la que trabaja como docente
    (asignación activa de docente o perfil de docente)."""
    from .models import AsignacionCarrera, PerfilUsuario, usuarios_del_docente
    if not fondo.docente_id:
        return False
    ids = usuarios_del_docente(fondo.docente)
    return (
        AsignacionCarrera.objects.filter(user_id__in=ids, user__is_active=True, rol='docente', activo=True).exists()
        or PerfilUsuario.objects.filter(user_id__in=ids, user__is_active=True, rol='docente').exists()
    )


def jefatura_trabaja_el_fondo(request, fondo):
    """El docente que no tiene cuenta en el sistema no puede elaborar su fondo: lo elabora y lo
    presenta el Jefe de Estudios de su carrera (Art. 9: Jefatura implanta el control)."""
    return es_jefatura_del_fondo(request, fondo) and not docente_tiene_cuenta(fondo)


def trabaja_el_fondo(request, fondo):
    """Quien elabora el fondo (distribución, programas, documentos, presentarlo, corregirlo):
    el docente dueño; si no tiene cuenta, el Jefe de Estudios de la carrera."""
    return es_docente_del_fondo(request, fondo) or jefatura_trabaja_el_fondo(request, fondo)


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
