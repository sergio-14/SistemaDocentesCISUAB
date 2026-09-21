from types import SimpleNamespace

from .models import Carrera


def get_active_assignment(request):
    if not request or not getattr(request, 'user', None) or not request.user.is_authenticated:
        return None

    user = request.user
    if user.is_superuser or not hasattr(user, 'asignaciones_carrera'):
        return None

    assignment_id = request.headers.get('X-Active-Assignment')
    active_role = request.headers.get('X-Active-Role')
    active_carrera = request.headers.get('X-Active-Carrera')

    queryset = user.asignaciones_carrera.filter(activo=True).select_related('carrera', 'docente')

    if assignment_id:
        assignment = queryset.filter(id=assignment_id).first()
        if assignment:
            return assignment

    if active_role and active_carrera:
        return queryset.filter(rol=active_role, carrera_id=active_carrera).first()

    return None


def serialize_assignment(assignment):
    if not assignment:
        return None

    return {
        'id': assignment.id,
        'rol': assignment.rol,
        'rol_display': assignment.get_rol_display(),
        'carrera': assignment.carrera_id,
        'carrera_nombre': assignment.carrera.nombre if assignment.carrera else None,
        'carrera_codigo': assignment.carrera.codigo if assignment.carrera else None,
        'docente': assignment.docente_id,
        'docente_nombre': assignment.docente.nombre_completo if assignment.docente else None,
        'activo': assignment.activo,
    }


def get_effective_profile(user, request=None):
    perfil = getattr(user, 'perfil', None)
    if not perfil:
        return None

    assignment = get_active_assignment(request)
    if not assignment:
        return perfil

    return SimpleNamespace(
        id=perfil.id,
        user=perfil.user,
        user_id=perfil.user_id,
        rol=assignment.rol,
        carrera=assignment.carrera,
        carrera_id=assignment.carrera_id,
        docente=assignment.docente or perfil.docente,
        docente_id=assignment.docente_id or perfil.docente_id,
        activo=perfil.activo,
        perfil_original=perfil,
        asignacion_activa=assignment,
    )


def get_active_careers_for_user(user, request=None):
    if not user or not user.is_authenticated:
        return Carrera.objects.none()

    if user.is_superuser:
        return Carrera.objects.filter(activo=True)

    assignment = get_active_assignment(request)
    if assignment and assignment.carrera_id:
        return Carrera.objects.filter(id=assignment.carrera_id, activo=True)

    perfil = getattr(user, 'perfil', None)
    if not perfil:
        return Carrera.objects.none()

    carreras = perfil.get_carreras_activas() if hasattr(perfil, 'get_carreras_activas') else Carrera.objects.none()
    if carreras.exists():
        return carreras

    if perfil.carrera_id:
        return Carrera.objects.filter(id=perfil.carrera_id)

    return Carrera.objects.none()

