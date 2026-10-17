"""Datos de Mi cuenta (solo lectura, siempre del usuario autenticado): último ingreso, sus
designaciones de cargo y, si tiene ficha de docente, su fondo de la gestión actual, las
carreras donde dicta y los próximos plazos de su gestión."""
from django.db.models import Q
from django.utils import timezone

from .models import CalendarioAcademico, Docente, DocenteCarrera, FondoTiempo, nombre_calendario_en_fondo
from .serializers import FondoTiempoListSerializer

CARGOS = ('director', 'jefe_estudios', 'iiisyp')


def _designaciones(user):
    asignaciones = user.asignaciones_carrera.filter(activo=True, rol__in=CARGOS).select_related('carrera').order_by('id')
    return [{
        'id': asignacion.id,
        'rol': asignacion.rol,
        'rol_display': asignacion.get_rol_display(),
        'carrera': asignacion.carrera_id,
        'carrera_nombre': asignacion.carrera.nombre if asignacion.carrera else None,
        'desde': timezone.localdate(asignacion.fecha_creacion).isoformat(),
        'resolucion_consejo': asignacion.resolucion_consejo.url if asignacion.resolucion_consejo else None,
    } for asignacion in asignaciones]


def _carreras_donde_dicta(fondo):
    """Materias del fondo agrupadas por la carrera de la materia (la propia primero)."""
    from .utils.pdf_generator import _capitalizar  # como en el PDF: "Civil"
    carreras = {}
    cargas = fondo.cargas.filter(materia__isnull=False).select_related('materia__carrera')
    for carga in cargas.order_by('materia__nombre'):
        materia = carga.materia
        carrera = carreras.setdefault(materia.carrera_id, {
            'carrera': _capitalizar(materia.carrera.nombre),
            'propia': materia.carrera_id == fondo.carrera_id,
            'materias': [],
        })
        if not any(m['sigla'] == materia.sigla for m in carrera['materias']):
            carrera['materias'].append({'sigla': materia.sigla, 'nombre': materia.nombre})
    return sorted(carreras.values(), key=lambda c: (not c['propia'], c['carrera']))


def _proximos_plazos(calendarios, fondo, hoy):
    """Plazos de presentación (programas analíticos y proyectos) que aún no vencieron."""
    nombres = dict(FondoTiempo.PLAZOS_PRESENTACION)
    plazos = []
    for calendario in calendarios.select_related('carrera'):
        for campo, plazo in nombres.items():
            limite = getattr(calendario, campo)
            if limite and limite >= hoy:
                plazos.append({
                    'plazo': plazo,
                    'calendario': (nombre_calendario_en_fondo(calendario, fondo) if fondo
                                   else f'{calendario.get_periodo_display()} {calendario.gestion}'),
                    'fecha': limite.isoformat(),
                })
    return sorted(plazos, key=lambda p: (p['fecha'], p['plazo']))


def _datos_docente(docente, hoy):
    gestion = hoy.year
    fondo = (FondoTiempo.objects.filter(docente=docente, gestion=gestion, archivado=False)
             .select_related('docente', 'carrera').order_by('id').first())
    if fondo:
        calendarios = CalendarioAcademico.objects.filter(
            Q(carrera_id=fondo.carrera_id, gestion=gestion)
            | Q(pk__in=fondo.cargas.filter(calendario__isnull=False).values('calendario'))
        )
    else:
        carreras = DocenteCarrera.objects.filter(docente=docente, activo=True).values('carrera')
        calendarios = CalendarioAcademico.objects.filter(carrera__in=carreras, gestion=gestion)
    return {
        'id': docente.id,
        'fondo_actual': FondoTiempoListSerializer(fondo).data if fondo else None,
        'carreras_donde_dicta': _carreras_donde_dicta(fondo) if fondo else [],
        'proximos_plazos': _proximos_plazos(calendarios, fondo, hoy),
    }


def datos_mi_cuenta(user, hoy=None):
    hoy = hoy or timezone.localdate()
    docente = Docente.objects.filter(user=user).first()
    return {
        'gestion_actual': hoy.year,
        'ultimo_ingreso': user.last_login,
        'cuenta_creada': user.date_joined,
        'designaciones': _designaciones(user),
        'docente': _datos_docente(docente, hoy) if docente else None,
    }
