import re

from rest_framework import serializers
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import Docente, DocenteCarrera, Carrera, Materia, FondoTiempo, CategoriaFuncion, Actividad, PerfilUsuario, AsignacionCarrera, InformeFondo, InformeAsignaturaEjecutada, ObservacionFondo, MensajeObservacion, HistorialFondo, CargaHoraria, SaldoVacacionesGestion, DatosLaborales, EvidenciaCargaHoraria
from .role_context import get_active_assignment, get_effective_profile, serialize_assignment
from .utils.informe_texto import construir_defaults_informe, CAMPOS_TEXTO_INFORME
from django.db.models import Sum
from django.db import transaction
from decimal import Decimal
from django.utils import timezone
    
SEMANAS_CLASES_AULA = Decimal('40')

CARGA_HORARIA_TIPOS_POR_CATEGORIA = {
    'academica': [
        'cursos_verano',
        'preparacion_temas',
        'elaboracion_trabajos_practicos',
        'revision_calificacion_trabajos_practicos',
        'elaboracion_examenes',
        'revision_calificacion_examenes',
        'practica_laboratorios_centro_computo',
        'practicas_campo',
        'produccion_docente_textos_guias',
        'consultas_reclamos_calificaciones',
        'clases_aula',
        'elaboracion_planillas_introduccion_notas_moxos',
        'planificacion_gestion_practica_extra_aula',
        'ejecucion_practica_extra_aula',
        'informe_descargo_viaje_practicas_extra_aula',
    ],
    'investigacion': [
        'participacion_iic_cis',
        'organizacion_eventos_cientificos',
        'elaboracion_trabajos_investigacion',
    ],
    'extension_universitaria': [
        'proyectos_extension',
        'tareas_proyectos_extension_interaccion',
        'cursos',
        'seminarios',
        'talleres',
        'conferencias',
        'jornadas',
        'videoconferencias',
        'asistencia_tecnica',
        'voluntariado',
    ],
    'interaccion_social': [
        'proyectos_interaccion',
        'tareas_proyectos_extension_interaccion',
        'participacion_ferias_campanas_jornadas',
        'proyectos_sociales',
        'ferias',
        'campanas',
        'jornadas',
        'tribunal_externo',
        'capacitacion_externa',
    ],
    'gestion': [
        'modalidad_graduacion',
        'reuniones',
        'coordinacion',
        'convenios',
        'politicas_academicas',
    ],
    'academica_administrativa': [
        'auxiliares_docencia',
        'examenes_mesa',
        'otras_comisiones_academicas',
        'logistica_carrera',
        'difusion_perfil_profesional',
        'caac',
        'comision_innovacion_curricular',
        'poa',
        'programas_analiticos',
    ],
    'social_cultural_deportiva': [
        'acto_academico_facultativo',
        'acto_academico_universitario',
        'participacion_actividades_culturales_sociales_deportivas',
        'aniversarios',
        'entrada_folclorica',
        'campeonatos_deportivos',
        'concursos',
        'eventos_culturales',
        'desfile_6_agosto',
        'desfile_18_noviembre',
        'claustros_universitarios',
        'asociacion_docente',
        'capacitacion_complementaria',
        'orientacion_vocacional',
    ],
}

CARGA_HORARIA_TIPOS_LABELS = {
    'cursos_verano': 'Cursos de verano',
    'preparacion_temas': 'Preparaci\u00f3n de temas',
    'elaboracion_trabajos_practicos': 'Elaboraci\u00f3n de Trabajos Pr\u00e1cticos',
    'revision_calificacion_trabajos_practicos': 'Revisi\u00f3n y Calificaci\u00f3n de Trabajos Pr\u00e1cticos',
    'elaboracion_examenes': 'Elaboraci\u00f3n de Ex\u00e1menes',
    'revision_calificacion_examenes': 'Revisi\u00f3n y Calificaci\u00f3n de Ex\u00e1menes',
    'practica_laboratorios_centro_computo': 'Pr\u00e1ctica de Laboratorios (Centro de C\u00f3mputo)',
    'practicas_campo': 'Pr\u00e1cticas de Campo',
    'produccion_docente_textos_guias': 'Producci\u00f3n docente (textos gu\u00edas)',
    'consultas_reclamos_calificaciones': 'Consultas y Reclamos de Calificaciones',
    'clases_aula': 'Clases en aula',
    'elaboracion_planillas_introduccion_notas_moxos': 'Elaboraci\u00f3n de planillas e Introducci\u00f3n de notas al sistema moxos',
    'planificacion_gestion_practica_extra_aula': 'Planificaci\u00f3n y gesti\u00f3n de pr\u00e1ctica extra aula',
    'ejecucion_practica_extra_aula': 'Ejecuci\u00f3n de pr\u00e1ctica extra aula',
    'informe_descargo_viaje_practicas_extra_aula': 'Informe de descargo de viaje en las pr\u00e1cticas extra aula',
    'participacion_iic_cis': 'Participaci\u00f3n IIC-CIS',
    'organizacion_eventos_cientificos': 'Organizaci\u00f3n eventos cient\u00edficos',
    'elaboracion_trabajos_investigacion': 'Elaboraci\u00f3n trabajos investigaci\u00f3n',
    'proyectos_extension': 'Proyectos de extensi\u00f3n',
    'tareas_proyectos_extension_interaccion': 'Tareas en proyectos de extensi\u00f3n e interacci\u00f3n',
    'cursos': 'Cursos',
    'seminarios': 'Seminarios',
    'talleres': 'Talleres',
    'conferencias': 'Conferencias',
    'jornadas': 'Jornadas',
    'videoconferencias': 'Videoconferencias',
    'asistencia_tecnica': 'Asistencia t\u00e9cnica',
    'voluntariado': 'Voluntariado',
    'proyectos_interaccion': 'Proyectos de interacci\u00f3n',
    'participacion_ferias_campanas_jornadas': 'Participaci\u00f3n en ferias, campa\u00f1as, jornadas',
    'proyectos_sociales': 'Proyectos sociales',
    'ferias': 'Ferias',
    'campanas': 'Campa\u00f1as',
    'tribunal_externo': 'Tribunal externo',
    'capacitacion_externa': 'Capacitaci\u00f3n externa',
    'modalidad_graduacion': 'Modalidad de Graduaci\u00f3n',
    'reuniones': 'Reuniones',
    'coordinacion': 'Coordinaci\u00f3n',
    'convenios': 'Convenios',
    'politicas_academicas': 'Pol\u00edticas acad\u00e9micas',
    'auxiliares_docencia': 'Auxiliares de docencia',
    'examenes_mesa': 'Ex\u00e1menes de mesa',
    'otras_comisiones_academicas': 'Otras comisiones acad\u00e9micas',
    'logistica_carrera': 'Log\u00edstica carrera',
    'difusion_perfil_profesional': 'Difusi\u00f3n perfil profesional',
    'caac': 'CAAC',
    'comision_innovacion_curricular': 'Comisi\u00f3n Innovaci\u00f3n Curricular',
    'poa': 'POA',
    'programas_analiticos': 'Programas anal\u00edticos',
    'acto_academico_facultativo': 'Acto acad\u00e9mico facultativo',
    'acto_academico_universitario': 'Acto acad\u00e9mico universitario',
    'participacion_actividades_culturales_sociales_deportivas': 'Participaci\u00f3n de actividades culturales, sociales y deportivas',
    'aniversarios': 'Aniversarios',
    'entrada_folclorica': 'Entrada folcl\u00f3rica',
    'campeonatos_deportivos': 'Campeonatos deportivos',
    'concursos': 'Concursos',
    'eventos_culturales': 'Eventos culturales',
    'desfile_6_agosto': 'Desfile 6 agosto',
    'desfile_18_noviembre': 'Desfile 18 noviembre',
    'claustros_universitarios': 'Claustros universitarios',
    'asociacion_docente': 'Asociaci\u00f3n Docente',
    'capacitacion_complementaria': 'Capacitaci\u00f3n complementaria',
    'orientacion_vocacional': 'Orientaci\u00f3n Vocacional',
}

CARGA_HORARIA_EVIDENCIAS_ACADEMICAS = {
    'preparacion_temas': 'Plan de clases, material de apoyo',
    'elaboracion_trabajos_practicos': 'Enunciados de trabajos pr\u00e1cticos, r\u00fabricas',
    'revision_calificacion_trabajos_practicos': 'Actas de calificaci\u00f3n, retroalimentaci\u00f3n',
    'elaboracion_examenes': 'Bancos de preguntas, ex\u00e1menes impresos',
    'revision_calificacion_examenes': 'Actas de notas, estad\u00edsticas',
    'practica_laboratorios_centro_computo': 'Gu\u00edas de laboratorio, registros de asistencia',
    'practicas_campo': 'Informes de campo, fotos, actas',
    'produccion_docente_textos_guias': 'Textos gu\u00edas publicados, material did\u00e1ctico',
    'consultas_reclamos_calificaciones': 'Registro de consultas, actas de revisi\u00f3n',
    'planificacion_gestion_practica_extra_aula': 'Plan de trabajo, cronograma',
    'ejecucion_practica_extra_aula': 'Informes de pr\u00e1ctica, evidencias fotogr\u00e1ficas',
    'cursos_verano': 'Programa del curso, lista de estudiantes',
    'clases_aula': 'Programa anal\u00edtico, plan de clases, actas de notas, registros de asistencia',
    'elaboracion_planillas_introduccion_notas_moxos': 'Capturas de pantalla del sistema, actas de notas',
    'informe_descargo_viaje_practicas_extra_aula': 'Informe de descargo, boletas o facturas de viaje',
}

CARGA_HORARIA_EVIDENCIAS_INVESTIGACION = {
    'participacion_iic_cis': 'Memor\u00e1ndum o certificado de participaci\u00f3n en el IIC-CIS, informe de actividades',
    'organizacion_eventos_cientificos': 'Programa del evento cient\u00edfico, fotograf\u00edas, lista de asistentes',
    'elaboracion_trabajos_investigacion': 'Productos de investigaci\u00f3n, informes de avance, art\u00edculos publicados',
}

CARGA_HORARIA_EVIDENCIAS_EXTENSION_UNIVERSITARIA = {
    'proyectos_extension': 'Informe del proyecto de extensi\u00f3n, productos de extensi\u00f3n',
    'tareas_proyectos_extension_interaccion': 'Registro de tareas, informe de avance del proyecto',
    'cursos': 'Programa del curso, lista de asistencia, certificados emitidos',
    'seminarios': 'Programa del seminario, lista de asistencia, memoria del evento',
    'talleres': 'Programa del taller, lista de asistencia, material entregado',
    'conferencias': 'Programa de la conferencia, fotograf\u00edas, lista de asistencia',
    'jornadas': 'Programa de la jornada, lista de asistencia, informe de resultados',
    'videoconferencias': 'Grabaci\u00f3n o enlace de la videoconferencia, lista de participantes',
    'asistencia_tecnica': 'Informe de asistencia t\u00e9cnica, solicitud atendida',
    'voluntariado': 'Certificado de voluntariado, informe de actividades realizadas',
}

CARGA_HORARIA_EVIDENCIAS_INTERACCION_SOCIAL = {
    'proyectos_interaccion': 'Informe del proyecto de interacci\u00f3n social, productos generados',
    'tareas_proyectos_extension_interaccion': 'Registro de tareas, informe de impacto social',
    'participacion_ferias_campanas_jornadas': 'Informes de impacto social, fotograf\u00edas, actas de participaci\u00f3n',
    'proyectos_sociales': 'Informe del proyecto social, fotograf\u00edas, actas',
    'ferias': 'Fotograf\u00edas, lista de asistencia, informe de la feria',
    'campanas': 'Material de la campa\u00f1a, fotograf\u00edas, informe de resultados',
    'tribunal_externo': 'Memor\u00e1ndum de designaci\u00f3n, acta de calificaci\u00f3n',
    'capacitacion_externa': 'Certificado de capacitaci\u00f3n, programa del curso',
}

CARGA_HORARIA_EVIDENCIAS_GESTION = {
    'modalidad_graduacion': 'Memor\u00e1ndum de designaci\u00f3n, acta de defensa o resoluci\u00f3n de aprobaci\u00f3n',
    'reuniones': 'Convocatoria, acta de reuni\u00f3n y lista de asistencia',
    'coordinacion': 'Memor\u00e1ndums de coordinaci\u00f3n, informes de seguimiento',
    'convenios': 'Documento del convenio firmado, resoluci\u00f3n de aprobaci\u00f3n',
    'politicas_academicas': 'Documento de pol\u00edtica acad\u00e9mica, resoluci\u00f3n de aprobaci\u00f3n',
}

CARGA_HORARIA_EVIDENCIAS_ACADEMICA_ADMINISTRATIVA = {
    'auxiliares_docencia': 'Memor\u00e1ndum de designaci\u00f3n, informe de supervisi\u00f3n de auxiliares',
    'examenes_mesa': 'Actas de examen de mesa, memor\u00e1ndum de designaci\u00f3n de tribunal',
    'otras_comisiones_academicas': 'Memor\u00e1ndum de designaci\u00f3n, informe de la comisi\u00f3n',
    'logistica_carrera': 'Informe de log\u00edstica, inventario o cronograma de actividades',
    'difusion_perfil_profesional': 'Material de difusi\u00f3n, fotograf\u00edas, lista de instituciones visitadas',
    'caac': 'Actas del CAAC, informe de sesi\u00f3n',
    'comision_innovacion_curricular': 'Acta de la comisi\u00f3n, documento de innovaci\u00f3n curricular',
    'poa': 'POA aprobado, informe de seguimiento del POA',
    'programas_analiticos': 'Programas anal\u00edticos elaborados o revisados, acta de aprobaci\u00f3n',
}

CARGA_HORARIA_EVIDENCIAS_SOCIAL_CULTURAL_DEPORTIVA = {
    'acto_academico_facultativo': 'Fotograf\u00edas, lista de asistencia al acto facultativo',
    'acto_academico_universitario': 'Fotograf\u00edas, lista de asistencia al acto universitario',
    'participacion_actividades_culturales_sociales_deportivas': 'Fotograf\u00edas, certificado de participaci\u00f3n',
    'aniversarios': 'Fotograf\u00edas, programa del aniversario',
    'entrada_folclorica': 'Fotograf\u00edas, certificado de participaci\u00f3n en la entrada folcl\u00f3rica',
    'campeonatos_deportivos': 'Fotograf\u00edas, certificado o planilla de participaci\u00f3n deportiva',
    'concursos': 'Certificado de participaci\u00f3n, resultados del concurso',
    'eventos_culturales': 'Fotograf\u00edas, programa del evento cultural',
    'desfile_6_agosto': 'Fotograf\u00edas, lista de asistencia al desfile del 6 de agosto',
    'desfile_18_noviembre': 'Fotograf\u00edas, lista de asistencia al desfile del 18 de noviembre',
    'claustros_universitarios': 'Convocatoria y acta del claustro universitario',
    'asociacion_docente': 'Acta o certificado de participaci\u00f3n en la Asociaci\u00f3n de Docentes',
    'capacitacion_complementaria': 'Certificado de capacitaci\u00f3n complementaria',
    'orientacion_vocacional': 'Informe o registro de orientaci\u00f3n vocacional, fotograf\u00edas',
}

CARGA_HORARIA_EVIDENCIAS_POR_CATEGORIA = {
    'academica': CARGA_HORARIA_EVIDENCIAS_ACADEMICAS,
    'investigacion': CARGA_HORARIA_EVIDENCIAS_INVESTIGACION,
    'extension_universitaria': CARGA_HORARIA_EVIDENCIAS_EXTENSION_UNIVERSITARIA,
    'interaccion_social': CARGA_HORARIA_EVIDENCIAS_INTERACCION_SOCIAL,
    'gestion': CARGA_HORARIA_EVIDENCIAS_GESTION,
    'academica_administrativa': CARGA_HORARIA_EVIDENCIAS_ACADEMICA_ADMINISTRATIVA,
    'social_cultural_deportiva': CARGA_HORARIA_EVIDENCIAS_SOCIAL_CULTURAL_DEPORTIVA,
}


def _usuario_es_iisyp_solo_lectura(context):
    request = context.get('request') if context else None
    if not request or not getattr(request, 'user', None) or request.user.is_superuser:
        return False
    perfil = get_effective_profile(request.user, request)
    return bool(perfil and perfil.rol == 'iiisyp')


def _filtrar_categorias_investigacion_para_iisyp(data, context):
    if not _usuario_es_iisyp_solo_lectura(context):
        return data

    for field_name in ('categorias', 'requerimientos'):
        categorias = data.get(field_name)
        if isinstance(categorias, list):
            data[field_name] = [
                categoria for categoria in categorias
                if categoria.get('tipo') == 'investigacion'
            ]
    return data


def _obtener_docente_para_validacion_fondo(bloques, docente_por_defecto=None):
    if isinstance(docente_por_defecto, Docente):
        return docente_por_defecto

    for bloque in bloques:
        if not isinstance(bloque, dict):
            continue

        docente_valor = bloque.get('docente')
        if isinstance(docente_valor, Docente):
            return docente_valor

        if docente_valor not in [None, '']:
            docente = Docente.objects.filter(pk=docente_valor).first()
            if docente:
                return docente

    return None


def _obtener_horas_vinculo_activo(docente, carrera):
    if not docente or not carrera:
        return Decimal('0')

    vinculo = DocenteCarrera.objects.filter(docente=docente, carrera=carrera, activo=True).first()
    return Decimal(str(vinculo.horas_semanales_maximas or 0)) if vinculo else Decimal('0')


def _validar_fondo_tiempo_contractual_doble_rol(bloques, docente_por_defecto=None):
    bloques_validos = []
    for bloque in bloques:
        if not isinstance(bloque, dict):
            continue

        rol = str(bloque.get('rol') or '').strip()
        carrera = _resolver_carrera_asignacion(bloque.get('carrera'))
        if rol and carrera:
            bloques_validos.append((rol, carrera))

    if not bloques_validos:
        return

    tiene_autoridad = any(rol in ROLES_AUTORIDAD_ASIGNACION for rol, _ in bloques_validos)
    tiene_docencia = any(rol == 'docente' for rol, _ in bloques_validos)
    if not (tiene_autoridad and tiene_docencia):
        return

    docente = _obtener_docente_para_validacion_fondo(bloques, docente_por_defecto=docente_por_defecto)
    if not docente:
        return

    horas_consumidas = sum(
        (_obtener_horas_vinculo_activo(docente, carrera) for _, carrera in bloques_validos),
        Decimal('0'),
    )

    vinculos_activos = DocenteCarrera.objects.filter(docente=docente, activo=True)
    if not vinculos_activos.exists():
        return

    horas_contractuales = max(
        (Decimal(str(vinculo.horas_semanales_maximas or 0)) for vinculo in vinculos_activos),
        default=Decimal('0'),
    )

    if horas_consumidas > horas_contractuales:
        raise serializers.ValidationError({
            'asignaciones': (
                f'El docente excede su fondo de tiempo contractual '
                f'({int(horas_consumidas)}/{int(horas_contractuales)} horas)'
            )
        })

def validar_unicidad_cargo_por_carrera(carrera, rol, exclude_user_id=None):
    """
    Garantiza que solo exista un Director o Jefe de Estudios activo por carrera.
    """
    if rol not in ['director', 'jefe_estudios'] or not carrera:
        return

    cargos = {
        'director': 'Director',
        'jefe_estudios': 'Jefe de Estudios',
    }

    queryset = PerfilUsuario.objects.filter(
        rol=rol,
        carrera=carrera,
        activo=True,
    )

    if exclude_user_id:
        queryset = queryset.exclude(user_id=exclude_user_id)

    # Limpia perfiles huérfanos de autoridad que quedaron de pruebas previas.
    perfiles_huerfanos = list(queryset.filter(user__isnull=True))
    for perfil_huerfano in perfiles_huerfanos:
        perfil_huerfano.delete()

    queryset = PerfilUsuario.objects.filter(
        rol=rol,
        carrera=carrera,
        activo=True,
    )
    if exclude_user_id:
        queryset = queryset.exclude(user_id=exclude_user_id)

    if queryset.exists():
        raise serializers.ValidationError(
            f'La carrera de {carrera.nombre} ya tiene un {cargos[rol]} asignado. '
            'Debe dar de baja al titular actual antes de asignar uno nuevo'
        )


def usuario_tiene_uso_de_rol(user, perfil_actual=None):
    """
    Determina si el usuario ya tiene uso operativo en el sistema.
    Si existe uso, no debe permitirse cambiar su rol para proteger la trazabilidad.
    """
    docente = perfil_actual.docente if perfil_actual else None

    return (
        (docente is not None and FondoTiempo.objects.filter(docente=docente).exists())
        or HistorialFondo.objects.filter(usuario=user).exists()
        or InformeFondo.objects.filter(elaborado_por=user).exists()
        or InformeFondo.objects.filter(evaluado_por=user).exists()
        or ObservacionFondo.objects.filter(resuelta_por=user).exists()
        or MensajeObservacion.objects.filter(autor=user).exists()
        or CargaHoraria.objects.filter(creado_por=user).exists()
    )


def obtener_perfil_por_ci(ci):
    ci_normalizado = (ci or '').strip()
    if not ci_normalizado:
        return None
    return PerfilUsuario.objects.filter(ci=ci_normalizado).select_related('user', 'docente').first()


def docente_tiene_historial_operativo(docente):
    if not docente:
        return False
    return (
        FondoTiempo.objects.filter(docente=docente).exists()
        or SaldoVacacionesGestion.objects.filter(docente=docente).exists()
        or CargaHoraria.objects.filter(docente=docente).exists()
    )


def perfil_ci_es_reutilizable(perfil_ci, rol_objetivo):
    if not perfil_ci or perfil_ci.user_id:
        return False
    if docente_tiene_historial_operativo(perfil_ci.docente):
        return False
    return True


def _resolver_carrera_asignacion(valor_carrera):
    if isinstance(valor_carrera, Carrera):
        return valor_carrera
    if valor_carrera in [None, '']:
        return None
    return Carrera.objects.filter(pk=valor_carrera).first()


def _rol_usuario_solicitante(user):
    perfil = getattr(user, 'perfil', None)
    return getattr(perfil, 'rol', None)


def _carreras_gestionables_director(user):
    if not user or not getattr(user, 'is_authenticated', False):
        return Carrera.objects.none()

    if user.is_superuser:
        return None

    perfil = getattr(user, 'perfil', None)
    if not perfil or perfil.rol != 'director':
        return Carrera.objects.none()

    carreras = perfil.get_carreras_activas() if hasattr(perfil, 'get_carreras_activas') else Carrera.objects.none()
    if carreras.exists():
        return carreras

    if perfil.carrera_id:
        return Carrera.objects.filter(pk=perfil.carrera_id)

    return Carrera.objects.none()


def _ids_carreras_gestionables(carreras_gestionables):
    if carreras_gestionables is None:
        return None
    return set(carreras_gestionables.values_list('id', flat=True))


def _validar_bloques_en_carreras_gestionables(bloques, carreras_gestionables):
    ids_permitidos = _ids_carreras_gestionables(carreras_gestionables)
    if ids_permitidos is None:
        return

    if not ids_permitidos:
        raise serializers.ValidationError({
            'carrera': 'El director no tiene una carrera activa asignada para gestionar usuarios.'
        })

    for bloque in bloques:
        if not isinstance(bloque, dict):
            continue

        rol = str(bloque.get('rol') or '').strip()
        carrera = _resolver_carrera_asignacion(bloque.get('carrera'))
        if not rol or not carrera:
            continue

        if rol in {'iiisyp', 'director'}:
            raise serializers.ValidationError({
                'rol': 'El director solo puede asignar roles operativos dentro de su carrera.'
            })

        if carrera.id not in ids_permitidos:
            raise serializers.ValidationError({
                'carrera': 'Solo puedes gestionar usuarios dentro de tu carrera.'
            })


def _combinar_bloques_con_asignaciones_externas(user, bloques, carreras_gestionables):
    ids_permitidos = _ids_carreras_gestionables(carreras_gestionables)
    if ids_permitidos is None:
        return bloques

    asignaciones_externas = []
    for asignacion in AsignacionCarrera.objects.filter(user=user, activo=True).exclude(
        carrera_id__in=ids_permitidos
    ).select_related('carrera', 'docente'):
        asignaciones_externas.append({
            'rol': asignacion.rol,
            'carrera': asignacion.carrera,
            'docente': asignacion.docente,
        })

    return asignaciones_externas + bloques


def _resolver_docente_asignacion(bloque, docente_por_defecto=None):
    if not isinstance(bloque, dict):
        return docente_por_defecto

    docente_data = bloque.get('docente_data')
    if isinstance(docente_data, dict) and docente_data:
        docente_serializer = DocenteSerializer(data=docente_data)
        docente_serializer.is_valid(raise_exception=True)
        return docente_serializer.save()

    docente_valor = bloque.get('docente')
    if isinstance(docente_valor, Docente):
        return docente_valor
    if docente_valor not in [None, '']:
        return Docente.objects.filter(pk=docente_valor).first()

    return docente_por_defecto


def _normalizar_claves_asignaciones(bloques):
    claves = set()
    for bloque in bloques:
        if not isinstance(bloque, dict):
            continue
        rol = bloque.get('rol')
        carrera = _resolver_carrera_asignacion(bloque.get('carrera'))
        if not rol or not carrera:
            continue
        claves.add((rol, carrera.id))
    return claves


def _validar_limite_asignaciones_usuario(bloques):
    claves = _normalizar_claves_asignaciones(bloques)
    if len(claves) > 2:
        raise serializers.ValidationError({
            'asignaciones': 'No se permiten más de 2 asignaciones por usuario.'
        })


ROLES_AUTORIDAD_ASIGNACION = {'director', 'jefe_estudios'}
ROLES_GESTION_DEDICACION = {'director', 'jefe_estudios', 'iiisyp'}
MENSAJE_ASIGNACION_INVALIDA = 'Esta combinaci\u00f3n de roles no es v\u00e1lida seg\u00fan las reglas de asignaci\u00f3n del sistema'
MENSAJE_CONFLICTO_AUTORIDAD = 'Un usuario no puede tener m\u00e1s de un cargo de gesti\u00f3n (Director o Jefe de Estudios).'
MENSAJE_INCOMPATIBILIDAD_DEDICACION = 'Seg\u00fan normativa UABJB, los cargos de gesti\u00f3n (Director/Jefe) solo son compatibles con docencia a Tiempo Horario. No se permite dedicaci\u00f3n Tiempo Completo o Medio Tiempo.'
MENSAJE_DOCENTE_DEDICACION_EXCLUSIVA = 'Los usuarios con rol docente deben registrar dedicacion a Tiempo Horario.'


def _usuario_tiene_rol_gestion_activo(user):
    if not user:
        return False

    if AsignacionCarrera.objects.filter(
        user=user,
        activo=True,
        rol__in=ROLES_GESTION_DEDICACION,
    ).exists():
        return True

    return PerfilUsuario.objects.filter(
        user=user,
        activo=True,
        rol__in=ROLES_GESTION_DEDICACION,
    ).exists()


def _usuario_tiene_rol_docente_activo(user):
    if not user:
        return False

    if AsignacionCarrera.objects.filter(user=user, activo=True, rol='docente').exists():
        return True

    return PerfilUsuario.objects.filter(user=user, activo=True, rol='docente').exists()


def _usuario_tiene_rol_activo(user, rol):
    if not user:
        return False

    if AsignacionCarrera.objects.filter(user=user, activo=True, rol=rol).exists():
        return True

    return PerfilUsuario.objects.filter(user=user, activo=True, rol=rol).exists()


def _resolver_usuario_docente_para_validacion(docente=None, user=None):
    if user:
        return user
    if docente and docente.user_id:
        return docente.user
    if docente:
        perfil = PerfilUsuario.objects.filter(
            docente=docente,
            user__isnull=False,
        ).select_related('user').first()
        if perfil and perfil.user:
            return perfil.user
    return None


def _validar_dedicacion_compatible_con_roles_gestion(dedicacion, docente=None, user=None):
    usuario_relacionado = _resolver_usuario_docente_para_validacion(docente=docente, user=user)

    if dedicacion == 'dedicacion_exclusiva' and _usuario_tiene_rol_docente_activo(usuario_relacionado):
        raise serializers.ValidationError({
            'dedicacion': MENSAJE_DOCENTE_DEDICACION_EXCLUSIVA
        })

    if dedicacion == 'dedicacion_exclusiva' and not _usuario_tiene_rol_activo(usuario_relacionado, 'director'):
        raise serializers.ValidationError({
            'dedicacion': 'La dedicacion exclusiva solo aplica al Director de Carrera.'
        })

    if dedicacion not in {'tiempo_completo', 'medio_tiempo'}:
        return

    if _usuario_tiene_rol_gestion_activo(usuario_relacionado) and _usuario_tiene_rol_docente_activo(usuario_relacionado):
        raise serializers.ValidationError({
            'dedicacion': MENSAJE_INCOMPATIBILIDAD_DEDICACION
        })


def _dedicacion_para_usuario(dedicacion, user):
    tiene_docencia = _usuario_tiene_rol_docente_activo(user)
    tiene_director = _usuario_tiene_rol_activo(user, 'director')
    tiene_jefe_estudios = _usuario_tiene_rol_activo(user, 'jefe_estudios')
    tiene_iisyp = _usuario_tiene_rol_activo(user, 'iiisyp')

    if tiene_director and not tiene_docencia and not tiene_jefe_estudios and not tiene_iisyp:
        return 'dedicacion_exclusiva'
    if (tiene_jefe_estudios or tiene_iisyp) and not tiene_docencia and not tiene_director:
        return 'tiempo_completo'
    return dedicacion


def _resolver_docente_existente_asignacion(bloque, docente_por_defecto=None):
    docente_valor = bloque.get('docente') if isinstance(bloque, dict) else None
    if isinstance(docente_valor, Docente):
        return docente_valor
    if docente_valor not in [None, '']:
        return Docente.objects.filter(pk=docente_valor).first()
    return docente_por_defecto


def _actualizar_ci_docente(docente, ci_normalizado):
    if not docente or not ci_normalizado:
        return

    datos_conflicto = DatosLaborales.objects.filter(ci=ci_normalizado)
    if docente.datos_laborales_id:
        datos_conflicto = datos_conflicto.exclude(pk=docente.datos_laborales_id)

    if datos_conflicto.exists():
        raise serializers.ValidationError({
            'ci': 'El CI ya esta registrado en otro registro laboral.'
        })

    if docente.datos_laborales_id:
        datos_laborales = docente.datos_laborales
        if datos_laborales.ci != ci_normalizado:
            datos_laborales.ci = ci_normalizado
            datos_laborales.full_clean()
            datos_laborales.save(update_fields=['ci'])
        return

    datos_laborales = DatosLaborales.objects.create(
        ci=ci_normalizado,
        fecha_ingreso=timezone.now().date(),
    )
    docente.datos_laborales = datos_laborales
    docente.save(update_fields=['datos_laborales'])


def _normalizar_bloques_validacion_asignaciones(bloques, docente_por_defecto=None):
    normalizados = []
    for bloque in bloques:
        if not isinstance(bloque, dict):
            continue

        rol = str(bloque.get('rol') or '').strip()
        carrera = _resolver_carrera_asignacion(bloque.get('carrera'))
        if not rol or not carrera:
            continue

        normalizados.append({
            'rol': rol,
            'carrera': carrera,
            'docente': _resolver_docente_existente_asignacion(bloque, docente_por_defecto=docente_por_defecto),
        })
    return normalizados


def _validar_reglas_asignaciones_usuario(bloques, docente_por_defecto=None):
    asignaciones = _normalizar_bloques_validacion_asignaciones(
        bloques,
        docente_por_defecto=docente_por_defecto,
    )

    if len(asignaciones) > 2:
        raise serializers.ValidationError({'asignaciones': 'No se permiten m\u00e1s de 2 asignaciones por usuario.'})

    claves = [(item['rol'], item['carrera'].id) for item in asignaciones]
    if len(set(claves)) != len(claves):
        raise serializers.ValidationError({'asignaciones': MENSAJE_ASIGNACION_INVALIDA})

    autoridades = [item for item in asignaciones if item['rol'] in ROLES_AUTORIDAD_ASIGNACION]

    # Regla estricta: un usuario no puede tener más de UN cargo de gestión,
    # sin importar la carrera (director + director, jefe_estudios + jefe_estudios,
    # o director + jefe_estudios en cualquier combinación de carreras).
    if len(autoridades) > 1:
        raise serializers.ValidationError({'asignaciones': MENSAJE_CONFLICTO_AUTORIDAD})


def _guardar_asignaciones_usuario(user, bloques, docente_por_defecto=None, carreras_gestionables=None):
    if carreras_gestionables is not None:
        ids_permitidos = _ids_carreras_gestionables(carreras_gestionables)
        if not ids_permitidos:
            raise serializers.ValidationError({
                'carrera': 'El director no tiene una carrera activa asignada para gestionar usuarios.'
            })

        bloques_gestionados = []
        for bloque in bloques:
            if not isinstance(bloque, dict):
                continue

            rol = str(bloque.get('rol') or '').strip()
            carrera = _resolver_carrera_asignacion(bloque.get('carrera'))
            if not rol or not carrera:
                continue

            if carrera.id not in ids_permitidos:
                raise serializers.ValidationError({
                    'carrera': 'Solo puedes gestionar usuarios dentro de tu carrera.'
                })

            bloques_gestionados.append({
                **bloque,
                'rol': rol,
                'carrera': carrera,
            })

        bloques_validacion = _combinar_bloques_con_asignaciones_externas(
            user,
            bloques_gestionados,
            carreras_gestionables,
        )
        _validar_limite_asignaciones_usuario(bloques_validacion)
        _validar_reglas_asignaciones_usuario(bloques_validacion, docente_por_defecto=docente_por_defecto)
        _validar_fondo_tiempo_contractual_doble_rol(
            bloques_validacion,
            docente_por_defecto=docente_por_defecto,
        )

        AsignacionCarrera.objects.filter(user=user, carrera_id__in=ids_permitidos).update(activo=False)

        for bloque in bloques_gestionados:
            docente = _resolver_docente_asignacion(bloque, docente_por_defecto=docente_por_defecto)
            if docente and docente.activo is False:
                raise serializers.ValidationError({
                    'docente': 'No se puede asignar ni vincular un docente inactivo.'
                })
            AsignacionCarrera.objects.update_or_create(
                user=user,
                carrera=bloque['carrera'],
                rol=bloque['rol'],
                defaults={
                    'docente': docente,
                    'activo': True,
                }
            )
        return

    _validar_limite_asignaciones_usuario(bloques)
    _validar_reglas_asignaciones_usuario(bloques, docente_por_defecto=docente_por_defecto)

    AsignacionCarrera.objects.filter(user=user).update(activo=False)

    for bloque in bloques:
        if not isinstance(bloque, dict):
            continue

        rol = bloque.get('rol')
        carrera = _resolver_carrera_asignacion(bloque.get('carrera'))
        if not rol or not carrera:
            continue

        docente = _resolver_docente_asignacion(bloque, docente_por_defecto=docente_por_defecto)
        if docente and docente.activo is False:
            raise serializers.ValidationError({
                'docente': 'No se puede asignar ni vincular un docente inactivo.'
            })
        AsignacionCarrera.objects.update_or_create(
            user=user,
            carrera=carrera,
            rol=rol,
            defaults={
                'docente': docente,
                'activo': True,
            }
        )


def _split_user_full_name(full_name):
    partes = [p for p in str(full_name or '').strip().split() if p]
    if not partes:
        return '', ''
    if len(partes) == 1:
        return partes[0], ''
    return partes[0], ' '.join(partes[1:])


def _ensure_docente_role_for_user(user, docente=None, carrera=None, force_primary_role=False):
    perfil, _ = PerfilUsuario.objects.get_or_create(
        user=user,
        defaults={
            'rol': 'docente',
            'activo': user.is_active,
            'debe_cambiar_password': False,
        }
    )

    campos = []
    if force_primary_role and perfil.rol != 'docente':
        perfil.rol = 'docente'
        campos.append('rol')
    elif not perfil.rol:
        perfil.rol = 'docente'
        campos.append('rol')

    if docente is not None and perfil.docente_id != docente.id:
        perfil.docente = docente
        campos.append('docente')
    if carrera is not None and perfil.carrera_id != carrera.id:
        perfil.carrera = carrera
        campos.append('carrera')
    if perfil.activo != user.is_active:
        perfil.activo = user.is_active
        campos.append('activo')
    if perfil.debe_cambiar_password:
        perfil.debe_cambiar_password = False
        campos.append('debe_cambiar_password')
    if campos:
        perfil.save(update_fields=campos)

    if carrera is not None:
        AsignacionCarrera.objects.update_or_create(
            user=user,
            carrera=carrera,
            rol='docente',
            defaults={
                'docente': docente,
                'activo': user.is_active,
            }
        )

    return perfil


class CargaHorariaSerializer(serializers.ModelSerializer):
    docente_nombre = serializers.CharField(source='docente.nombre_completo', read_only=True)
    materia_nombre = serializers.CharField(source='materia.nombre', read_only=True)
    materia_sigla = serializers.CharField(source='materia.sigla', read_only=True)
    calendario_gestion = serializers.IntegerField(source='calendario.gestion', read_only=True)
    calendario_periodo = serializers.CharField(source='calendario.get_periodo_display', read_only=True)
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)
    creado_por_nombre = serializers.CharField(source='creado_por.get_full_name', read_only=True)

    class Meta:
        model = CargaHoraria
        fields = '__all__'
        read_only_fields = ['creado_por']
        validators = []

    def validate(self, data):
        from .models import DocenteCarrera

        docente = data.get('docente', self.instance.docente if self.instance else None)
        materia = data.get('materia', self.instance.materia if self.instance else None)
        calendario = data.get('calendario', self.instance.calendario if self.instance else None)
        categoria = data.get('categoria', self.instance.categoria if self.instance else None)
        titulo_actividad = data.get('titulo_actividad', self.instance.titulo_actividad if self.instance else '')
        paralelo = data.get('paralelo', self.instance.paralelo if self.instance else 'A')
        dia_semana = data.get('dia_semana', self.instance.dia_semana if self.instance else None)
        hora_inicio = data.get('hora_inicio', self.instance.hora_inicio if self.instance else None)
        hora_fin = data.get('hora_fin', self.instance.hora_fin if self.instance else None)
        aula = data.get('aula', self.instance.aula if self.instance else None)
        horas_nuevas = data.get('horas', self.instance.horas if self.instance else 0)
        tipo_actividad = data.get('tipo_actividad', self.instance.tipo_actividad if self.instance else '')
        evidencias = data.get('evidencias', self.instance.evidencias if self.instance else '')

        if docente and docente.activo is False:
            raise serializers.ValidationError({
                'docente': 'No se puede asignar carga horaria o materia a un docente inactivo.'
            })

        fondo = None
        categoria_macro = None
        semanas = Decimal('45.8')
        if docente and calendario:
            fondo = FondoTiempo.objects.filter(
                docente=docente,
                calendario_academico=calendario,
                archivado=False,
            ).first()
            if fondo:
                semanas = Decimal(str(getattr(fondo, 'semanas_a\u00f1o', '45.8') or '45.8'))
                if semanas <= 0:
                    semanas = Decimal('45.8')
                categoria_macro = CategoriaFuncion.objects.filter(
                    fondo_tiempo=fondo,
                    tipo=categoria,
                ).first()
        semanas_validacion = SEMANAS_CLASES_AULA if categoria == 'academica' else semanas

        if categoria == 'academica':
            tipo_actividad = str(tipo_actividad or '').strip()
            if tipo_actividad not in CARGA_HORARIA_TIPOS_POR_CATEGORIA['academica']:
                raise serializers.ValidationError({
                    'tipo_actividad': 'Debe seleccionar una sub-actividad academica valida.'
                })
            if not materia:
                raise serializers.ValidationError({'materia': 'Debe seleccionar una materia para la actividad académica.'})
            if tipo_actividad == 'clases_aula':
                data['titulo_actividad'] = materia.nombre
                data['horas'] = int(Decimal(materia.horas_totales or 0) * SEMANAS_CLASES_AULA)
                horas_nuevas = data['horas']
            else:
                data['titulo_actividad'] = str(titulo_actividad or CARGA_HORARIA_TIPOS_LABELS.get(tipo_actividad, tipo_actividad)).strip()
            if not str(evidencias or '').strip():
                evidencias = CARGA_HORARIA_EVIDENCIAS_ACADEMICAS.get(tipo_actividad, '')
            data['tipo_actividad'] = tipo_actividad
            data['evidencias'] = str(evidencias or '').strip()
        else:
            if materia:
                raise serializers.ValidationError({
                    'materia': 'Las materias del plan de estudios solo pueden asignarse en la categoría Académica.'
                })
            if not str(titulo_actividad or '').strip():
                raise serializers.ValidationError({
                    'titulo_actividad': 'Debe ingresar una descripción de la actividad para esta categoría.'
                })
            tipo_actividad = str(tipo_actividad or '').strip()
            tipos_validos = CARGA_HORARIA_TIPOS_POR_CATEGORIA.get(categoria, [])
            if tipos_validos and tipo_actividad not in tipos_validos:
                raise serializers.ValidationError({
                    'tipo_actividad': 'Debe seleccionar un tipo de actividad valido para esta categoria.'
                })
            if not str(evidencias or '').strip():
                evidencias = CARGA_HORARIA_EVIDENCIAS_POR_CATEGORIA.get(categoria, {}).get(tipo_actividad, '')
            data['titulo_actividad'] = str(titulo_actividad).strip()
            data['tipo_actividad'] = tipo_actividad
            data['evidencias'] = str(evidencias or '').strip()

        vinculo = None
        if docente and fondo and fondo.carrera:
            vinculo = DocenteCarrera.objects.filter(
                docente=docente,
                carrera=fondo.carrera,
                activo=True,
            ).first()
            if not vinculo or vinculo.horas_semanales_maximas <= 0:
                raise serializers.ValidationError({
                    'docente': 'El docente no tiene una dedicación activa válida para esta carrera.'
                })

        if materia and fondo and materia.carrera_id != fondo.carrera_id:
            raise serializers.ValidationError({
                'materia': 'La materia seleccionada no pertenece a la carrera del Fondo de Tiempo.'
            })

        if docente and calendario and categoria and tipo_actividad:
            tipo_duplicado = CargaHoraria.objects.filter(
                docente=docente,
                calendario=calendario,
                categoria=categoria,
                tipo_actividad=tipo_actividad,
            )
            if categoria == 'academica':
                tipo_duplicado = tipo_duplicado.filter(materia=materia)
            if self.instance:
                tipo_duplicado = tipo_duplicado.exclude(pk=self.instance.pk)
            if tipo_duplicado.exists():
                raise serializers.ValidationError({
                    'tipo_actividad': 'No puede repetir el mismo tipo de actividad dentro de la misma categoria.'
                })

        if categoria == 'academica' and tipo_actividad == 'clases_aula' and docente and calendario and materia:
            materia_duplicada = CargaHoraria.objects.filter(
                docente=docente,
                calendario=calendario,
                materia=materia,
            )
            if self.instance:
                materia_duplicada = materia_duplicada.exclude(pk=self.instance.pk)
            if materia_duplicada.exists():
                raise serializers.ValidationError({
                    'materia': f'La materia {materia.nombre} ya fue asignada a este docente en este periodo'
                })

        if hora_inicio and hora_fin and hora_fin <= hora_inicio:
            raise serializers.ValidationError({'hora_fin': 'La hora de fin debe ser mayor que la hora de inicio.'})

        # Tope de plan por materia (horas/semana): horas anuales prorrateadas.
        horas_asignadas_semana = Decimal(horas_nuevas or 0) / semanas_validacion
        horas_plan_semana = Decimal((materia.horas_totales or 0)) if materia else Decimal('0')
        tolerancia_redondeo_anual = Decimal('0.5') / semanas_validacion
        if materia and horas_asignadas_semana > (horas_plan_semana + tolerancia_redondeo_anual):
            exceso_semana = horas_asignadas_semana - horas_plan_semana
            raise serializers.ValidationError({
                'horas': (
                    f'La asignación equivale a {horas_asignadas_semana:.3f} hrs/semana y supera el '
                    f'Plan de Estudios de la materia ({horas_plan_semana:.2f} hrs/semana) '
                    f'por {exceso_semana:.3f} hrs/semana.'
                )
            })

        if categoria_macro:
            cargas_categoria = CargaHoraria.objects.filter(
                docente=docente,
                calendario=calendario,
                categoria=categoria,
            )
            if self.instance:
                cargas_categoria = cargas_categoria.exclude(pk=self.instance.pk)

            horas_existentes_anuales = Decimal(cargas_categoria.aggregate(total=Sum('horas'))['total'] or 0)
            total_categoria_semana = (horas_existentes_anuales + Decimal(horas_nuevas or 0)) / semanas_validacion
            presupuesto_semana = Decimal(str(categoria_macro.total_horas or 0))
            if total_categoria_semana > (presupuesto_semana + tolerancia_redondeo_anual):
                categoria_label = dict(CategoriaFuncion.TIPO_CHOICES).get(categoria, categoria)
                exceso_semana = total_categoria_semana - presupuesto_semana
                raise serializers.ValidationError({
                    'horas': (
                        f'Las horas asignadas en la categoría {categoria_label} exceden el presupuesto de '
                        f'{presupuesto_semana:g} hrs/sem establecido en la distribución Macro '
                        f'por {exceso_semana:.3f} hrs/sem.'
                    )
                })

        if fondo:
            cargas_fondo = CargaHoraria.objects.filter(
                docente=docente,
                calendario=calendario,
            )
            if self.instance:
                cargas_fondo = cargas_fondo.exclude(pk=self.instance.pk)

            horas_existentes_fondo = Decimal(cargas_fondo.aggregate(total=Sum('horas'))['total'] or 0)
            total_fondo_anual = horas_existentes_fondo + Decimal(horas_nuevas or 0)
            objetivo_anual = Decimal(str(fondo.horas_efectivas or 1712))
            if objetivo_anual > 0 and total_fondo_anual > objetivo_anual:
                exceso_anual = total_fondo_anual - objetivo_anual
                raise serializers.ValidationError({
                    'horas': (
                        f'El Micro excede el total anual permitido de {objetivo_anual:g} horas '
                        f'por {exceso_anual:g} horas.'
                    )
                })

        # Validación de cruces de horario para el mismo calendario.
        if docente and calendario and dia_semana and hora_inicio and hora_fin:
            choques_docente = CargaHoraria.objects.filter(
                docente=docente,
                calendario=calendario,
                dia_semana=dia_semana,
                hora_inicio__lt=hora_fin,
                hora_fin__gt=hora_inicio,
            )
            if self.instance:
                choques_docente = choques_docente.exclude(pk=self.instance.pk)
            if choques_docente.exists():
                raise serializers.ValidationError({
                    'hora_inicio': 'Choque de docente: ya existe otra materia asignada en ese día y rango horario.'
                })

            if aula:
                choques_aula = CargaHoraria.objects.filter(
                    calendario=calendario,
                    aula__iexact=str(aula).strip(),
                    dia_semana=dia_semana,
                    hora_inicio__lt=hora_fin,
                    hora_fin__gt=hora_inicio,
                )
                if self.instance:
                    choques_aula = choques_aula.exclude(pk=self.instance.pk)
                if choques_aula.exists():
                    raise serializers.ValidationError({
                        'aula': 'Choque de aula: el ambiente ya está ocupado en ese horario.'
                    })

        if docente and calendario and materia and paralelo and dia_semana and hora_inicio:
            duplicados = CargaHoraria.objects.filter(
                docente=docente,
                calendario=calendario,
                materia=materia,
                paralelo=paralelo,
                dia_semana=dia_semana,
                hora_inicio=hora_inicio,
            )
            if self.instance:
                duplicados = duplicados.exclude(pk=self.instance.pk)
            if duplicados.exists():
                raise serializers.ValidationError({
                    'hora_inicio': 'Ya existe una asignación para esa materia, paralelo, día y hora de inicio.'
                })

        # Esta regla aplica a la carga docente (materias), no a otras categorías.
        if not docente or not calendario or categoria != 'academica':
            return data

        cargas_existentes = CargaHoraria.objects.filter(
            docente=docente,
            calendario=calendario,
            categoria='academica',
        )

        # En actualización, excluir el registro actual para evitar doble conteo.
        if self.instance:
            cargas_existentes = cargas_existentes.exclude(pk=self.instance.pk)

        horas_existentes = cargas_existentes.aggregate(total=Sum('horas'))['total'] or 0
        total_horas_anuales = Decimal(horas_existentes) + Decimal(horas_nuevas or 0)
        total_horas_semanales = total_horas_anuales / SEMANAS_CLASES_AULA

        horas_maximas = Decimal(str(vinculo.horas_semanales_maximas if vinculo else 0))

        if total_horas_semanales > horas_maximas:
            raise serializers.ValidationError(
                (
                    f'Error: La carga horaria total ({total_horas_semanales:.2f} hrs) '
                    f'excede el máximo permitido para la dedicación del docente ({horas_maximas:.2f} hrs).'
                )
            )

        return data

    def create(self, validated_data):
        # Asignar el usuario que crea el registro
        validated_data['creado_por'] = self.context['request'].user
        return super().create(validated_data)


# ============================================================
# EVIDENCIA DE CARGA HORARIA SERIALIZER
# ============================================================
class EvidenciaCargaHorariaSerializer(serializers.ModelSerializer):
    subido_por_nombre = serializers.SerializerMethodField()
    nombre_archivo = serializers.SerializerMethodField()

    class Meta:
        model = EvidenciaCargaHoraria
        fields = [
            'id', 'carga_horaria', 'archivo', 'nombre_archivo', 'descripcion',
            'subido_por', 'subido_por_nombre', 'fecha_subida',
        ]
        read_only_fields = ['subido_por', 'fecha_subida']

    def get_subido_por_nombre(self, obj):
        if not obj.subido_por:
            return None
        nombre = obj.subido_por.get_full_name()
        return nombre or obj.subido_por.username

    def get_nombre_archivo(self, obj):
        if not obj.archivo:
            return None
        return obj.archivo.name.rsplit('/', 1)[-1]

    def validate_carga_horaria(self, carga_horaria):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user:
            return carga_horaria

        if user.is_superuser:
            return carga_horaria

        # IMPORTANTE: usar el rol ACTIVO (get_effective_profile), no el perfil
        # base del usuario. Un usuario puede tener varios roles sobre la misma
        # carrera (p. ej. es Docente Y ademas iiisyp) via AsignacionCarrera; si
        # aqui se lee `user.perfil.rol` directo y su perfil base no es
        # 'docente', esta validacion de pertenencia se saltaria por completo
        # aunque el usuario este operando como Docente en ese momento.
        perfil = get_effective_profile(user, request)
        if perfil and perfil.rol == 'docente' and perfil.docente_id:
            if carga_horaria.docente_id != perfil.docente_id:
                raise serializers.ValidationError(
                    'No puede adjuntar evidencias a actividades de otro docente.'
                )

        fondo = FondoTiempo.objects.filter(
            docente=carga_horaria.docente,
            calendario_academico=carga_horaria.calendario,
            archivado=False,
        ).first()

        if not fondo:
            raise serializers.ValidationError(
                'No se encontro el Fondo de Tiempo asociado a esta actividad.'
            )

        if fondo.estado != 'en_ejecucion':
            raise serializers.ValidationError(
                'Solo se pueden subir evidencias mientras el fondo esta en estado '
                f'"En Ejecución". Estado actual: {fondo.get_estado_display()}.'
            )

        return carga_horaria


# ============================================================
# DOCENTECARRERA SERIALIZER
# ============================================================
class DocenteCarreraSerializer(serializers.ModelSerializer):
    docente_nombre = serializers.CharField(source='docente.nombre_completo', read_only=True)
    carrera_nombre = serializers.CharField(source='carrera.nombre', read_only=True)
    tipo_dedicacion = serializers.CharField(source='get_dedicacion_display', read_only=True)
    tipo_categoria = serializers.CharField(source='get_categoria_display', read_only=True)
    tipo_condicion = serializers.CharField(source='get_condicion_display', read_only=True)
    horas_semanales = serializers.ReadOnlyField(source='horas_semanales_maximas')

    class Meta:
        model = DocenteCarrera
        fields = [
            'id', 'docente', 'docente_nombre',
            'carrera', 'carrera_nombre',
            'categoria', 'tipo_categoria',
            'dedicacion', 'tipo_dedicacion',
            'condicion', 'tipo_condicion',
            'horas_semanales', 'es_exento_fondo_tiempo', 'activo',
            'fecha_creacion', 'fecha_modificacion',
        ]
        read_only_fields = ['es_exento_fondo_tiempo', 'fecha_creacion', 'fecha_modificacion']

    def validate(self, attrs):
        data = super().validate(attrs)
        docente = data.get('docente', self.instance.docente if self.instance else None)
        dedicacion = data.get('dedicacion', self.instance.dedicacion if self.instance else None)
        _validar_dedicacion_compatible_con_roles_gestion(dedicacion, docente=docente)
        return data


# ============================================================
# DOCENTE SERIALIZER (datos personales solamente)
# ============================================================
class DocenteSerializer(serializers.ModelSerializer):
    nombre_completo = serializers.ReadOnlyField()
    usuario_nombre = serializers.SerializerMethodField()
    usuario_email = serializers.SerializerMethodField()
    usuario_id = serializers.SerializerMethodField()
    user_id = serializers.SerializerMethodField()
    usuario_rol = serializers.SerializerMethodField()
    usuario_rol_display = serializers.SerializerMethodField()
    asignaciones = serializers.SerializerMethodField()
    horas_declaradas = serializers.SerializerMethodField()
    fondos_validados = serializers.SerializerMethodField()
    carrera = serializers.PrimaryKeyRelatedField(queryset=Carrera.objects.all(), write_only=True, required=True)
    categoria = serializers.ChoiceField(choices=Docente.CATEGORIA_CHOICES, write_only=True, required=False)
    dedicacion = serializers.ChoiceField(choices=Docente.DEDICACION_CHOICES, write_only=True, required=False)
    condicion = serializers.ChoiceField(choices=DocenteCarrera.CONDICION_CHOICES, write_only=True, required=False)
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), write_only=True, required=False, allow_null=True)
    user_data = serializers.JSONField(write_only=True, required=False, allow_null=True)
    carrera_id = serializers.SerializerMethodField()
    carrera_nombre = serializers.SerializerMethodField()
    vinculos = DocenteCarreraSerializer(
        source='vinculos_carrera', many=True, read_only=True
    )

    class Meta:
        model = Docente
        fields = [
            'id', 'user', 'user_id', 'user_data',
            'nombres', 'apellido_paterno', 'apellido_materno',
            'ci', 'email', 'telefono',
            'fecha_ingreso', 'dias_vacacion', 'horas_feriados_gestion',
            'nombre_completo', 'usuario_nombre', 'usuario_email', 'usuario_id',
            'usuario_rol', 'usuario_rol_display', 'asignaciones',
            'horas_declaradas', 'fondos_validados',
            'carrera', 'carrera_id', 'carrera_nombre',
            'categoria', 'dedicacion', 'condicion',
            'vinculos', 'activo',
            'fecha_creacion', 'fecha_modificacion',
        ]
        read_only_fields = ['fecha_creacion', 'fecha_modificacion']

    def _perfil_asociado(self, obj):
        return PerfilUsuario.objects.filter(docente=obj, user__isnull=False).select_related('user', 'carrera').first()

    def _usuario_asociado(self, obj):
        if obj.user_id:
            return obj.user
        perfil = self._perfil_asociado(obj)
        return perfil.user if perfil and perfil.user else None

    def get_usuario_nombre(self, obj):
        usuario = self._usuario_asociado(obj)
        if usuario:
            return usuario.get_full_name().strip() or usuario.username
        return obj.nombre_completo

    def get_usuario_email(self, obj):
        usuario = self._usuario_asociado(obj)
        return usuario.email if usuario else None

    def get_usuario_id(self, obj):
        usuario = self._usuario_asociado(obj)
        return usuario.id if usuario else None

    def get_user_id(self, obj):
        return obj.user_id or self.get_usuario_id(obj)

    def get_carrera_id(self, obj):
        vinculo = obj.vinculos_carrera.filter(activo=True).select_related('carrera').first()
        return vinculo.carrera_id if vinculo else None

    def get_carrera_nombre(self, obj):
        vinculo = obj.vinculos_carrera.filter(activo=True).select_related('carrera').first()
        return vinculo.carrera.nombre if vinculo and vinculo.carrera else None

    def get_usuario_rol(self, obj):
        """Retorna el rol principal del usuario (del perfil)."""
        usuario = self._usuario_asociado(obj)
        if usuario and hasattr(usuario, 'perfil') and usuario.perfil:
            return usuario.perfil.rol
        return None

    def get_usuario_rol_display(self, obj):
        """Retorna el rol del perfil en texto legible."""
        usuario = self._usuario_asociado(obj)
        if usuario and hasattr(usuario, 'perfil') and usuario.perfil:
            return usuario.perfil.get_rol_display()
        return None

    def get_asignaciones(self, obj):
        """Retorna las asignaciones de carrera del usuario asociado."""
        usuario = self._usuario_asociado(obj)
        if not usuario:
            return []
        
        asignaciones = usuario.asignaciones_carrera.all().order_by('-activo', 'id') if hasattr(usuario, 'asignaciones_carrera') else []
        resultado = []
        for asignacion in asignaciones:
            resultado.append({
                'id': asignacion.id,
                'rol': asignacion.rol,
                'rol_display': asignacion.get_rol_display(),
                'carrera': asignacion.carrera_id,
                'carrera_nombre': asignacion.carrera.nombre if asignacion.carrera else None,
                'carrera_codigo': asignacion.carrera.codigo if asignacion.carrera else None,
                'docente': asignacion.docente_id,
                'activo': asignacion.activo,
            })
        return resultado

    def get_horas_declaradas(self, obj):
        total_horas = obj.cargas_horarias.aggregate(total=Sum('horas')).get('total') or 0
        return int(total_horas)

    def get_fondos_validados(self, obj):
        estados_con_historial = ['aprobado_director', 'en_ejecucion', 'informe_presentado', 'finalizado', 'archivado']
        return obj.fondos_tiempo.filter(estado__in=estados_con_historial).count()

    def validate_ci(self, value):
        ci_normalizado = (value or '').strip()
        return ci_normalizado

    def validate(self, data):
        from django.utils import timezone

        user_existente = data.get('user')
        user_data = data.get('user_data')

        if self.instance is None and not user_existente and not user_data:
            raise serializers.ValidationError({'user': 'Debe seleccionar un usuario existente o crear uno nuevo.'})

        if user_existente and user_data:
            raise serializers.ValidationError({'user': 'Seleccione un usuario existente o cree uno nuevo, no ambos.'})

        if user_existente:
            docentes_conflicto = Docente.objects.filter(user=user_existente)
            if self.instance:
                docentes_conflicto = docentes_conflicto.exclude(pk=self.instance.pk)
            if docentes_conflicto.exists():
                raise serializers.ValidationError({'user': 'El usuario seleccionado ya esta vinculado a otro docente.'})

        if isinstance(user_data, dict) and user_data:
            username = str(user_data.get('username') or '').strip()
            email = str(user_data.get('email') or '').strip()
            password = str(user_data.get('password') or '')
            full_name = str(user_data.get('nombre') or user_data.get('full_name') or '').strip()
            if full_name and not user_data.get('first_name') and not user_data.get('last_name'):
                first_name, last_name = _split_user_full_name(full_name)
                user_data['first_name'] = first_name
                user_data['last_name'] = last_name

            if not username:
                raise serializers.ValidationError({'user_data': {'username': 'El usuario es obligatorio.'}})
            if not email:
                raise serializers.ValidationError({'user_data': {'email': 'El correo es obligatorio.'}})
            if not password or len(password) < 8:
                raise serializers.ValidationError({'user_data': {'password': 'La contrasena debe tener al menos 8 caracteres.'}})
            if not str(user_data.get('first_name') or '').strip():
                raise serializers.ValidationError({'user_data': {'first_name': 'El nombre es obligatorio.'}})
            if not str(user_data.get('last_name') or '').strip():
                raise serializers.ValidationError({'user_data': {'last_name': 'El apellido es obligatorio.'}})
            if User.objects.filter(username__iexact=username).exists():
                raise serializers.ValidationError({'user_data': {'username': 'Ya existe un usuario con ese nombre.'}})
            if User.objects.filter(email__iexact=email).exists():
                raise serializers.ValidationError({'user_data': {'email': 'Ya existe un usuario con ese correo.'}})

        fecha_ingreso = data.get(
            'fecha_ingreso',
            self.instance.datos_laborales.fecha_ingreso if (self.instance and self.instance.datos_laborales) else None,
        )
        dedicacion = data.get(
            'dedicacion',
            self.instance.vinculos_carrera.first().dedicacion if (self.instance and self.instance.vinculos_carrera.exists()) else None,
        )
        docente_obj = self.instance if self.instance else None
        user_obj = data.get('user', self.instance.user if self.instance else None)
        _validar_dedicacion_compatible_con_roles_gestion(dedicacion, docente=docente_obj, user=user_obj)

        if fecha_ingreso:
            fecha = fecha_ingreso.date() if hasattr(fecha_ingreso, 'time') else fecha_ingreso
            hoy = timezone.now().date()
            fecha_fundacion_uabjb = fecha.replace(year=1967, month=11, day=18)
            if fecha > hoy:
                raise serializers.ValidationError({'fecha_ingreso': 'La fecha de ingreso no puede ser una fecha futura.'})
            if fecha < fecha_fundacion_uabjb:
                raise serializers.ValidationError({'fecha_ingreso': 'La fecha de ingreso no puede ser anterior a la fundacion de la UABJB (18 de noviembre de 1967).'})

        return data

    def create(self, validated_data):
        carrera = validated_data.pop('carrera', None)
        user = validated_data.pop('user', None)
        user_data = validated_data.pop('user_data', None) or {}
        if not carrera:
            raise serializers.ValidationError({'carrera': 'Debe seleccionar una carrera para el docente.'})

        ci_docente = (validated_data.pop('ci', None) or '').strip()
        categoria = validated_data.pop('categoria', 'asistente')
        dedicacion = validated_data.pop('dedicacion', 'horario_40')
        condicion = validated_data.pop('condicion', 'titular')
        fecha_ingreso = validated_data.pop('fecha_ingreso', None)
        dias_vacacion = validated_data.pop('dias_vacacion', 15)
        horas_feriados = validated_data.pop('horas_feriados_gestion', 128)

        if user is None and user_data:
            user = User.objects.create_user(
                username=str(user_data.get('username') or '').strip(),
                email=str(user_data.get('email') or '').strip(),
                password=user_data.get('password'),
                first_name=str(user_data.get('first_name') or '').strip(),
                last_name=str(user_data.get('last_name') or '').strip(),
            )

        dedicacion = _dedicacion_para_usuario(dedicacion, user)
        _validar_dedicacion_compatible_con_roles_gestion(dedicacion, user=user)

        # Determinar DatosLaborales a usar:
        # - Si el usuario ya tiene un PerfilUsuario con datos_laborales -> reutilizar.
        # - Si el PerfilUsuario tiene CI y no se envió CI en payload, usar ese CI.
        # - Si no hay nada, crear DatosLaborales nuevo (evitar CI temporal si podemos usar uno del perfil).
        datos_laborales = None
        effective_ci = ci_docente or None
        if user:
            perfil_user = PerfilUsuario.objects.filter(user=user).first()
            if perfil_user:
                if perfil_user.datos_laborales:
                    datos_laborales = perfil_user.datos_laborales
                    if not effective_ci and perfil_user.ci:
                        effective_ci = perfil_user.ci
                else:
                    if not effective_ci and perfil_user.ci:
                        effective_ci = perfil_user.ci

        if not datos_laborales:
            datos_laborales_existentes = DatosLaborales.objects.none()
            if effective_ci:
                datos_laborales_existentes = DatosLaborales.objects.filter(ci=effective_ci)

            if datos_laborales_existentes.exists():
                datos_laborales = datos_laborales_existentes.first()
                cambios_datos_laborales = []

                if fecha_ingreso and datos_laborales.fecha_ingreso != fecha_ingreso:
                    datos_laborales.fecha_ingreso = fecha_ingreso
                    cambios_datos_laborales.append('fecha_ingreso')
                if datos_laborales.dias_vacacion != dias_vacacion:
                    datos_laborales.dias_vacacion = dias_vacacion
                    cambios_datos_laborales.append('dias_vacacion')
                if datos_laborales.horas_feriados_gestion != horas_feriados:
                    datos_laborales.horas_feriados_gestion = horas_feriados
                    cambios_datos_laborales.append('horas_feriados_gestion')

                if cambios_datos_laborales:
                    datos_laborales.full_clean()
                    datos_laborales.save(update_fields=cambios_datos_laborales)
            else:
                datos_laborales = DatosLaborales.objects.create(
                    ci=effective_ci or f"TEMP_{timezone.now().timestamp()}",
                    fecha_ingreso=fecha_ingreso or timezone.now().date(),
                    dias_vacacion=dias_vacacion,
                    horas_feriados_gestion=horas_feriados,
                )

        validated_data['datos_laborales'] = datos_laborales
        validated_data['user'] = user
        if user:
            validated_data['email'] = user.email
            validated_data['nombres'] = validated_data.get('nombres') or user.first_name or ''
            apellidos = str(user.last_name or '').strip().split()
            validated_data['apellido_paterno'] = validated_data.get('apellido_paterno') or (apellidos[0] if apellidos else '')
            validated_data['apellido_materno'] = validated_data.get('apellido_materno') or (' '.join(apellidos[1:]) if len(apellidos) > 1 else '')

        docente = super().create(validated_data)

        if user:
            # Al vincular un docente a un usuario, asegurarse que el usuario quede activo
            if not user.is_active:
                user.is_active = True
                user.save(update_fields=['is_active'])

            if _usuario_tiene_rol_docente_activo(user):
                perfil = _ensure_docente_role_for_user(user=user, docente=docente, carrera=carrera, force_primary_role=False)
            else:
                perfil = PerfilUsuario.objects.filter(user=user).first()
                if perfil and perfil.docente_id != docente.id:
                    perfil.docente = docente
                    perfil.save(update_fields=['docente'])

            # Actualizar CI del perfil si llegó en el payload o si lo determinamos antes
            if effective_ci and perfil and perfil.ci != effective_ci:
                perfil.ci = effective_ci
                perfil.save(update_fields=['ci'])

            # Asegurar que el perfil quede activo
            if perfil and not perfil.activo:
                perfil.activo = True
                perfil.save(update_fields=['activo'])
        else:
            PerfilUsuario.objects.create(
                user=None,
                docente=docente,
                ci=ci_docente or None,
                rol='docente',
                carrera=carrera,
                telefono='',
                activo=True,
                debe_cambiar_password=False,
            )

        DocenteCarrera.objects.update_or_create(
            docente=docente,
            carrera=carrera,
            defaults={
                'categoria': categoria,
                'dedicacion': dedicacion,
                'condicion': condicion,
                'activo': True,
            },
        )

        return docente

    def update(self, instance, validated_data):
        activo_en_request = validated_data.get('activo', instance.activo)
        carrera = validated_data.pop('carrera', serializers.empty)
        categoria = validated_data.pop('categoria', serializers.empty)
        dedicacion = validated_data.pop('dedicacion', serializers.empty)
        condicion = validated_data.pop('condicion', serializers.empty)
        user = validated_data.pop('user', serializers.empty)
        validated_data.pop('user_data', None)

        dl_fields = ['ci', 'fecha_ingreso', 'dias_vacacion', 'horas_feriados_gestion']
        dl_data = {}
        for field in dl_fields:
            if field in validated_data:
                dl_data[field] = validated_data.pop(field)

        if instance.datos_laborales and dl_data:
            dl = instance.datos_laborales
            for key, value in dl_data.items():
                setattr(dl, key, value)
            dl.full_clean()
            dl.save()

        if user is not serializers.empty:
            instance.user = user

        docente = super().update(instance, validated_data)

        if carrera is not serializers.empty:
            if not carrera:
                raise serializers.ValidationError({'carrera': 'Debe seleccionar una carrera valida para el docente.'})
            vinculo_existente = docente.vinculos_carrera.filter(carrera=carrera).first()
            dedicacion_final = dedicacion if dedicacion is not serializers.empty else (vinculo_existente.dedicacion if vinculo_existente else 'horario_40')
            dedicacion_final = _dedicacion_para_usuario(dedicacion_final, docente.user)
            _validar_dedicacion_compatible_con_roles_gestion(dedicacion_final, docente=docente, user=docente.user)
            DocenteCarrera.objects.update_or_create(
                docente=docente,
                carrera=carrera,
                defaults={
                    'categoria': categoria if categoria is not serializers.empty else (vinculo_existente.categoria if vinculo_existente else 'asistente'),
                    'dedicacion': dedicacion_final,
                    'condicion': condicion if condicion is not serializers.empty else (vinculo_existente.condicion if vinculo_existente else 'titular'),
                    'activo': True,
                },
            )
            if _usuario_tiene_rol_docente_activo(docente.user):
                perfil, _ = PerfilUsuario.objects.get_or_create(
                    docente=docente,
                    defaults={
                        'user': docente.user,
                        'rol': 'docente',
                        'carrera': carrera,
                        'telefono': '',
                        'activo': True,
                        'debe_cambiar_password': False,
                    }
                )
            else:
                perfil = PerfilUsuario.objects.filter(user=docente.user).first()
                if perfil and perfil.docente_id != docente.id:
                    perfil.docente = docente
                    perfil.save(update_fields=['docente'])
            cambios = []
            if perfil and perfil.carrera_id != carrera.id:
                perfil.carrera = carrera
                cambios.append('carrera')
            if perfil and docente.user_id and perfil.user_id != docente.user_id:
                perfil.user = docente.user
                cambios.append('user')
            if perfil and cambios:
                perfil.save(update_fields=cambios)
            if docente.user_id and _usuario_tiene_rol_docente_activo(docente.user):
                _ensure_docente_role_for_user(user=docente.user, docente=docente, carrera=carrera, force_primary_role=False)

        if activo_en_request is False:
            perfiles_vinculados = PerfilUsuario.objects.filter(docente=docente, user__isnull=False).select_related('user')
            for perfil_vinculado in perfiles_vinculados:
                if perfil_vinculado.user_id:
                    AsignacionCarrera.objects.filter(user=perfil_vinculado.user, rol='docente', activo=True).update(activo=False)
                if perfil_vinculado.rol == 'docente' and perfil_vinculado.activo:
                    perfil_vinculado.activo = False
                    perfil_vinculado.save(update_fields=['activo'])

        return docente


class SaldoVacacionesGestionSerializer(serializers.ModelSerializer):
    docente_nombre = serializers.CharField(source='docente.nombre_completo', read_only=True)
    docente_id = serializers.IntegerField(write_only=False)

    class Meta:
        model = SaldoVacacionesGestion
        fields = ['id', 'docente_id', 'docente_nombre', 'gestion', 'dias_disponibles']

    def validate_docente_id(self, value):
        """Valida que el docente exista."""
        if not Docente.objects.filter(id=value).exists():
            raise serializers.ValidationError("El docente especificado no existe.")
        return value

    def create(self, validated_data):
        docente_id = validated_data.pop('docente_id')
        validated_data['docente_id'] = docente_id
        return super().create(validated_data)


class DatosLaboralesSerializer(serializers.ModelSerializer):
    """Serializer para gestionar DatosLaborales de usuarios administrativos puros."""

    nombre_completo = serializers.SerializerMethodField(
        help_text="Nombre de la persona asociada (desde PerfilUsuario o Docente)"
    )
    rol_usuario = serializers.SerializerMethodField()
    antiguedad = serializers.SerializerMethodField()

    class Meta:
        model = DatosLaborales
        fields = [
            'id', 'ci', 'fecha_ingreso', 'dias_vacacion', 'horas_feriados_gestion',
            'nombre_completo', 'rol_usuario', 'antiguedad',
            'fecha_creacion', 'fecha_modificacion',
        ]
        read_only_fields = ['fecha_creacion', 'fecha_modificacion']

    def get_nombre_completo(self, obj):
        """Obtiene el nombre desde el perfil o docente vinculado."""
        # Intentar desde el docente
        if hasattr(obj, 'docente') and obj.docente:
            return obj.docente.nombre_completo
        # Intentar desde perfiles
        perfil = PerfilUsuario.objects.filter(datos_laborales=obj).first()
        if perfil and perfil.user:
            nombre = perfil.user.get_full_name()
            if nombre:
                return nombre
            return perfil.user.username
        return obj.ci

    def get_rol_usuario(self, obj):
        perfil = PerfilUsuario.objects.filter(datos_laborales=obj).first()
        return perfil.get_rol_display() if perfil else 'N/A'

    def get_antiguedad(self, obj):
        return obj.calcular_antiguedad()

    def validate_ci(self, value):
        """Valida unicidad del CI."""
        ci_normalizado = (value or '').strip()
        if not ci_normalizado:
            return ci_normalizado
        qs = DatosLaborales.objects.filter(ci=ci_normalizado)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError('Ya existe un registro con este C.I.')
        return ci_normalizado


class CarreraSerializer(serializers.ModelSerializer):
    logo_carrera = serializers.SerializerMethodField(read_only=True)
    logo_carrera_file = serializers.ImageField(write_only=True, required=False, allow_null=True)
    remove_logo_carrera = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = Carrera
        fields = [
            'id',
            'nombre',
            'codigo',
            'facultad',
            'mision',
            'vision',
            'perfil_profesional',
            'objetivo_carrera',
            'responsable',
            'resolucion_ministerial',
            'fecha_resolucion',
            'activo',
            'fecha_actualizacion',
            'logo_carrera',
            'logo_carrera_file',
            'remove_logo_carrera',
        ]

    def get_logo_carrera(self, obj):
        return obj.get_logo_carrera_data_uri()

    def validate(self, attrs):
        instance = getattr(self, 'instance', None)

        codigo = attrs.get('codigo', getattr(instance, 'codigo', ''))
        codigo_normalizado = (codigo or '').strip().upper()
        if not codigo_normalizado:
            raise serializers.ValidationError({'codigo': 'El codigo de carrera es obligatorio.'})
        if len(codigo_normalizado) < 2:
            raise serializers.ValidationError({'codigo': 'El codigo de carrera debe tener al menos 2 caracteres.'})
        attrs['codigo'] = codigo_normalizado

        facultad = attrs.get('facultad', getattr(instance, 'facultad', ''))
        facultad_normalizada = (facultad or '').strip()
        if not facultad_normalizada:
            raise serializers.ValidationError({'facultad': 'La facultad es obligatoria y no puede estar vacía.'})
        facultades_validas = set(Carrera.get_facultad_values())
        if facultad_normalizada not in facultades_validas:
            raise serializers.ValidationError({'facultad': 'La facultad seleccionada no es valida.'})
        attrs['facultad'] = facultad_normalizada

        resolucion = attrs.get('resolucion_ministerial', getattr(instance, 'resolucion_ministerial', ''))
        if not (resolucion or '').strip():
            raise serializers.ValidationError({
                'resolucion_ministerial': 'Debe registrar la resolución ministerial/universitaria de la carrera.'
            })

        fecha_resolucion = attrs.get('fecha_resolucion', getattr(instance, 'fecha_resolucion', None))
        if not fecha_resolucion:
            raise serializers.ValidationError({
                'fecha_resolucion': 'Debe registrar la fecha de resolución de la carrera.'
            })
        if fecha_resolucion and fecha_resolucion > timezone.now().date():
            raise serializers.ValidationError({
                'fecha_resolucion': 'La fecha de resolución no puede ser futura.'
            })

        return attrs

    def create(self, validated_data):
        logo_file = validated_data.pop('logo_carrera_file', None)
        validated_data.pop('remove_logo_carrera', None)

        instance = super().create(validated_data)
        if logo_file:
            instance.set_logo_carrera_cifrada(logo_file)
            instance.save(update_fields=['logo_carrera', 'logo_carrera_cifrada', 'logo_carrera_mime'])
        return instance

    def update(self, instance, validated_data):
        logo_file = validated_data.pop('logo_carrera_file', serializers.empty)
        remove_logo = validated_data.pop('remove_logo_carrera', False)

        instance = super().update(instance, validated_data)

        if remove_logo:
            instance.clear_logo_carrera()
            instance.save(update_fields=['logo_carrera', 'logo_carrera_cifrada', 'logo_carrera_mime'])
            return instance

        if logo_file is not serializers.empty and logo_file is not None:
            instance.set_logo_carrera_cifrada(logo_file)
            instance.save(update_fields=['logo_carrera', 'logo_carrera_cifrada', 'logo_carrera_mime'])

        return instance


class MateriaSerializer(serializers.ModelSerializer):
    carrera_nombre = serializers.CharField(source='carrera.nombre', read_only=True)
    horas_totales = serializers.ReadOnlyField()

    class Meta:
        model = Materia
        fields = '__all__'

    def validate(self, attrs):
        instance = getattr(self, 'instance', None)

        sigla = attrs.get('sigla', getattr(instance, 'sigla', None))
        sigla_normalizada = (sigla or '').strip().upper()
        attrs['sigla'] = sigla_normalizada
        if sigla_normalizada and len(sigla_normalizada) < 2:
            errors = {'sigla': 'La sigla de la materia debe tener al menos 2 caracteres.'}
            raise serializers.ValidationError(errors)
        if sigla_normalizada and not re.fullmatch(r'[A-Z]{3}-[A-Z]{3}-[OE]\d{5}', sigla_normalizada):
            errors = {'sigla': 'La sigla debe seguir el formato XXX-XXX-[oe]XXXXX. Ej: CIS-ALG-o11101.'}
            raise serializers.ValidationError(errors)
        horas_teoricas = attrs.get('horas_teoricas', getattr(instance, 'horas_teoricas', 0))
        horas_practicas = attrs.get('horas_practicas', getattr(instance, 'horas_practicas', 0))
        semestre = attrs.get('semestre', getattr(instance, 'semestre', None))

        errors = {}

        if horas_teoricas is None or horas_teoricas < 0:
            errors['horas_teoricas'] = 'Las horas teóricas deben ser positivas o cero.'

        if horas_practicas is None or horas_practicas < 0:
            errors['horas_practicas'] = 'Las horas prácticas deben ser positivas o cero.'

        if semestre is None or semestre < 1 or semestre > 10:
            errors['semestre'] = 'El semestre debe estar entre 1 y 10.'

        total_horas_semana = (horas_teoricas or 0) + (horas_practicas or 0)
        if total_horas_semana < 2:
            errors['non_field_errors'] = ['La suma de horas teoricas y practicas debe ser minimo 2 horas semanales.']
        elif total_horas_semana > 12:
            errors['non_field_errors'] = ['La suma de horas teoricas y practicas no puede exceder 12 horas semanales.']

        # Formula reglamentaria: horas_semana * 40 = horas_anio.
        horas_anio = total_horas_semana * SEMANAS_CLASES_AULA
        if horas_anio <= 0 and 'non_field_errors' not in errors:
            errors['non_field_errors'] = ['La relación con 40 semanas debe resultar en horas mayores a cero.']

        if sigla_normalizada:
            sigla_qs = Materia.objects.filter(sigla__iexact=sigla_normalizada)
            if instance:
                sigla_qs = sigla_qs.exclude(pk=instance.pk)
            if sigla_qs.exists():
                errors['sigla'] = 'Ya existe una materia con esta sigla.'
        else:
            errors['sigla'] = 'La sigla de la materia es obligatoria.'

        if errors:
            raise serializers.ValidationError(errors)

        return attrs

    def _raise_model_validation_error(self, exc):
        detail = getattr(exc, 'message_dict', None) or {'non_field_errors': exc.messages}
        raise serializers.ValidationError(detail)

    def create(self, validated_data):
        instance = Materia(**validated_data)
        try:
            instance.full_clean()
        except DjangoValidationError as exc:
            self._raise_model_validation_error(exc)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        try:
            instance.full_clean()
        except DjangoValidationError as exc:
            self._raise_model_validation_error(exc)

        instance.save()
        return instance


# OBSOLETO desde 2026-09-12: serializa el modelo `Actividad`, deprecado (ver
# fondos/models.py). Se mantiene solo para no romper la forma de la respuesta
# de CategoriaFuncionSerializer.actividades, que hoy siempre devuelve una
# lista vacia (0 filas de Actividad en toda la base). El catalogo vivo de
# sub-actividades es CargaHoraria.tipo_actividad; no construir features
# nuevas sobre este serializer.
class ActividadSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source='categoria.get_tipo_display', read_only=True)
    subactividad_academica_display = serializers.CharField(source='get_subactividad_academica_display', read_only=True)
    
    class Meta:
        model = Actividad
        fields = ['id', 'categoria', 'categoria_nombre', 'subactividad_academica',
                  'subactividad_academica_display', 'detalle', 'horas_semana',
                  'horas_a\u00f1o', 'evidencias', 'orden', 'archivo_evidencia']
        extra_kwargs = {
            'evidencias': {'required': False, 'allow_null': True, 'allow_blank': True}
        }

    def validate_evidencias(self, value):
        """Asegura que evidencias sea una cadena vacia si es None."""
        return value or ""

    def validate_horas_semana(self, value):
        """Valida que las horas semanales no sean negativas."""
        if value < 0:
            raise serializers.ValidationError("Las horas semanales no pueden ser negativas.")
        return value

    def validate_horas_anio(self, value):
        """Valida que las horas anuales no sean negativas."""
        if value < 0:
            raise serializers.ValidationError("Las horas anuales no pueden ser negativas.")
        return value

    def validate(self, attrs):
        return super().validate(attrs)


class CategoriaFuncionSerializer(serializers.ModelSerializer):
    actividades = ActividadSerializer(many=True, read_only=True) # IMPORTANTE: Devuelve TODAS las actividades sin filtrar
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    # total_horas se elimina como SerializerMethodField para permitir escritura (guardado en BD)
    porcentaje = serializers.SerializerMethodField()
    detalles_carga = serializers.SerializerMethodField()
    total_carga_horaria = serializers.SerializerMethodField()
    
    class Meta:
        model = CategoriaFuncion
        fields = ['id', 'fondo_tiempo', 'tipo', 'tipo_display', 'total_horas', 
                  'porcentaje', 'actividades', 'detalles_carga', 'total_carga_horaria']

    def get_total_carga_horaria(self, obj):
        """Total de asignaciones micro registradas en CargaHoraria para esta categoria."""
        # obj is CategoriaFuncion
        fondo = obj.fondo_tiempo
        if not fondo.docente or not fondo.calendario_academico:
            return 0

        # Usar el contexto para evitar recalcular para cada categoría del mismo fondo.
        context = self.context
        cache_key = f"carga_horaria_fondo_{fondo.id}"

        if cache_key not in context:
            # Calcular totales para todas las categorías de este fondo una sola vez.
            cargas = CargaHoraria.objects.filter(
                docente=fondo.docente,
                calendario=fondo.calendario_academico
            ).values('categoria').annotate(total=Sum('horas'))
            
            context[cache_key] = {item['categoria']: item['total'] for item in cargas}

        horas_jefatura = context[cache_key].get(obj.tipo, 0) or 0
        return horas_jefatura

    def get_porcentaje(self, obj):
        total_horas_categoria = obj.total_horas or 0
        fondo = obj.fondo_tiempo
        if not fondo.horas_efectivas or fondo.horas_efectivas == 0:
            return 0
        return (total_horas_categoria / fondo.horas_efectivas) * 100

    def get_detalles_carga(self, obj):
        fondo = obj.fondo_tiempo
        if not fondo.docente or not fondo.calendario_academico:
            return []

        # Usar el contexto para evitar recalcular para cada categoría del mismo fondo.
        context = self.context
        cache_key = f"carga_horaria_detalles_{fondo.id}"

        if cache_key not in context:
            # Obtener todas las cargas de este fondo en una sola consulta
            cargas = CargaHoraria.objects.filter(
                docente=fondo.docente,
                calendario=fondo.calendario_academico
            )
            
            # Agrupar por categoría en memoria
            detalles_map = {}
            for carga in cargas:
                if carga.categoria not in detalles_map:
                    detalles_map[carga.categoria] = []
                
                detalles_map[carga.categoria].append({
                    "id": carga.id,
                    "materia_id": carga.materia_id,
                    "categoria": carga.categoria,
                    "tipo_actividad": carga.tipo_actividad,
                    "tipo_actividad_display": CARGA_HORARIA_TIPOS_LABELS.get(carga.tipo_actividad, carga.tipo_actividad.replace('_', ' ').title() if carga.tipo_actividad else ''),
                    "es_subactividad_academica": carga.categoria == 'academica' and carga.tipo_actividad != 'clases_aula',
                    "materia_titulo": (
                        f"{carga.materia.sigla} - {carga.materia.nombre} ({carga.paralelo})"
                        if carga.materia else ''
                    ),
                    "titulo_actividad": (
                        f"{carga.materia.sigla} - {carga.materia.nombre} ({carga.paralelo})"
                        if carga.materia and carga.tipo_actividad == 'clases_aula' else carga.titulo_actividad
                    ),
                    "horas": carga.horas,
                    "evidencias": carga.evidencias,
                    "respaldo": carga.documento_respaldo
                })
            
            context[cache_key] = detalles_map

        return context[cache_key].get(obj.tipo, [])


class FondoTiempoSerializer(serializers.ModelSerializer):
    docente_nombre = serializers.CharField(source='docente.nombre_completo', read_only=True)
    carrera_nombre = serializers.CharField(source='carrera.nombre', read_only=True)
    categorias = CategoriaFuncionSerializer(many=True, read_only=True) # Nested serializer explícito
    requerimientos = CategoriaFuncionSerializer(many=True, read_only=True, source='categorias') # Alias para frontend
    porcentaje_completado = serializers.SerializerMethodField()
    proyectos = serializers.SerializerMethodField()
    horas_disponibles = serializers.SerializerMethodField()
    total_asignado = serializers.SerializerMethodField()
    informe_actual = serializers.SerializerMethodField()
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get('request')
        # Para docentes, la URL del programa analítico es de solo lectura (ver/clic pero no editar)
        perfil = get_effective_profile(request.user, request) if request else None
        if perfil and perfil.rol == 'docente':
            self.fields['programa_analitico_url'].read_only = True
    # Aseguramos que se devuelva la URL como string explícito
    programa_analitico_url = serializers.URLField(required=False, allow_blank=True)

    class Meta:
        model = FondoTiempo
        fields = '__all__'
        read_only_fields = [
            'estado', 'horas_efectivas', 'fecha_aprobacion', 
            'fecha_validacion', 'fecha_inicio_ejecucion', 'fecha_informe', 'fecha_finalizacion'
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return _filtrar_categorias_investigacion_para_iisyp(data, self.context)
    
    def get_proyectos(self, obj):
        """Devuelve los proyectos asociados usando el serializer de lista definido más abajo."""
        return ProyectoListSerializer(obj.proyectos.all(), many=True).data

    def get_total_asignado(self, obj):
        if not hasattr(obj, '_total_asignado_calculado'):
            if not obj.docente or not obj.calendario_academico:
                total = 0
            else:
                # Obtener mapa de horas de Jefatura
                cargas = CargaHoraria.objects.filter(
                    docente=obj.docente,
                    calendario=obj.calendario_academico
                ).values('categoria').annotate(total=Sum('horas'))
                cargas_map = {c['categoria']: c['total'] for c in cargas}

                # Sumar iterando sobre las categorías del fondo
                total_calculado = 0
                for cat in obj.categorias.all():
                    horas_jefatura = cargas_map.get(cat.tipo, 0)
                    # Si hay horas de jefatura (>0), se usan esas. Si no, las manuales.
                    total_calculado += cat.total_horas
                
                total = total_calculado
            obj._total_asignado_calculado = total
        return obj._total_asignado_calculado

    def get_porcentaje_completado(self, obj):
        total_asignado = self.get_total_asignado(obj)
        if not obj.horas_efectivas or obj.horas_efectivas == 0:
            return 0
        return (total_asignado / obj.horas_efectivas) * 100

    def validate(self, data):
        """
         BLINDAJE: Validación de horas acumuladas (Límite 56 horas semanales)
        Verifica que la suma de todas las actividades no supere el límite del docente.
        """
        # Obtener el docente (puede venir en data o ya existir en la instancia)
        docente = data.get('docente')
        if not docente and hasattr(self, 'instance') and self.instance:
            docente = self.instance.docente
        
        if not docente:
            return data
        
        # Obtener horas máximas del docente según su primer vínculo activo
        primer_vinculo = DocenteCarrera.objects.filter(
            docente=docente, activo=True
        ).first()
        calendario = data.get('calendario_academico')
        if not calendario and hasattr(self, 'instance') and self.instance:
            calendario = self.instance.calendario_academico

        tipo_fondo = data.get('tipo_fondo', self.instance.tipo_fondo if self.instance else 'semestral')
        if calendario and tipo_fondo == 'semestral':
            duplicado_qs = FondoTiempo.objects.filter(
                docente=docente,
                calendario_academico=calendario,
                tipo_fondo='semestral',
            )
            if self.instance:
                duplicado_qs = duplicado_qs.exclude(pk=self.instance.pk)
            if duplicado_qs.exists():
                raise serializers.ValidationError({
                    'docente': 'Este docente ya tiene un fondo de tiempo registrado para el periodo seleccionado'
                })

        horas_maximas_semanales = primer_vinculo.horas_semanales_maximas if primer_vinculo else 0
        
        # Calcular total de horas asignadas en este fondo de tiempo
        total_horas_asignadas = Decimal(0)
        
        # Si estamos actualizando, obtener las categorías existentes
        if self.instance and hasattr(self.instance, 'categorias'):
            for categoria in self.instance.categorias.all():
                total_horas_asignadas += categoria.total_horas or Decimal(0)
        
        # Convertir a horas semanales (asumiendo 52 semanas por año)
        horas_semanales_asignadas = total_horas_asignadas / Decimal(52)
        
        # VALIDACION DE LIMITE DE 56 HORAS SEMANALES
        if horas_semanales_asignadas > Decimal('56'):
            raise serializers.ValidationError({
                'horas_efectivas': 
                f'ALERTA L\u00cdMITE EXCEDIDO: La suma de todas las actividades ({horas_semanales_asignadas:.2f} horas/semana) '
                f'supera el máximo permitido de 56 horas semanales. '
                f'Total anual: {total_horas_asignadas:.2f} horas. '
                f'Por favor, reduce la carga de actividades.'
            })
        
        # Validación adicional: comparar con el límite específico del docente
        if horas_semanales_asignadas > horas_maximas_semanales:
            dedicacion_label = primer_vinculo.get_dedicacion_display() if primer_vinculo else 'N/A'
            raise serializers.ValidationError({
                'horas_efectivas':
                f'ALERTA L\u00cdMITE PERSONAL EXCEDIDO: Tu dedicaci\u00f3n ({dedicacion_label}) tiene un l\u00edmite de '
                f'{horas_maximas_semanales} horas semanales, pero has asignado {horas_semanales_asignadas:.2f} horas. '
                f'Por favor, ajusta las actividades para cumplir con tu dedicación.'
            })
        
        return data

    def get_horas_disponibles(self, obj):
        total_asignado = self.get_total_asignado(obj)
        return obj.horas_efectivas - total_asignado

    def get_informe_actual(self, obj):
        """Documento del informe (guardado o precargado con defaults, ver
        _informe_actual_o_borrador)."""
        return _informe_actual_o_borrador(obj)


class FondoTiempoListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listados"""
    docente_nombre = serializers.CharField(source='docente.nombre_completo', read_only=True)
    carrera_nombre = serializers.CharField(source='carrera.nombre', read_only=True)
    periodo_display = serializers.CharField(source='get_periodo_display', read_only=True)
    porcentaje_completado = serializers.SerializerMethodField()
    total_asignado = serializers.SerializerMethodField()
    # Aseguramos que se devuelva la URL como string explícito
    programa_analitico_url = serializers.URLField(read_only=True)
    
    class Meta:
        model = FondoTiempo
        fields = ['id', 'docente', 'docente_nombre', 'carrera', 'carrera_nombre', 
                  'calendario_academico', 'gestion', 'periodo', 'periodo_display',
                  'asignatura', 'total_asignado', 'horas_efectivas',
                  'porcentaje_completado', 'estado', 'programa_analitico_url']

    def get_total_asignado(self, obj):
        # NOTA DE RENDIMIENTO: Esto puede causar N+1 queries en la vista de lista.
        # Para optimizar, se podría anotar el queryset en el ViewSet.
        if not hasattr(obj, '_total_asignado_calculado'):
            if not obj.docente or not obj.calendario_academico:
                total = 0
            else:
                # Lógica Híbrida Unificada (Igual que en Detalle)
                cargas = CargaHoraria.objects.filter(
                    docente=obj.docente,
                    calendario=obj.calendario_academico
                ).values('categoria').annotate(total=Sum('horas'))
                cargas_map = {c['categoria']: c['total'] for c in cargas}

                total_calculado = 0
                for cat in obj.categorias.all():
                    horas_jefatura = cargas_map.get(cat.tipo, 0)
                    total_calculado += cat.total_horas
                
                total = total_calculado
            obj._total_asignado_calculado = total
        return obj._total_asignado_calculado

    def get_porcentaje_completado(self, obj):
        total_asignado = self.get_total_asignado(obj)
        if not obj.horas_efectivas or obj.horas_efectivas == 0:
            return 0
        return (total_asignado / obj.horas_efectivas) * 100


# ============================================
# SERIALIZERS PARA GESTION DE USUARIOS
# ============================================

class PerfilUsuarioSerializer(serializers.ModelSerializer):
    carrera_nombre = serializers.SerializerMethodField()
    docente_nombre = serializers.SerializerMethodField()
    docente_id = serializers.SerializerMethodField()
    foto_perfil = serializers.SerializerMethodField()
    foto_perfil_es_propia = serializers.SerializerMethodField()

    # Campos de datos laborales (vacaciones, feriados, antiguedad)
    fecha_ingreso = serializers.SerializerMethodField()
    dias_vacacion = serializers.SerializerMethodField()
    horas_feriados_gestion = serializers.SerializerMethodField()
    antiguedad = serializers.SerializerMethodField()

    class Meta:
        model = PerfilUsuario
        fields = [
            'id', 'rol', 'carrera', 'carrera_nombre', 'docente', 'docente_id', 'docente_nombre',
            'telefono', 'activo', 'foto_perfil', 'foto_perfil_es_propia', 'debe_cambiar_password',
            'fecha_ingreso', 'dias_vacacion', 'horas_feriados_gestion', 'antiguedad',
        ]

    def get_carrera_nombre(self, obj):
        return obj.carrera.nombre if obj.carrera else None

    def get_docente_nombre(self, obj):
        return obj.docente.nombre_completo if obj.docente else None

    def get_docente_id(self, obj):
        return obj.docente.id if obj.docente else None

    def get_foto_perfil(self, obj):
        return obj.get_foto_perfil_data_uri()

    def get_foto_perfil_es_propia(self, obj):
        return bool(obj.foto_perfil_cifrada)

    def get_fecha_ingreso(self, obj):
        datos = obj.obtener_datos_laborales()
        return datos.fecha_ingreso if datos else None

    def get_dias_vacacion(self, obj):
        datos = obj.obtener_datos_laborales()
        if datos:
            return datos.dias_vacacion
        return 0

    def get_horas_feriados_gestion(self, obj):
        datos = obj.obtener_datos_laborales()
        if datos:
            return datos.horas_feriados_gestion
        return 0

    def get_antiguedad(self, obj):
        return obj.calcular_antiguedad()


class FotoPerfilSerializer(serializers.Serializer):
    foto_perfil = serializers.ImageField(required=False, allow_null=True)

    def to_representation(self, instance):
        return {'foto_perfil': instance.get_foto_perfil_data_uri()}

    def update(self, instance, validated_data):
        incoming = validated_data.get('foto_perfil', serializers.empty)

        if incoming is serializers.empty:
            return instance

        if incoming is None:
            instance.clear_foto_perfil()
        else:
            instance.set_foto_perfil_cifrada(incoming)

        instance.save(update_fields=['foto_perfil', 'foto_perfil_cifrada', 'foto_perfil_mime'])
        return instance


class UsuarioSerializer(serializers.ModelSerializer):
    perfil = serializers.SerializerMethodField()
    nombre_completo = serializers.SerializerMethodField()
    ci = serializers.SerializerMethodField()
    carrera_codigo = serializers.SerializerMethodField()
    telefono = serializers.SerializerMethodField()
    asignaciones = serializers.SerializerMethodField()
    asignaciones_activas = serializers.SerializerMethodField()
    asignacion_activa = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'nombre_completo',
              'is_staff', 'is_superuser', 'is_active', 'date_joined', 'perfil',
              'ci', 'carrera_codigo', 'telefono', 'asignaciones',
              'asignaciones_activas', 'asignacion_activa']
        read_only_fields = ['id', 'date_joined']

    def get_perfil(self, obj):
        """
        Retorna los datos del perfil si existe, de lo contrario retorna None.
        Esto previene errores si un usuario no tiene un perfil asociado.
        """
        if hasattr(obj, 'perfil'):
            data = PerfilUsuarioSerializer(obj.perfil, context=self.context).data
            request = self.context.get('request')
            perfil_efectivo = get_effective_profile(obj, request) if request and request.user.id == obj.id else None

            if perfil_efectivo and perfil_efectivo is not obj.perfil:
                data['rol'] = perfil_efectivo.rol
                data['rol_display'] = dict(PerfilUsuario.ROLES).get(perfil_efectivo.rol, perfil_efectivo.rol)
                data['carrera'] = perfil_efectivo.carrera_id
                data['carrera_nombre'] = perfil_efectivo.carrera.nombre if perfil_efectivo.carrera else None
                data['carrera_codigo'] = perfil_efectivo.carrera.codigo if perfil_efectivo.carrera else None
                data['docente'] = perfil_efectivo.docente_id
                data['docente_id'] = perfil_efectivo.docente_id
                data['docente_nombre'] = perfil_efectivo.docente.nombre_completo if perfil_efectivo.docente else None

            # PROTECCION INTEGRAL: Validar vinculo docente
            # GARANT\u00cdA DE ACCESO: Si es superusuario, el frontend SIEMPRE debe verlo como iiisyp
            if obj.is_superuser:
                data['rol'] = 'iiisyp'
                # FIX: Forzar que al admin NUNCA se le pida cambio de contraseña, ignorando la BD
                data['debe_cambiar_password'] = False
                # Los superusuarios nunca tienen error de vínculo
                data.pop('error_vinculo', None)
                data.pop('mensaje_error', None)
            return data

        # Fallback de seguridad: Si es superusuario pero NO tiene perfil creado (error de integridad),
        # devolvemos una estructura simulada de admin para no bloquear el acceso.
        if obj.is_superuser:
            return {
                'id': None,
                'rol': 'iiisyp',
                'carrera': None,
                'carrera_codigo': None,
                'docente': None,
                'docente_nombre': None,
                'telefono': '',
                'activo': True,
                'foto_perfil': None,
                'debe_cambiar_password': False
            }
        return None

    def get_nombre_completo(self, obj):
        """
        Retorna el nombre completo del usuario, o el username si no tiene nombre.
        """
        nombre_completo = obj.get_full_name()
        return nombre_completo if nombre_completo else obj.username

    def get_ci(self, obj):
        """
        Retorna el CI del docente vinculado; si no existe, usa CI del perfil.
        """
        if hasattr(obj, 'perfil') and obj.perfil:
            # Priorizar el CI almacenado en el PerfilUsuario (ese es el CI
            # que se captura al crear/editar el usuario). Sólo cuando no
            # exista, usar el CI del docente vinculado (que puede ser
            # temporal si se creó sin CI explícito).
            if obj.perfil.ci:
                return obj.perfil.ci
            if obj.perfil.docente and obj.perfil.docente.ci:
                return obj.perfil.docente.ci
        return None

    def get_carrera_codigo(self, obj):
        """
        Retorna el código de la carrera si el usuario tiene una asignada.
        """
        if hasattr(obj, 'perfil') and obj.perfil and obj.perfil.carrera:
            return obj.perfil.carrera.codigo
        return None

    def get_telefono(self, obj):
        """
        Retorna el teléfono del perfil del usuario.
        """
        if hasattr(obj, 'perfil') and obj.perfil:
            return obj.perfil.telefono or ''
        return ''

    def get_asignaciones(self, obj):
        if not hasattr(obj, 'perfil') or not obj.perfil:
            return []

        asignaciones = obj.asignaciones_carrera.all().order_by('-activo', 'id') if hasattr(obj, 'asignaciones_carrera') else []
        resultado = []
        for asignacion in asignaciones:
            resultado.append({
                'id': asignacion.id,
                'rol': asignacion.rol,
                'rol_display': asignacion.get_rol_display(),
                'carrera': asignacion.carrera_id,
                'carrera_nombre': asignacion.carrera.nombre if asignacion.carrera else None,
                'carrera_codigo': asignacion.carrera.codigo if asignacion.carrera else None,
                'docente': asignacion.docente_id,
                'docente_nombre': asignacion.docente.nombre_completo if asignacion.docente else None,
                'activo': asignacion.activo,
            })
        return resultado

    def get_asignaciones_activas(self, obj):
        return [item for item in self.get_asignaciones(obj) if item.get('activo') is not False]

    def get_asignacion_activa(self, obj):
        request = self.context.get('request')
        return serialize_assignment(get_active_assignment(request))


class CrearUsuarioSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, required=True)
    asignaciones = serializers.JSONField(write_only=True, required=False, allow_null=True)
    # Se definen los roles explícitamente para evitar problemas de carga
    # en el servidor de desarrollo que puedan mostrar una lista incompleta.
    rol = serializers.ChoiceField(choices=[
        ('iiisyp', 'Instituto de investigación'),
        ('director', 'Director de Carrera'),
        ('jefe_estudios', 'Jefe de Estudios'),
        ('docente', 'Docente')], required=True)
    carrera = serializers.PrimaryKeyRelatedField(
        queryset=Carrera.objects.all(),
        required=False,
        allow_null=True
    )
    docente = serializers.PrimaryKeyRelatedField(
        queryset=Docente.objects.all(),
        required=False,
        allow_null=True
    )
    # Campo para recibir datos de un nuevo docente a crear
    docente_data = serializers.JSONField(write_only=True, required=False, allow_null=True)
    ci = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'password_confirm', 'first_name',
                  'last_name', 'rol', 'carrera', 'docente', 'docente_data', 'asignaciones', 'ci']
        extra_kwargs = {
            'first_name': {'required': False, 'allow_blank': True},
            'last_name': {'required': False, 'allow_blank': True},
            'email': {'required': False, 'allow_blank': True},
        }

    def validate(self, data):
        # Obtener usuario actual del contexto (quien está creando)
        request = self.context.get('request')
        current_user = request.user if request else None
        asignaciones = data.get('asignaciones') or []

        if asignaciones and not isinstance(asignaciones, list):
            raise serializers.ValidationError({'asignaciones': 'Debe enviar una lista de asignaciones.'})

        if asignaciones and not all(isinstance(item, dict) for item in asignaciones):
            raise serializers.ValidationError({'asignaciones': 'Cada asignación debe ser un objeto con rol y carrera.'})

        bloques = [{
            'rol': data.get('rol'),
            'carrera': data.get('carrera'),
            'docente': data.get('docente'),
            'docente_data': data.get('docente_data'),
        }] + asignaciones

        carreras_gestionables = _carreras_gestionables_director(current_user)
        if current_user and not current_user.is_superuser:
            if _rol_usuario_solicitante(current_user) != 'director':
                raise serializers.ValidationError({
                    'detail': 'No tienes permiso para crear usuarios.'
                })
            _validar_bloques_en_carreras_gestionables(bloques, carreras_gestionables)
            self.context['carreras_gestionables'] = carreras_gestionables

        _validar_limite_asignaciones_usuario(bloques)
        _validar_reglas_asignaciones_usuario(bloques, docente_por_defecto=data.get('docente'))
        _validar_fondo_tiempo_contractual_doble_rol(
            bloques,
            docente_por_defecto=data.get('docente'),
        )
        
        # Identificar tipos de roles en el conjunto de asignaciones
        roles_totales = [data.get('rol')] + [a.get('rol') for a in asignaciones]
        tiene_rol_docente = 'docente' in roles_totales
        es_administrativo = any(r in ['director', 'jefe_estudios'] for r in roles_totales)

        # Validar que las contraseñas coincidan
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Las contraseñas no coinciden'
            })

        # Validar carrera en bloques administrativos
        for bloque in bloques:
            bloque_rol = bloque.get('rol')
            if bloque_rol in ['director', 'jefe_estudios'] and not bloque.get('carrera'):
                raise serializers.ValidationError({
                    'carrera': 'Los administradores, directores y jefes de estudio deben tener una carrera asignada'
                })

        ci_normalizado = (data.get('ci') or '').strip()

        if ci_normalizado:
            perfil_ci = obtener_perfil_por_ci(ci_normalizado)
            if perfil_ci and perfil_ci.user and perfil_ci.user_id:
                if current_user and not current_user.is_superuser and _rol_usuario_solicitante(current_user) == 'director':
                    self.context['usuario_existente_por_ci'] = perfil_ci.user
                else:
                    raise serializers.ValidationError({
                        'ci': 'Ya existe un usuario con este C.I.'
                    })
            if perfil_ci and not perfil_ci.user_id and not perfil_ci_es_reutilizable(perfil_ci, data['rol']):
                raise serializers.ValidationError({
                    'ci': 'Ese C.I. sigue reservado por un perfil huérfano con historial del sistema. No se puede reutilizar automáticamente.'
                })

        data['ci'] = ci_normalizado or None

        # Validar unicidad de cargos por carrera (director, jefe_estudios)
        for bloque in bloques:
            bloque_rol = bloque.get('rol')
            if bloque_rol in ['director', 'jefe_estudios']:
                validar_unicidad_cargo_por_carrera(_resolver_carrera_asignacion(bloque.get('carrera')) or data.get('carrera'), bloque_rol)

        if data.get('docente') and not data['docente'].activo:
            raise serializers.ValidationError({
                'docente': 'No se puede vincular un docente inactivo a un usuario.'
            })

        if data.get('docente') and data.get('docente_data'):
            raise serializers.ValidationError("No puede seleccionar un docente existente y crear uno nuevo al mismo tiempo.")

        return data

    def create(self, validated_data):
        with transaction.atomic():
            # Extraer datos del perfil
            validated_data.pop('password_confirm')
            rol = validated_data.pop('rol')
            carrera = validated_data.pop('carrera', None)
            docente = validated_data.pop('docente', None)
            docente_data = validated_data.pop('docente_data', None)
            asignaciones_extra = validated_data.pop('asignaciones', []) or []
            ci = validated_data.pop('ci', None)
            usuario_existente = self.context.get('usuario_existente_por_ci')

            if usuario_existente:
                roles_extra = [a.get('rol') for a in asignaciones_extra]
                tiene_rol_docente = (rol == 'docente') or ('docente' in roles_extra)
                perfil_existente = PerfilUsuario.objects.filter(user=usuario_existente).select_related('docente', 'carrera').first()

                docente_obj = docente
                if tiene_rol_docente and not docente_obj:
                    if perfil_existente and perfil_existente.docente:
                        docente_obj = perfil_existente.docente
                    else:
                        perfil_ci = obtener_perfil_por_ci(ci)
                        docente_obj = perfil_ci.docente if perfil_ci and perfil_ci.docente else None

                if docente_obj and docente_obj.activo is False:
                    raise serializers.ValidationError({
                        'docente': 'No se puede asignar ni vincular un docente inactivo.'
                    })

                if rol in ['director', 'jefe_estudios'] and not usuario_existente.is_staff:
                    usuario_existente.is_staff = True
                    usuario_existente.save(update_fields=['is_staff'])

                if perfil_existente:
                    update_fields = []
                    if not perfil_existente.ci and ci:
                        perfil_existente.ci = ci
                        update_fields.append('ci')
                    if not perfil_existente.carrera_id and carrera:
                        perfil_existente.carrera = carrera
                        update_fields.append('carrera')
                    if docente_obj and not perfil_existente.docente_id:
                        perfil_existente.docente = docente_obj
                        update_fields.append('docente')
                    if perfil_existente.activo is False:
                        perfil_existente.activo = True
                        update_fields.append('activo')
                    if update_fields:
                        perfil_existente.save(update_fields=update_fields)

                bloques_asignacion = [{'rol': rol, 'carrera': carrera, 'docente': docente_obj}] + asignaciones_extra
                _guardar_asignaciones_usuario(
                    usuario_existente,
                    bloques_asignacion,
                    docente_por_defecto=docente_obj,
                    carreras_gestionables=self.context.get('carreras_gestionables'),
                )
                return usuario_existente

            # Crear usuario
            user = User.objects.create_user(
                username=validated_data['username'],
                email=validated_data.get('email', ''),
                password=validated_data['password'],
                first_name=validated_data.get('first_name', ''),
                last_name=validated_data.get('last_name', '')
            )

            # Determinar roles para lógica de creación
            roles_extra = [a.get('rol') for a in asignaciones_extra]
            tiene_rol_docente = (rol == 'docente') or ('docente' in roles_extra)

            # El perfil se crea automáticamente con rol 'docente' via signal.
            # Ahora lo actualizamos con los datos correctos.
            docente_obj = None

            # FIX DOBLE ROL: Resolver/crear el Docente si 'docente' está presente en
            # CUALQUIER asignación (principal o secundaria en asignaciones_extra).
            # Antes solo se evaluaba `rol == 'docente'`, lo que dejaba docente_obj=None
            # cuando el docente venía como rol secundario (ej. iiisyp + docente),
            # provocando que el perfil quedara sin vínculo y errores 500 posteriores.
            datos_docente_resolucion = docente_data
            docente_ref_resolucion = docente
            if not datos_docente_resolucion and not docente_ref_resolucion:
                for asignacion in asignaciones_extra:
                    if str(asignacion.get('rol') or '').strip() != 'docente':
                        continue
                    docente_data_extra = asignacion.get('docente_data')
                    if isinstance(docente_data_extra, dict) and docente_data_extra:
                        datos_docente_resolucion = docente_data_extra
                        break
                    docente_ref_extra = asignacion.get('docente')
                    if docente_ref_extra:
                        docente_ref_resolucion = docente_ref_extra
                        break

            if tiene_rol_docente:
                if datos_docente_resolucion:
                    docente_serializer = DocenteSerializer(data=datos_docente_resolucion)
                    docente_serializer.is_valid(raise_exception=True)
                    docente_obj = docente_serializer.save()
                elif docente_ref_resolucion:
                    docente_obj = docente_ref_resolucion

                if not ci and docente_obj:
                    ci_docente = (docente_obj.ci or '').strip()
                    ci = ci_docente or None

            perfil_existente = None
            if docente_obj:
                perfil_existente = PerfilUsuario.objects.filter(docente=docente_obj).select_related('user').first()
                if perfil_existente and perfil_existente.user and perfil_existente.user_id != user.id:
                    raise serializers.ValidationError({
                        'docente': f'El docente "{docente_obj.nombre_completo}" ya esta vinculado a otro usuario.'
                    })

            # Asignar is_staff solo a roles de autoridad reales
            if rol in ['director', 'jefe_estudios']:
                user.is_staff = True
                user.save(update_fields=['is_staff'])

            # Actualizar perfil (se crea automáticamente por signal)
            # VERIFICACION: Si no existe el perfil, crearlo manualmente
            perfil_ci = obtener_perfil_por_ci(ci)
            perfil_actual_usuario = PerfilUsuario.objects.filter(user=user).first()

            def resolver_conflicto_ci(perfil_destino):
                ci_normalizado = (ci or '').strip() if isinstance(ci, str) else ci
                if not ci_normalizado:
                    return

                conflicto = PerfilUsuario.objects.filter(ci=ci_normalizado).exclude(pk=perfil_destino.pk).first()
                if not conflicto:
                    return

                if conflicto.user_id and conflicto.user_id != user.id:
                    raise serializers.ValidationError({'ci': 'Ya existe un usuario con este C.I.'})

                # Si el conflicto es un perfil huérfano, liberar su CI antes de reasignarlo.
                conflicto.ci = None
                conflicto.save(update_fields=['ci'])

            if perfil_existente:
                perfil = perfil_existente
                if perfil_actual_usuario and perfil_actual_usuario.id != perfil.id:
                    perfil_actual_usuario.user = None
                    perfil_actual_usuario.save(update_fields=['user'])
                resolver_conflicto_ci(perfil)
                perfil.user = user
                perfil.rol = rol
                perfil.carrera = carrera or perfil.carrera
                perfil.docente = docente_obj
                perfil.ci = ci
                perfil.telefono = ''
                perfil.activo = True
                perfil.debe_cambiar_password = False
                perfil.save()
            elif perfil_ci_es_reutilizable(perfil_ci, rol):
                perfil = perfil_ci
                if perfil_actual_usuario and perfil_actual_usuario.id != perfil.id:
                    perfil_actual_usuario.user = None
                    perfil_actual_usuario.save(update_fields=['user'])
                resolver_conflicto_ci(perfil)
                perfil.user = user
                perfil.rol = rol
                perfil.carrera = carrera or perfil.carrera
                perfil.docente = docente_obj
                perfil.ci = ci
                perfil.telefono = ''
                perfil.activo = True
                perfil.debe_cambiar_password = False
                perfil.save()
            elif not perfil_actual_usuario:
                # Crear DatosLaborales si es administrativo puro y no hay perfil previo
                dl_obj = None
                if not tiene_rol_docente and ci:
                    from .models import DatosLaborales
                    dl_obj, _ = DatosLaborales.objects.get_or_create(
                        ci=ci,
                        defaults={
                            'fecha_ingreso': timezone.now().date(),
                            'dias_vacacion': 15
                        }
                    )

                PerfilUsuario.objects.create(
                    user=user,
                    rol=rol,
                    carrera=carrera,
                    docente=docente_obj,
                    datos_laborales=dl_obj,
                    ci=ci,
                    telefono='',
                    activo=True,
                    debe_cambiar_password=False
                )
            else:
                # Perfil existe, actualizarlo y asegurar DatosLaborales para admin puro
                if not tiene_rol_docente and ci and not perfil_actual_usuario.datos_laborales:
                    from .models import DatosLaborales
                    dl_obj, _ = DatosLaborales.objects.get_or_create(
                        ci=ci,
                        defaults={
                            'fecha_ingreso': timezone.now().date(),
                            'dias_vacacion': 15
                        }
                    )
                    perfil_actual_usuario.datos_laborales = dl_obj

                resolver_conflicto_ci(perfil_actual_usuario)
                perfil_actual_usuario.rol = rol
                perfil_actual_usuario.carrera = carrera
                perfil_actual_usuario.docente = docente_obj
                perfil_actual_usuario.ci = ci
                perfil_actual_usuario.save()

            # Mantener sincronizado el email del docente con el email del usuario
            # en el flujo de creación de cuentas de rol docente.
            # FIX DOBLE ROL: usar tiene_rol_docente para que también aplique cuando
            # el docente viene como asignación secundaria (rol principal no-docente).
            if tiene_rol_docente and docente_obj:
                email_usuario = (validated_data.get('email') or '').strip()
                if email_usuario and docente_obj.email != email_usuario:
                    docente_obj.email = email_usuario
                    docente_obj.save(update_fields=['email'])

            bloques_asignacion = [{'rol': rol, 'carrera': carrera, 'docente': docente_obj}] + asignaciones_extra
            _guardar_asignaciones_usuario(
                user,
                bloques_asignacion,
                docente_por_defecto=docente_obj,
                carreras_gestionables=self.context.get('carreras_gestionables'),
            )

            return user


class ActualizarUsuarioSerializer(serializers.ModelSerializer):
    # Se definen los roles explícitamente para asegurar que la opción 'Jefe de Estudios'
    # siempre esté disponible en los formularios de edición.
    rol = serializers.ChoiceField(choices=[
        ('iiisyp', 'Instituto de investigación'),
        ('director', 'Director de Carrera'),
        ('jefe_estudios', 'Jefe de Estudios'),
        ('docente', 'Docente')], required=False)
    asignaciones = serializers.JSONField(write_only=True, required=False, allow_null=True)
    carrera = serializers.PrimaryKeyRelatedField(
        queryset=Carrera.objects.all(), 
        required=False, 
        allow_null=True
    )
    docente = serializers.PrimaryKeyRelatedField(
        queryset=Docente.objects.all(), 
        required=False, 
        allow_null=True
    )
    # Campo para recibir datos de un nuevo docente a crear
    docente_data = serializers.JSONField(write_only=True, required=False, allow_null=True)
    ci = serializers.CharField(required=False, allow_blank=True)
    
    class Meta:
        model = User
        fields = ['email', 'first_name', 'last_name', 'is_active', 
                  'rol', 'carrera', 'docente', 'docente_data', 'asignaciones', 'ci']
        extra_kwargs = {
            'first_name': {'allow_blank': False},
            'last_name': {'allow_blank': False},
            'email': {'allow_blank': False},
        }

    def to_internal_value(self, data):
        """
        Compatibilidad hacia atrás: acepta id_rol como alias de rol.
        """
        incoming = data.copy() if hasattr(data, 'copy') else dict(data)
        if 'id_rol' in incoming and 'rol' not in incoming:
            incoming['rol'] = incoming.get('id_rol')
        return super().to_internal_value(incoming)

    def _get_perfil_actual(self):
        return PerfilUsuario.objects.filter(user=self.instance).first()

    def _mensaje_conflicto_ci_docente(self, docente_conflicto):
        perfil_vinculado = PerfilUsuario.objects.filter(docente=docente_conflicto).select_related('user').first()
        if perfil_vinculado and perfil_vinculado.user:
            rol_conflicto = perfil_vinculado.get_rol_display() if hasattr(perfil_vinculado, 'get_rol_display') else perfil_vinculado.rol
            return f'El CI ya esta registrado en el usuario "{perfil_vinculado.user.username}" ({rol_conflicto}).'
        return f'El CI ya esta registrado en el docente "{docente_conflicto.nombre_completo}".'
    
    def validate(self, data):
        """
        Valida los datos para asegurar la consistencia al cambiar de rol.
        """
        # Obtener usuario actual del contexto (quien está editando)
        request = self.context.get('request')
        current_user = request.user if request else None
        asignaciones = data.get('asignaciones') or []
        
        # Obtener perfil actual al inicio para evitar UnboundLocalError
        perfil_actual = self._get_perfil_actual()

        if asignaciones and not isinstance(asignaciones, list):
            raise serializers.ValidationError({'asignaciones': 'Debe enviar una lista de asignaciones.'})

        if asignaciones and not all(isinstance(item, dict) for item in asignaciones):
            raise serializers.ValidationError({'asignaciones': 'Cada asignación debe ser un objeto con rol y carrera.'})

        bloques = [{
            'rol': data.get('rol'),
            'carrera': data.get('carrera'),
            'docente': data.get('docente'),
            'docente_data': data.get('docente_data'),
        }] + asignaciones

        carreras_gestionables = _carreras_gestionables_director(current_user)
        if current_user and not current_user.is_superuser and _rol_usuario_solicitante(current_user) == 'director':
            _validar_bloques_en_carreras_gestionables(bloques, carreras_gestionables)
            self.context['carreras_gestionables'] = carreras_gestionables
            bloques_validacion = _combinar_bloques_con_asignaciones_externas(
                self.instance,
                bloques,
                carreras_gestionables,
            )
        else:
            bloques_validacion = bloques

        _validar_limite_asignaciones_usuario(bloques_validacion)
        _validar_reglas_asignaciones_usuario(
            bloques_validacion,
            docente_por_defecto=data.get('docente') or (perfil_actual.docente if perfil_actual else None),
        )
        _validar_fondo_tiempo_contractual_doble_rol(
            bloques_validacion,
            docente_por_defecto=data.get('docente') or (perfil_actual.docente if perfil_actual else None),
        )

        # Lógica de Doble Rol
        roles_totales = [data.get('rol', perfil_actual.rol if perfil_actual else 'docente')] + [a.get('rol') for a in asignaciones]
        tiene_rol_docente = 'docente' in roles_totales
        es_administrativo = any(r in ['director', 'jefe_estudios'] for r in roles_totales)

        # Regla global de seguridad: solo el superusuario puede cambiar roles.
        solicita_cambio_rol = (
            hasattr(self, 'initial_data')
            and ('rol' in self.initial_data or 'id_rol' in self.initial_data)
        )
        if solicita_cambio_rol and (
            not current_user
            or (not current_user.is_superuser and _rol_usuario_solicitante(current_user) != 'director')
        ):
            raise serializers.ValidationError({
                'rol': 'Solo el Superusuario tiene la potestad de cambiar el rol de cualquier usuario en el sistema.'
            })
        
        rol_actual = perfil_actual.rol if perfil_actual else ('iiisyp' if self.instance.is_superuser else 'docente')
        carrera_actual = perfil_actual.carrera if perfil_actual else None
        docente_actual = perfil_actual.docente if perfil_actual else None

        # Determina el rol final (el nuevo si se provee, o el existente si no)
        rol = data.get('rol', rol_actual)
        carrera_final = data.get('carrera', carrera_actual)
        is_active_final = data.get('is_active', self.instance.is_active)
        es_superusuario_objetivo = bool(self.instance.is_superuser)

        # Regla de inmutabilidad de rol con uso real del sistema.
        if 'rol' in data and rol != rol_actual:
            if usuario_tiene_uso_de_rol(self.instance, perfil_actual=perfil_actual):
                raise serializers.ValidationError({
                    'rol': (
                        'No se puede cambiar el rol de este usuario porque ya tiene registros asociados '
                        '(fondos, historial, informes u otras operaciones).'
                    )
                })

        if es_superusuario_objetivo:
            if 'is_active' in data and data.get('is_active') is False:
                raise serializers.ValidationError({'is_active': 'El Super Admin no puede desactivarse.'})
            if 'rol' in data and data.get('rol') != 'iiisyp':
                raise serializers.ValidationError({'rol': 'El rol del Super Admin no puede modificarse.'})
            if asignaciones:
                raise serializers.ValidationError({'asignaciones': 'El Super Admin no maneja asignaciones de carrera.'})

        # Regla 0.5: Director y Jefe de Estudio deben tener carrera
        if not es_superusuario_objetivo:
            for bloque in bloques:
                bloque_rol = bloque.get('rol')
                if bloque_rol in ['director', 'jefe_estudios']:
                    if 'carrera' in bloque and bloque.get('carrera') is None:
                        raise serializers.ValidationError({'carrera': 'Los administradores, directores y jefes de estudio deben tener una carrera asignada.'})
                    if bloque is bloques[0] and 'carrera' not in data and not carrera_actual:
                        raise serializers.ValidationError({'carrera': 'Debe asignar una carrera para este rol.'})
                    if is_active_final:
                        validar_unicidad_cargo_por_carrera(
                            bloque.get('carrera') or carrera_final,
                            bloque_rol,
                            exclude_user_id=self.instance.id,
                        )

        # Regla 1: Directores y Jefes de Estudio deben tener una carrera.
        if rol in ['director', 'jefe_estudios'] and 'carrera' not in data:
            # Validación adicional específica para director/jefe
            pass  # La validación ya se hizo arriba

        # Regla 1.5: Bloquear docente solo si NO tiene rol docente en ninguna parte
        if es_administrativo and not tiene_rol_docente:
            if data.get('docente') is not None:
                raise serializers.ValidationError({
                    'docente': f'Un usuario con rol {rol.replace("_", " ")} no puede tener un docente vinculado.'
                })
        
        # Regla 2: Si se vincula un docente, debe ser valido y exclusivo.
        if tiene_rol_docente:
            docente_objetivo = data.get('docente', docente_actual)

            if docente_objetivo is not None and docente_objetivo.activo is False:
                raise serializers.ValidationError({
                    'docente': 'No se puede vincular un docente inactivo a un usuario.'
                })

            if docente_objetivo is not None:
                perfil_docente = PerfilUsuario.objects.filter(docente=docente_objetivo).select_related('user').first()
                if perfil_docente and perfil_docente.user and perfil_docente.user_id != self.instance.id:
                    raise serializers.ValidationError({
                        'docente': f'El docente "{docente_objetivo.nombre_completo}" ya esta vinculado al usuario "{perfil_docente.user.username}".'
                    })

        # Regla 3: Ningun usuario del sistema puede quedar sin CI.
        ci_en_request = data.get('ci', serializers.empty)
        if ci_en_request is serializers.empty:
            ci_normalizado = (perfil_actual.ci or '').strip() if perfil_actual and perfil_actual.ci else ''
        else:
            ci_normalizado = (ci_en_request or '').strip()
            data['ci'] = ci_normalizado

        if es_administrativo and not ci_normalizado:
            raise serializers.ValidationError({'ci': 'El C.I. es obligatorio para este tipo de usuario.'})

        if tiene_rol_docente:
            docente_objetivo = data.get('docente', docente_actual)
            if docente_objetivo is not None:
                ci_docente_objetivo = (docente_objetivo.ci or '').strip()
                if not ci_docente_objetivo and ci_normalizado:
                     # Permitir usar el CI del request si el docente no tiene uno
                     pass
                elif not ci_docente_objetivo:
                    raise serializers.ValidationError({'docente': 'El docente vinculado debe tener C.I. registrado.'})
            elif not ci_normalizado:
                raise serializers.ValidationError({'ci': 'El C.I. es obligatorio para usuarios docentes sin docente vinculado.'})

        return data
    
    def update(self, instance, validated_data):
        perfil, _ = PerfilUsuario.objects.get_or_create(
            user=instance,
            defaults={
                'rol': 'iiisyp' if instance.is_superuser else 'docente',
                'activo': instance.is_active,
                'debe_cambiar_password': not instance.is_superuser,
            }
        )
        ci = validated_data.pop('ci', None)
        asignaciones_extra = validated_data.pop('asignaciones', None)

        # 1. Actualizar campos del modelo User
        instance.email = validated_data.get('email', instance.email)
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.is_active = validated_data.get('is_active', instance.is_active)

        # 2. Determinar el rol final y si ha cambiado
        new_rol = validated_data.get('rol')
        role_changed = new_rol and new_rol != perfil.rol
        final_rol = new_rol or perfil.rol

        # Lógica de Doble Rol para el guardado
        roles_extra = [a.get('rol') for a in (asignaciones_extra or [])]
        roles_totales = [final_rol] + roles_extra
        tiene_rol_docente = 'docente' in roles_totales

        # Actualizar el rol en el perfil
        perfil.rol = final_rol
        perfil.activo = instance.is_active

        # 3. Ajustar 'is_staff' según el rol final
        if final_rol in ['director', 'jefe_estudios']:
            instance.is_staff = True
        else:
            instance.is_staff = False

        # 4. Gestionar 'carrera'
        if 'carrera' in validated_data:
            carrera = validated_data.get('carrera')
            perfil.carrera = carrera
            if perfil.docente and carrera:
                DocenteCarrera.objects.get_or_create(
                    docente=perfil.docente,
                    carrera=carrera,
                    defaults={'categoria': 'asistente', 'dedicacion': 'horario_40'},
                )

        # 4.1 Gestionar 'ci' (se guarda en Docente si existe vínculo)
        if ci is not None:
            ci_normalizado = ci.strip() if ci else ''
            docente_objetivo = validated_data.get('docente', perfil.docente)
            
            # Si el CI es vacío, limpiar
            if not ci_normalizado:
                perfil.ci = None
            else:
                # Validar que no exista en otros docentes (siempre), excluyendo el docente actual o el seleccionado
                docentes_con_ci = Docente.objects.filter(datos_laborales__ci=ci_normalizado)
                docentes_a_excluir = []
                if perfil.docente:
                    docentes_a_excluir.append(perfil.docente.id)
                if docente_objetivo:
                    docentes_a_excluir.append(docente_objetivo.id)
                if docentes_a_excluir:
                    docentes_con_ci = docentes_con_ci.exclude(id__in=docentes_a_excluir)

                docente_conflicto = docentes_con_ci.first()
                if docente_conflicto:
                    raise serializers.ValidationError({'ci': self._mensaje_conflicto_ci_docente(docente_conflicto)})
                
                # Validar que no exista en otros perfiles
                perfiles_conflicto = PerfilUsuario.objects.filter(
                    ci=ci_normalizado
                ).exclude(id=perfil.id).exists()
                if perfiles_conflicto:
                    perfil_conflicto = PerfilUsuario.objects.filter(ci=ci_normalizado).exclude(id=perfil.id).select_related('user').first()
                    if perfil_conflicto and perfil_conflicto.user:
                        rol_conflicto = perfil_conflicto.get_rol_display() if hasattr(perfil_conflicto, 'get_rol_display') else perfil_conflicto.rol
                        raise serializers.ValidationError({'ci': f'El CI ya esta registrado en el usuario "{perfil_conflicto.user.username}" ({rol_conflicto}).'})
                    raise serializers.ValidationError({'ci': 'El CI ya esta registrado en otro usuario.'})
                
                # Guardar CI en docente si existe vínculo
                if docente_objetivo:
                    _actualizar_ci_docente(docente_objetivo, ci_normalizado)
                
                # Guardar CI en perfil
                perfil.ci = ci_normalizado

        # 5. Gestionar 'docente'
        if tiene_rol_docente:
            if 'docente_data' in validated_data and validated_data.get('docente_data'):
                docente_serializer = DocenteSerializer(data=validated_data['docente_data'])
                docente_serializer.is_valid(raise_exception=True)
                docente_obj = docente_serializer.save()
                perfil.docente = docente_obj
            elif 'docente' in validated_data:
                docente_objetivo = validated_data.get('docente')

                if docente_objetivo is not None and docente_objetivo.activo is False:
                    raise serializers.ValidationError({
                        'docente': 'No se puede vincular un docente inactivo a un usuario.'
                    })

                # Si existe un perfil huerfano (user=None) para ese docente,
                # liberamos el docente de ese perfil y transferimos datos utiles.
                if docente_objetivo is not None:
                    perfil_huerfano = PerfilUsuario.objects.filter(
                        docente=docente_objetivo,
                        user__isnull=True,
                    ).exclude(id=perfil.id).first()

                    if perfil_huerfano:
                        if not perfil.carrera and perfil_huerfano.carrera:
                            perfil.carrera = perfil_huerfano.carrera
                        if not perfil.telefono and perfil_huerfano.telefono:
                            perfil.telefono = perfil_huerfano.telefono

                        perfil_huerfano.docente = None
                        perfil_huerfano.save(update_fields=['docente'])

                perfil.docente = docente_objetivo
        else:
            # Si NO tiene rol docente en ninguna asignación, limpiar vínculo
            perfil.docente = None

        # 5.1 Asegurar DatosLaborales para administrativos puros
        if not perfil.docente and ci and not perfil.datos_laborales:
            from .models import DatosLaborales
            perfil.datos_laborales, _ = DatosLaborales.objects.get_or_create(
                ci=ci.strip(),
                defaults={'fecha_ingreso': timezone.now().date()}
            )
        
        # 6. Guardar el perfil con todos los cambios
        perfil.save()

        if asignaciones_extra is not None:
            bloques_asignacion = [{'rol': final_rol, 'carrera': perfil.carrera, 'docente': perfil.docente}] + asignaciones_extra
            _guardar_asignaciones_usuario(
                instance,
                bloques_asignacion,
                docente_por_defecto=perfil.docente,
                carreras_gestionables=self.context.get('carreras_gestionables'),
            )
        
        # 7. Guardar el usuario. La señal post_save se encargará de sincronizar es_active.
        instance.save()

        # Regla de independencia: si el usuario queda inactivo, también se inactiva su docente vinculado.
        if instance.is_active is False and perfil.docente and perfil.docente.activo:
            perfil.docente.activo = False
            perfil.docente.save(update_fields=['activo'])
        
        return instance
    
# ============================================
# SERIALIZERS PARA MODELOS NUEVOS (Reglamento UAB)
# ============================================

from .models import CalendarioAcademico, Proyecto, InformeFondo, ObservacionFondo, HistorialFondo


# =====================================================
# CALENDARIO ACADEMICO SERIALIZER
# =====================================================

class CalendarioAcademicoSerializer(serializers.ModelSerializer):
    periodo_display = serializers.CharField(source='get_periodo_display', read_only=True)
    carrera_nombre = serializers.CharField(source='carrera.nombre', read_only=True)
    
    class Meta:
        model = CalendarioAcademico
        fields = [
            'id', 'carrera', 'carrera_nombre', 'gestion', 'periodo', 'periodo_display',
            'fecha_inicio', 'fecha_fin',
            'fecha_inicio_presentacion_proyectos',
            'fecha_limite_presentacion_proyectos',
            'fecha_limite_programas_analiticos',
            'fecha_inicio_receso',
            'fecha_fin_receso',
            'semanas_efectivas', 'activo'
        ]

    def validate(self, attrs):
        instance = getattr(self, 'instance', None)

        carrera = attrs.get('carrera', getattr(instance, 'carrera', None))
        fecha_inicio = attrs.get('fecha_inicio', getattr(instance, 'fecha_inicio', None))
        fecha_fin = attrs.get('fecha_fin', getattr(instance, 'fecha_fin', None))
        fecha_inicio_proy = attrs.get(
            'fecha_inicio_presentacion_proyectos',
            getattr(instance, 'fecha_inicio_presentacion_proyectos', None)
        )
        fecha_fin_proy = attrs.get(
            'fecha_limite_presentacion_proyectos',
            getattr(instance, 'fecha_limite_presentacion_proyectos', None)
        )
        fecha_limite_programas = attrs.get(
            'fecha_limite_programas_analiticos',
            getattr(instance, 'fecha_limite_programas_analiticos', None)
        )
        fecha_inicio_receso = attrs.get(
            'fecha_inicio_receso',
            getattr(instance, 'fecha_inicio_receso', None)
        )
        fecha_fin_receso = attrs.get(
            'fecha_fin_receso',
            getattr(instance, 'fecha_fin_receso', None)
        )
        semanas_efectivas = attrs.get('semanas_efectivas', getattr(instance, 'semanas_efectivas', None))
        gestion = attrs.get('gestion', getattr(instance, 'gestion', None))
        periodo = attrs.get('periodo', getattr(instance, 'periodo', None))

        if not carrera:
            raise serializers.ValidationError({
                'carrera': 'Debe seleccionar una carrera.'
            })

        if carrera and gestion and periodo:
            duplicados = CalendarioAcademico.objects.filter(
                carrera=carrera,
                gestion=gestion,
                periodo=periodo,
            )
            if instance:
                duplicados = duplicados.exclude(pk=instance.pk)
            if duplicados.exists():
                raise serializers.ValidationError({
                    'non_field_errors': ['Ya existe un calendario para esta carrera, gestion y periodo.']
                })

        if fecha_inicio and fecha_fin and fecha_fin < fecha_inicio:
            raise serializers.ValidationError({
                'fecha_fin': 'La fecha de finalización no puede ser anterior a la de inicio.'
            })

        if fecha_inicio and fecha_fin:
            calendarios_solapados = CalendarioAcademico.objects.filter(
                carrera=carrera,
                fecha_inicio__lte=fecha_fin,
                fecha_fin__gte=fecha_inicio,
            )
            if instance:
                calendarios_solapados = calendarios_solapados.exclude(pk=instance.pk)
            if calendarios_solapados.exists():
                raise serializers.ValidationError({
                    'non_field_errors': ['Las fechas se solapan con otro calendario academico existente.']
                })

            if semanas_efectivas is not None:
                semanas_reales = (fecha_fin - fecha_inicio).days / 7
                if abs(float(semanas_efectivas) - semanas_reales) > 2:
                    raise serializers.ValidationError({
                        'semanas_efectivas': 'Las semanas efectivas no son coherentes con el rango de fechas seleccionado (margen máximo de 2 semanas)'
                    })

        if fecha_inicio_proy and fecha_fin_proy and fecha_fin_proy <= fecha_inicio_proy:
            raise serializers.ValidationError({
                'fecha_limite_presentacion_proyectos': 'La fecha límite de proyectos debe ser posterior a la fecha de inicio.'
            })

        if fecha_inicio and fecha_fin and fecha_inicio_proy:
            if fecha_inicio_proy < fecha_inicio or fecha_inicio_proy > fecha_fin:
                raise serializers.ValidationError({
                    'fecha_inicio_presentacion_proyectos': 'Error Crítico: la fecha de inicio de presentación de proyectos debe estar dentro del rango del periodo académico.'
                })

        if fecha_inicio and fecha_fin and fecha_fin_proy:
            if fecha_fin_proy < fecha_inicio or fecha_fin_proy > fecha_fin:
                raise serializers.ValidationError({
                    'fecha_limite_presentacion_proyectos': 'Error Crítico: la fecha límite de presentación de proyectos debe estar dentro del rango del periodo académico.'
                })

        if fecha_inicio and fecha_fin and fecha_limite_programas:
            if fecha_limite_programas < fecha_inicio or fecha_limite_programas > fecha_fin:
                raise serializers.ValidationError({
                    'fecha_limite_programas_analiticos': 'La fecha limite de programas analiticos debe estar dentro del rango del periodo academico.'
                })

        if fecha_inicio_receso and fecha_fin_receso and fecha_inicio_receso > fecha_fin_receso:
            raise serializers.ValidationError({
                'fecha_fin_receso': 'La fecha de fin de receso debe ser posterior o igual a la fecha de inicio de receso.'
            })

        if fecha_inicio and fecha_fin and fecha_inicio_receso:
            if fecha_inicio_receso < fecha_inicio or fecha_inicio_receso > fecha_fin:
                raise serializers.ValidationError({
                    'fecha_inicio_receso': 'La fecha de inicio de receso debe estar dentro del rango del periodo academico.'
                })

        if fecha_inicio and fecha_fin and fecha_fin_receso:
            if fecha_fin_receso < fecha_inicio or fecha_fin_receso > fecha_fin:
                raise serializers.ValidationError({
                    'fecha_fin_receso': 'La fecha de fin de receso debe estar dentro del rango del periodo academico.'
                })

        return attrs


# =====================================================
# PROYECTO SERIALIZER
# =====================================================

class ProyectoSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    modalidad_display = serializers.CharField(source='get_modalidad_display', read_only=True)
    fondo_asignatura = serializers.CharField(source='fondo_tiempo.asignatura', read_only=True)
    categoria_nombre = serializers.CharField(source='categoria.get_tipo_display', read_only=True)
    
    class Meta:
        model = Proyecto
        fields = [
            'id', 'fondo_tiempo', 'fondo_asignatura', 'categoria', 'categoria_nombre',
            'titulo', 'tipo', 'tipo_display',
            # Campos obligatorios Art. 16
            'antecedentes', 'justificacion', 'objetivos', 'problema', 'cronograma',
            # Campos Art. 17 (cursos/seminarios)
            'es_curso_seminario', 'bibliografia', 'grupo_objetivo',
            'requisitos_asistencia', 'modalidad', 'modalidad_display',
            'frecuencia', 'horas_diarias', 'material_didactico',
            # Control
            'estado', 'estado_display', 'fecha_presentacion', 'fecha_aprobacion',
            'fecha_inicio', 'fecha_fin',
            'fecha_creacion', 'fecha_modificacion'
        ]
        read_only_fields = ['fecha_creacion', 'fecha_modificacion']


class ProyectoListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listados"""
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    fondo_asignatura = serializers.CharField(source='fondo_tiempo.asignatura', read_only=True)
    
    class Meta:
        model = Proyecto
        fields = [
            'id', 'titulo', 'tipo', 'tipo_display', 'estado', 'estado_display',
            'fondo_tiempo', 'fondo_asignatura', 'fecha_inicio', 'fecha_fin'
        ]


# =====================================================
# INFORME FONDO SERIALIZER
# =====================================================

class InformeFondoSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    cumplimiento_display = serializers.CharField(source='get_cumplimiento_display', read_only=True)
    elaborado_por_nombre = serializers.CharField(source='elaborado_por.get_full_name', read_only=True)
    evaluado_por_nombre = serializers.SerializerMethodField()
    fondo_asignatura = serializers.CharField(source='fondo_tiempo.asignatura', read_only=True)

    class Meta:
        model = InformeFondo
        fields = [
            'id', 'fondo_tiempo', 'fondo_asignatura',
            'tipo', 'tipo_display', 'estado', 'estado_display', 'fecha_elaboracion',
            'elaborado_por', 'elaborado_por_nombre',
            'resumen_ejecutivo', 'actividades_realizadas', 'resultados',
            'logros' , 'dificultades',
            'evidencias', 'observaciones',
            'encabezado_texto', 'fecha_texto',
            'destinatario_nombre', 'destinatario_cargo',
            'remitente_nombre', 'remitente_cargo', 'referencia_texto',
            'saludo_intro_html', 'cierre_html',
            'firma_nombre', 'firma_cargo', 'firma_email',
            'seccion_academica', 'seccion_investigacion', 'seccion_extension_interaccion',
            'seccion_asesorias_tutorias', 'seccion_academica_administrativa',
            'seccion_social_cultural_deportiva', 'conclusiones_generales',
            'cumplimiento', 'cumplimiento_display',
            'evaluacion_director', 'fecha_evaluacion',
            'evaluado_por', 'evaluado_por_nombre',
            'archivo_adjunto', 'evidencia', 'fecha_modificacion'
        ]
        read_only_fields = ['fecha_elaboracion', 'fecha_modificacion']

    def get_evaluado_por_nombre(self, obj):
        """Retorna el nombre completo del evaluador si existe."""
        if obj.evaluado_por:
            return obj.evaluado_por.get_full_name()
        return None

    def to_representation(self, instance):
        """Precarga con el texto calculado desde Docente/Carrera/Director
        (ver informe_texto.construir_defaults_informe) cualquiera de los 12
        campos del documento tipo carta que el docente aun no personalizo
        (quedaron en blanco), para que el editor siempre muestre el
        documento completo "precargado" en vez de campos vacios."""
        data = super().to_representation(instance)
        try:
            defaults = construir_defaults_informe(instance.fondo_tiempo)
        except Exception:
            defaults = {}
        for campo in CAMPOS_TEXTO_INFORME:
            if not (data.get(campo) or '').strip():
                data[campo] = defaults.get(campo, '')
        return data


def _informe_actual_o_borrador(fondo):
    """Informe 'parcial' mas reciente del fondo, ya serializado (con los 12
    campos del documento precargados por InformeFondoSerializer). Si el
    docente todavia no guardo ningun borrador, arma un dict sintetico
    (id=None, estado='borrador') con el documento completo precargado desde
    Docente/Carrera/Director, para que el editor tipo Word siempre tenga
    algo que mostrar aunque no exista fila en InformeFondo todavia."""
    informe = fondo.informes.filter(tipo='parcial').order_by('-fecha_elaboracion').first()
    if informe:
        return InformeFondoSerializer(informe).data
    defaults = construir_defaults_informe(fondo)
    return {
        'id': None,
        'fondo_tiempo': fondo.id,
        'tipo': 'parcial',
        'tipo_display': 'Informe Parcial',
        'estado': 'borrador',
        'estado_display': 'Borrador',
        'seccion_academica': '', 'seccion_investigacion': '',
        'seccion_extension_interaccion': '', 'seccion_asesorias_tutorias': '',
        'seccion_academica_administrativa': '', 'seccion_social_cultural_deportiva': '',
        'conclusiones_generales': '',
        'evaluacion_director': '', 'fecha_evaluacion': None,
        **defaults,
    }


class InformeFondoListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listados"""
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    cumplimiento_display = serializers.CharField(source='get_cumplimiento_display', read_only=True)
    fondo_asignatura = serializers.CharField(source='fondo_tiempo.asignatura', read_only=True)
    
    class Meta:
        model = InformeFondo
        fields = [
            'id', 'fondo_tiempo', 'fondo_asignatura', 'tipo', 'tipo_display',
            'cumplimiento', 'cumplimiento_display', 'fecha_elaboracion',
            'archivo_adjunto', 'evidencia'
        ]


class InformeAsignaturaEjecutadaSerializer(serializers.ModelSerializer):
    class Meta:
        model = InformeAsignaturaEjecutada
        fields = [
            'id', 'fondo_tiempo', 'nombre_materia', 'inscritos',
            'aprobados', 'reprobados', 'habilitados', 'fecha_creacion'
        ]
        read_only_fields = ['fecha_creacion']


# =====================================================
# OBSERVACION FONDO SERIALIZER
# =====================================================

class MensajeObservacionSerializer(serializers.ModelSerializer):
    """Serializer para mensajes individuales"""
    autor_nombre = serializers.SerializerMethodField()
    leido = serializers.SerializerMethodField()
    entregado = serializers.SerializerMethodField()
    responde_a_detalle = serializers.SerializerMethodField()

    def get_autor_nombre(self, obj):
        nombre_completo = f"{obj.autor.first_name} {obj.autor.last_name}".strip()
        if nombre_completo:
            return nombre_completo
        return obj.autor.username

    autor_username = serializers.CharField(source='autor.username', read_only=True)

    def get_leido(self, obj):
        return bool(obj.leido_en)

    def get_entregado(self, obj):
        return bool(obj.pk)

    def get_responde_a_detalle(self, obj):
        if not obj.responde_a_id:
            return None

        mensaje = obj.responde_a
        nombre_completo = f"{mensaje.autor.first_name} {mensaje.autor.last_name}".strip()
        return {
            'id': mensaje.id,
            'autor': mensaje.autor_id,
            'autor_nombre': nombre_completo or mensaje.autor.username,
            'autor_username': mensaje.autor.username,
            'texto': mensaje.texto,
            'fecha': mensaje.fecha,
        }
    
    class Meta:
        model = MensajeObservacion
        fields = [
            'id', 'observacion', 'autor', 'autor_nombre', 'autor_username',
            'responde_a', 'responde_a_detalle', 'texto', 'fecha',
            'leido_en', 'leido', 'entregado', 'es_admin', 'es_interno'
        ]
        read_only_fields = [
            'id', 'autor', 'fecha', 'responde_a_detalle', 'leido_en',
            'leido', 'entregado', 'es_admin'
        ]


def _usuario_puede_ver_mensajes_internos(request):
    """
    True si el usuario puede ver notas internas entre Director y Jefe de
    Estudios: superuser, o ROL ACTIVO (no el perfil base) director/jefe_estudios.

    Importante: se usa `get_effective_profile`, no `user.perfil` directo. Un
    mismo usuario puede tener un perfil base con un rol (p. ej. 'iiisyp') y
    ademas ser Docente titular de una carrera via AsignacionCarrera; cuando
    esta operando como Docente (rol activo = 'docente', segun el header
    X-Active-Role que envia el selector de rol del frontend), NO debe ver
    las notas internas aunque su perfil base sea de otro rol con más acceso.
    El docente dueño del fondo NUNCA debe ver estas notas.
    """
    user = getattr(request, 'user', None) if request else None
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    if user.is_superuser:
        return True
    perfil = get_effective_profile(user, request)
    return bool(perfil and perfil.rol in ['director', 'jefe_estudios'])


class ObservacionFondoSerializer(serializers.ModelSerializer):
    """Serializer para hilos de observación"""
    mensajes = serializers.SerializerMethodField()
    resuelta_por_nombre = serializers.SerializerMethodField()
    cantidad_mensajes = serializers.SerializerMethodField()
    ultimo_mensaje = serializers.SerializerMethodField()

    class Meta:
        model = ObservacionFondo
        fields = [
            'id', 'fondo_tiempo', 'fecha_creacion', 'resuelta',
            'resuelta_por', 'resuelta_por_nombre', 'fecha_resolucion',
            'mensajes', 'cantidad_mensajes', 'ultimo_mensaje'
        ]
        read_only_fields = ['id', 'fecha_creacion', 'resuelta', 'resuelta_por', 'fecha_resolucion']

    def _mensajes_visibles(self, obj):
        """
        Filtra las notas internas (Director <-> Jefe de Estudios) para
        cualquier usuario que no sea Director, Jefe de Estudios, IIISYP o
        superuser -- en particular, para el docente dueño del fondo.
        """
        mensajes = obj.mensajes.all()
        request = self.context.get('request')
        if _usuario_puede_ver_mensajes_internos(request):
            return list(mensajes)
        return [m for m in mensajes if not m.es_interno]

    def get_mensajes(self, obj):
        return MensajeObservacionSerializer(self._mensajes_visibles(obj), many=True).data

    def get_cantidad_mensajes(self, obj):
        return len(self._mensajes_visibles(obj))

    def get_ultimo_mensaje(self, obj):
        visibles = self._mensajes_visibles(obj)
        ultimo = visibles[-1] if visibles else None
        if ultimo:
            return {
                'texto': ultimo.texto,
                'autor': ultimo.autor.get_full_name(),
                'fecha': ultimo.fecha,
                'es_admin': ultimo.es_admin
            }
        return None

    def get_resuelta_por_nombre(self, obj):
        """Retorna el nombre completo del usuario que resolvió la observación."""
        if obj.resuelta_por:
            return obj.resuelta_por.get_full_name()
        return None



# =====================================================
# HISTORIAL FONDO SERIALIZER
# =====================================================

class HistorialFondoSerializer(serializers.ModelSerializer):
    tipo_cambio_display = serializers.CharField(source='get_tipo_cambio_display', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)
    fondo_asignatura = serializers.CharField(source='fondo_tiempo.asignatura', read_only=True)
    
    class Meta:
        model = HistorialFondo
        fields = [
            'id', 'fondo_tiempo', 'fondo_asignatura',
            'usuario', 'usuario_nombre', 'fecha',
            'tipo_cambio', 'tipo_cambio_display', 'descripcion',
            'estado_anterior', 'estado_nuevo', 'datos_cambio'
        ]
        read_only_fields = ['fecha']


# =====================================================
# ACTUALIZACION DE DOCENTE SERIALIZER
# =====================================================

class DocenteDetalleSerializer(serializers.ModelSerializer):
    """Serializer completo con propiedades calculadas"""
    nombre_completo = serializers.ReadOnlyField()
    vinculos = DocenteCarreraSerializer(
        source='vinculos_carrera', many=True, read_only=True
    )

    class Meta:
        model = Docente
        fields = [
            'id', 'nombres', 'apellido_paterno', 'apellido_materno', 'ci',
            'fecha_ingreso', 'dias_vacacion', 'horas_feriados_gestion',
            'email', 'telefono', 'activo', 'fecha_creacion',
            'nombre_completo', 'vinculos',
        ]


# =====================================================
# ACTUALIZACION DE FONDO TIEMPO SERIALIZER
# =====================================================

class FondoTiempoDetalleSerializer(serializers.ModelSerializer):
    """Serializer completo con todas las relaciones"""
    docente = DocenteDetalleSerializer(read_only=True)
    carrera = CarreraSerializer(read_only=True)
    calendario_academico = CalendarioAcademicoSerializer(read_only=True)
    
    periodo_display = serializers.CharField(source='get_periodo_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    # Aseguramos que se devuelva la URL como string explícito
    programa_analitico_url = serializers.URLField(read_only=True)
    
    # Propiedades calculadas
    porcentaje_completado = serializers.SerializerMethodField()
    horas_disponibles = serializers.SerializerMethodField()
    antiguedad = serializers.SerializerMethodField()
    
    # Relaciones
    categorias = CategoriaFuncionSerializer(many=True, read_only=True) # Nested serializer explícito
    requerimientos = CategoriaFuncionSerializer(many=True, read_only=True, source='categorias') # Alias para frontend
    proyectos = ProyectoListSerializer(many=True, read_only=True)
    informes = InformeFondoListSerializer(many=True, read_only=True)
    asignaturas_ejecutadas = InformeAsignaturaEjecutadaSerializer(many=True, read_only=True)
    observaciones_detalladas = ObservacionFondoSerializer(many=True, read_only=True)
    informe_actual = serializers.SerializerMethodField()
    
    total_asignado = serializers.SerializerMethodField()
    # Permisos
    puede_editar = serializers.SerializerMethodField()
    puede_presentar = serializers.SerializerMethodField()
    
    class Meta:
        model = FondoTiempo
        fields = [
            'id', 'docente', 'carrera', 'calendario_academico',
            'gestion', 'periodo', 'periodo_display', 'asignatura',
            'semanas_a\u00f1o', 'horas_semana', 'horas_vacacion', 'horas_feriados',
            'contrato_horas', 'clases_aula_horas', 'funciones_sustantivas_horas',
            'horas_efectivas', 'total_asignado',
            'estado', 'estado_display', 'observaciones',
            'tiene_programa_analitico', 'programa_analitico_url',
            'fecha_presentacion', 'fecha_aprobacion', 'fecha_validacion',
            'aprobado_por', 'validado_por',
            'archivado', 'comentarios_admin',
            'fecha_creacion', 'fecha_modificacion',
            # Calculados
            'porcentaje_completado', 'horas_disponibles',
            'antiguedad', # Relaciones
            'categorias', 'requerimientos', 'proyectos', 'informes', 'asignaturas_ejecutadas', 'observaciones_detalladas',
            'informe_actual',
            # Permisos
            'puede_editar', 'puede_presentar'
        ]
        read_only_fields = [
            'estado', 'horas_efectivas',
            'fecha_aprobacion', 'fecha_validacion',
            'programa_analitico_url'
        ]
    
    def get_total_asignado(self, obj):
        if not hasattr(obj, '_total_asignado_calculado'):
            if not obj.docente or not obj.calendario_academico:
                total = 0
            else:
                cargas = CargaHoraria.objects.filter(
                    docente=obj.docente,
                    calendario=obj.calendario_academico
                ).values('categoria').annotate(total=Sum('horas'))
                cargas_map = {c['categoria']: c['total'] for c in cargas}

                total_calculado = 0
                for cat in obj.categorias.all():
                    horas_jefatura = cargas_map.get(cat.tipo, 0) or 0
                    total_calculado += cat.total_horas
                
                total = total_calculado
            obj._total_asignado_calculado = total
        return obj._total_asignado_calculado

    def get_porcentaje_completado(self, obj):
        total_asignado = self.get_total_asignado(obj)
        if not obj.horas_efectivas or obj.horas_efectivas == 0:
            return 0
        return float((total_asignado / obj.horas_efectivas) * 100)

    def get_horas_disponibles(self, obj):
        total_asignado = self.get_total_asignado(obj)
        return obj.horas_efectivas - total_asignado

    def get_antiguedad(self, obj):
        if obj.docente:
            return obj.docente.calcular_antiguedad(obj.gestion)
        return 0

    def get_puede_editar(self, obj):
        request = self.context.get('request')
        if request and hasattr(request, 'user'):
            perfil = get_effective_profile(request.user, request)
            if request.user.is_superuser:
                return True
            if obj.estado not in ['borrador', 'observado']:
                return False
            if perfil and perfil.rol in ['director', 'jefe_estudios'] and request.user.is_staff:
                return perfil.carrera_id == obj.carrera_id
            if perfil and perfil.rol == 'docente' and perfil.docente:
                return obj.docente_id == perfil.docente.id
            return obj.puede_editar(request.user)
        return False
    
    def get_puede_presentar(self, obj):
        return obj.puede_presentar()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return _filtrar_categorias_investigacion_para_iisyp(data, self.context)
    
    def get_informe_actual(self, obj):
        """Documento del informe (guardado o precargado con defaults, ver
        _informe_actual_o_borrador)."""
        return _informe_actual_o_borrador(obj)


# =====================================================
# SERIALIZERS PARA ACCIONES ESPEC\u00cdFICAS
# =====================================================

class PresentarFondoSerializer(serializers.Serializer):
    """Serializer para presentar fondo a Director"""
    observacion = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Observación opcional al presentar"
    )
    
    def validate(self, data):
        fondo = self.context.get('fondo')
        
        if not fondo.puede_presentar():
            errores = []
            if not fondo.tiene_programa_analitico:
                errores.append('Debe adjuntar el programa analítico')
            if fondo.total_asignado == 0:
                errores.append('Debe asignar horas a al menos una función')
            
            raise serializers.ValidationError(
                f"No se puede presentar el fondo: {', '.join(errores)}"
            )
        
        return data


class AprobarFondoSerializer(serializers.Serializer):
    """Serializer para aprobar fondo (Director)"""
    observacion = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text="Observación opcional al aprobar"
    )


class ObservarFondoSerializer(serializers.Serializer):
    """Serializer para observar/rechazar fondo"""
    observacion = serializers.CharField(
        required=True,
        min_length=10,
        help_text="Observación (mínimo 10 caracteres)"
    )
    accion = serializers.ChoiceField(
        choices=['observar', 'rechazar'],
        help_text="Acción a realizar"
    )
    
    def validate_observacion(self, value):
        if len(value.strip()) < 10:
            raise serializers.ValidationError(
                'La observación debe tener al menos 10 caracteres'
            )
        return value


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Serializer personalizado para devolver información extra en el login,
    específicamente si el usuario debe cambiar su contraseña.
    """
    def validate(self, attrs):
        identificador = str(attrs.get(self.username_field) or '').strip()
        if identificador:
            attrs[self.username_field] = identificador
            if '@' in identificador:
                usuario_por_correo = User.objects.filter(email__iexact=identificador).order_by('id').first()
                if usuario_por_correo:
                    attrs[self.username_field] = usuario_por_correo.get_username()

        data = super().validate(attrs)
        
        # Agregar claims personalizados a la respuesta del token
        # Lógica de inmunidad: Admin (superuser) nunca es forzado a cambiar contraseña
        if self.user.is_superuser:
            data['debe_cambiar_password'] = False
        else:
            data['debe_cambiar_password'] = self.user.perfil.debe_cambiar_password
            
        data['user_id'] = self.user.id
        data['username'] = self.user.username
        data['rol'] = self.user.perfil.rol
        data['carrera_activa'] = self.user.perfil.carrera_id if hasattr(self.user, 'perfil') and self.user.perfil else None
        data['carreras_activas'] = [
            {
                'id': carrera.id,
                'nombre': carrera.nombre,
                'codigo': carrera.codigo,
            }
            for carrera in (self.user.perfil.get_carreras_activas() if hasattr(self.user, 'perfil') and self.user.perfil else [])
        ]
        
        return data
