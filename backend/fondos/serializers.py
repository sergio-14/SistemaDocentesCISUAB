import json
import re
import uuid

from rest_framework import serializers
from django.contrib.auth.models import User
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import UNIDADES_FONDO, actualizar_con_historial, nombre_calendario_en_fondo, fondo_de_la_carga, mensaje_sin_fondo, roles_del_docente_en_carrera
from .models import Docente, DocenteCarrera, Carrera, FacultadCatalogo, Materia, FondoTiempo, PerfilUsuario, AsignacionCarrera, InformeFondo, ObservacionFondo, MensajeObservacion, HistorialFondo, CargaHoraria, SaldoVacacionesGestion, DatosLaborales, ProgramaAnalitico
from .role_context import get_active_assignment, get_active_careers_for_user, get_effective_profile, serialize_assignment
from .utils.informe_texto import construir_defaults_informe, CAMPOS_TEXTO_INFORME
from .utils.informe_html import CAMPOS_HTML_RICO_INFORME, sanitizar_html_informe
from .utils.informe_imagenes import firmar_imagenes_html
from .utils.archivos import es_pdf
from django.db.models import F, Q, Sum
from django.db import transaction
from decimal import Decimal
from django.utils import timezone
    

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
        'ejercicio_cargo_direccion',
        'ejercicio_cargo_jefatura',
        'ejercicio_cargo_instituto',
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

# Ejercicio del cargo (Art. 13, logística de la carrera): una variante por cargo.
# Solo para el docente con ese cargo activo en la carrera del fondo, y una sola
# vez por fondo (cualquiera de las tres).
TIPOS_EJERCICIO_CARGO = {
    'ejercicio_cargo_direccion': 'director',
    'ejercicio_cargo_jefatura': 'jefe_estudios',
    'ejercicio_cargo_instituto': 'iiisyp',
}


def tipos_ejercicio_cargo_del_fondo(fondo):
    """Variantes de "Ejercicio del cargo" que corresponden al docente del fondo."""
    if not (fondo and fondo.docente_id and fondo.carrera_id):
        return []
    roles = roles_del_docente_en_carrera(fondo.docente, fondo.carrera)
    return [tipo for tipo, rol in TIPOS_EJERCICIO_CARGO.items() if rol in roles]


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
    'ejercicio_cargo_direccion': 'Ejercicio del cargo: Direcci\u00f3n de Carrera',
    'ejercicio_cargo_jefatura': 'Ejercicio del cargo: Jefatura de Estudios',
    'ejercicio_cargo_instituto': 'Ejercicio del cargo: Instituto de Investigaci\u00f3n',
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
    'ejercicio_cargo_direccion': 'Memor\u00e1ndum o resoluci\u00f3n de designaci\u00f3n',
    'ejercicio_cargo_jefatura': 'Memor\u00e1ndum o resoluci\u00f3n de designaci\u00f3n',
    'ejercicio_cargo_instituto': 'Memor\u00e1ndum o resoluci\u00f3n de designaci\u00f3n',
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

    categorias = data.get('categorias')
    if isinstance(categorias, list):
        data['categorias'] = [categoria for categoria in categorias if categoria.get('tipo') == 'investigacion']
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

# Cargos que solo puede tener una persona por carrera.
ROLES_UNICOS_POR_CARRERA = ('director', 'jefe_estudios', 'iiisyp')


def validar_unicidad_cargo_por_carrera(carrera, rol, exclude_user_id=None):
    """
    Garantiza que solo exista un Director, un Jefe de Estudios y un Instituto
    (IIISyP) activos por carrera.

    Se valida con las AsignacionCarrera activas (el cargo puede ser la
    asignación secundaria de un usuario, que su perfil no refleja).
    """
    if rol not in ROLES_UNICOS_POR_CARRERA or not carrera:
        return

    cargos = {
        'director': 'Director',
        'jefe_estudios': 'Jefe de Estudios',
        'iiisyp': 'Instituto (IIISyP)',
    }

    queryset = AsignacionCarrera.objects.filter(
        rol=rol,
        carrera=carrera,
        activo=True,
        user__isnull=False,
        user__is_active=True,
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


def ficha_docente_pendiente(user):
    """True si el usuario tiene rol docente pero todavía no tiene ficha de docente.

    Con un cargo (Director, Jefe, Instituto) sigue activo y solo su parte docente
    queda pendiente. Si solo es docente, queda inactivo hasta crearle la ficha
    (ver desactivar_si_solo_docente_sin_ficha).
    """
    if not user or user.is_superuser:
        return False
    perfil = PerfilUsuario.objects.filter(user=user).first()
    tiene_docencia = (
        AsignacionCarrera.objects.filter(user=user, rol='docente', activo=True).exists()
        or (perfil is not None and (perfil.rol == 'docente' or perfil.inactivo_por_ficha_pendiente))
    )
    return tiene_docencia and docente_del_usuario(user) is None


def carreras_docencia_usuario(user):
    """Ids de las carreras donde el usuario es docente, en orden de asignación.

    Cuenta las asignaciones docentes activas y, si el usuario está inactivo por
    falta de ficha, también las que quedaron en pausa por eso.
    """
    if not user:
        return []
    asignaciones = AsignacionCarrera.objects.filter(user=user, rol='docente')
    perfil = PerfilUsuario.objects.filter(user=user).first()
    if not (perfil and perfil.inactivo_por_ficha_pendiente):
        asignaciones = asignaciones.filter(activo=True)
    ids = []
    for carrera_id in asignaciones.order_by('id').values_list('carrera_id', flat=True):
        if carrera_id not in ids:
            ids.append(carrera_id)
    return ids


def roles_actuales_usuario(user):
    """Rol principal del perfil más los roles de sus asignaciones activas."""
    perfil = PerfilUsuario.objects.filter(user=user).first()
    roles = set(AsignacionCarrera.objects.filter(user=user, activo=True).values_list('rol', flat=True))
    if perfil and perfil.rol:
        roles.add(perfil.rol)
    return roles


def desactivar_si_solo_docente_sin_ficha(user):
    """Un usuario solo docente (sin cargo) no trabaja sin ficha de docente.

    Queda inactivo con la marca inactivo_por_ficha_pendiente, que lo distingue
    de una desactivación manual: solo esa marca lo reactiva al crearle la ficha.
    """
    if not user or user.is_superuser or not user.is_active:
        return False
    if roles_actuales_usuario(user) != {'docente'} or docente_del_usuario(user) is not None:
        return False
    PerfilUsuario.objects.filter(user=user).update(inactivo_por_ficha_pendiente=True)
    user.is_active = False
    # La señal guardar_perfil_usuario inactiva el perfil y sus asignaciones.
    user.save(update_fields=['is_active'])
    return True


def activar_por_ficha_creada(user):
    """Reactiva al usuario que el sistema desactivó por falta de ficha (no al desactivado a mano)."""
    perfil = PerfilUsuario.objects.filter(user=user).first()
    if not perfil or not perfil.inactivo_por_ficha_pendiente:
        return False
    perfil.inactivo_por_ficha_pendiente = False
    perfil.save(update_fields=['inactivo_por_ficha_pendiente'])
    if not user.is_active:
        user.is_active = True
        user.save(update_fields=['is_active'])
    actualizar_con_historial(user.asignaciones_carrera.filter(rol='docente', activo=False), activo=True)
    return True


def docente_del_usuario(user):
    perfil = PerfilUsuario.objects.filter(user=user).select_related('docente').first()
    if perfil and perfil.docente_id:
        return perfil.docente
    return Docente.objects.filter(user=user).first()


def datos_registrados_usuario(user):
    """Datos que el usuario ya generó en el sistema (misma idea que las dependencias de Carrera).

    Si hay alguno, el usuario no se puede eliminar (solo desactivar) y su
    identidad (usuario, nombre y C.I.) queda fija.
    """
    from poa_document.models import (
        HistorialDocumentoPOA, ObservacionDocumentoPOA, OrdenCompraPOA, VersionDocumentoPOA,
    )

    docente = docente_del_usuario(user)
    cargas = Q(creado_por=user) | (Q(docente=docente) if docente else Q())
    dependencias = [
        ('fondos', 'Fondos de tiempo', FondoTiempo.objects.filter(docente=docente).count() if docente else 0),
        ('informes', 'Informes', InformeFondo.objects.filter(Q(elaborado_por=user) | Q(evaluado_por=user)).count()),
        ('cargas_horarias', 'Cargas horarias', CargaHoraria.objects.filter(cargas).count()),
        ('saldos_vacaciones', 'Saldos de vacaciones',
         SaldoVacacionesGestion.objects.filter(docente=docente).count() if docente else 0),
        ('historial_poa', 'Historial POA', sum((
            HistorialDocumentoPOA.objects.filter(usuario=user).count(),
            VersionDocumentoPOA.objects.filter(creado_por=user).count(),
            ObservacionDocumentoPOA.objects.filter(creado_por=user).count(),
            OrdenCompraPOA.objects.filter(creado_por=user).count(),
        ))),
        # Huella que el sistema ya protegía (no repudio).
        ('historial_fondos', 'Historial de fondos', HistorialFondo.objects.filter(usuario=user).count()),
        ('mensajes', 'Mensajes en observaciones', MensajeObservacion.objects.filter(autor=user).count()),
        ('observaciones_resueltas', 'Observaciones resueltas', ObservacionFondo.objects.filter(resuelta_por=user).count()),
        # Al borrar el usuario estos campos quedarían en NULL (SET_NULL) y se perdería quién lo hizo.
        ('fondos_aprobados', 'Fondos aprobados o validados',
         FondoTiempo.objects.filter(Q(aprobado_por=user) | Q(validado_por=user)).count()),
    ]
    detalle = [
        {'clave': clave, 'etiqueta': etiqueta, 'cantidad': cantidad}
        for clave, etiqueta, cantidad in dependencias
        if cantidad > 0
    ]
    return {'detalle': detalle, 'tiene_datos': bool(detalle), 'can_delete': not detalle}


def texto_datos_registrados(datos):
    return ', '.join(f"{item['etiqueta']}: {item['cantidad']}" for item in datos['detalle'])


def obtener_perfil_por_ci(ci):
    ci_normalizado = (ci or '').strip()
    if not ci_normalizado:
        return None
    return PerfilUsuario.objects.filter(ci=ci_normalizado).select_related('user', 'docente').first()


# Estados en los que el fondo ya se presentó: desde ahí la ficha del docente queda fija.
ESTADOS_FONDO_CON_HISTORIAL = [
    'presentado_director', 'aprobado_director', 'en_ejecucion', 'informe_presentado', 'finalizado',
]
MENSAJE_FICHA_CON_HISTORIAL = (
    'La ficha no se puede cambiar: el docente tiene un Fondo de Tiempo presentado o informes.'
)


def docente_tiene_historial_operativo(docente):
    """Historial de la ficha: algún fondo presentado (o más avanzado) o informes.
    Con historial no cambian C.I., fecha de ingreso, carrera ni vínculo. Los fondos en
    borrador u observado no cuentan: al editar la ficha se recalculan."""
    if not docente:
        return False
    return (
        FondoTiempo.objects.filter(docente=docente, estado__in=ESTADOS_FONDO_CON_HISTORIAL).exists()
        or InformeFondo.objects.filter(fondo_tiempo__docente=docente).exists()
    )


def docente_tiene_registros(docente):
    """Cualquier fondo, carga o saldo: el docente no se elimina ni cambia de carrera (sus
    fondos quedarían en otra carrera) y su perfil no se reutiliza por C.I."""
    if not docente:
        return False
    return (
        FondoTiempo.objects.filter(docente=docente).exists()
        or SaldoVacacionesGestion.objects.filter(docente=docente).exists()
        or CargaHoraria.objects.filter(docente=docente).exists()
    )


def carreras_del_director(context):
    """Ids de las carreras del Director que consulta; None si puede ver todas las carreras.

    El Director solo ve el vínculo de su carrera de un docente que enseña en varias.
    Se calcula una vez por respuesta (queda en el contexto del serializer).
    """
    if '_carreras_director' not in context:
        ids = None
        request = context.get('request')
        viewer = getattr(request, 'user', None)
        if viewer and viewer.is_authenticated and not viewer.is_superuser:
            perfil = get_effective_profile(viewer, request)
            if perfil and perfil.rol == 'director':
                ids = set(get_active_careers_for_user(viewer, request).values_list('id', flat=True))
        context['_carreras_director'] = ids
    return context['_carreras_director']


def vinculos_visibles(docente, context):
    """Vínculos de la ficha que puede ver quien consulta (el Director, solo los de su carrera)."""
    vinculos = docente.vinculos_carrera.select_related('carrera')
    propias = carreras_del_director(context)
    return vinculos if propias is None else vinculos.filter(carrera_id__in=propias)


def validar_fecha_ingreso(fecha_ingreso):
    """No futura (hora de Bolivia) ni anterior a la fundación de la UABJB."""
    fecha = fecha_ingreso.date() if hasattr(fecha_ingreso, 'time') else fecha_ingreso
    if fecha > timezone.localdate():
        raise serializers.ValidationError({'fecha_ingreso': 'La fecha de ingreso no puede ser una fecha futura.'})
    if fecha < fecha.replace(year=1967, month=11, day=18):
        raise serializers.ValidationError({'fecha_ingreso': 'La fecha de ingreso no puede ser anterior a la fundacion de la UABJB (18 de noviembre de 1967).'})


def validar_cambio_fecha_ingreso(datos_laborales, fecha_nueva):
    """Con historial (ver docente_tiene_historial_operativo), la fecha de ingreso queda fija.

    La usan la edición del docente y PATCH /api/datos-laborales/.
    """
    if not datos_laborales or datos_laborales.fecha_ingreso == fecha_nueva:
        return
    docente = Docente.objects.filter(datos_laborales=datos_laborales).first()
    if docente and docente_tiene_historial_operativo(docente):
        raise serializers.ValidationError({
            'fecha_ingreso': MENSAJE_FICHA_CON_HISTORIAL,
        })


def usuario_con_varias_carreras_docentes(user):
    """True si la ficha del usuario abarca dos o más carreras: sus datos compartidos solo los edita el superusuario."""
    if not user:
        return False
    carreras = set(carreras_docencia_usuario(user))
    docente = docente_del_usuario(user)
    if docente:
        carreras |= set(docente.vinculos_carrera.filter(activo=True).values_list('carrera_id', flat=True))
    return len(carreras) >= 2


def perfil_ci_es_reutilizable(perfil_ci, rol_objetivo):
    if not perfil_ci or perfil_ci.user_id:
        return False
    if docente_tiene_registros(perfil_ci.docente):
        return False
    return True


def _resolver_carrera_asignacion(valor_carrera):
    if isinstance(valor_carrera, Carrera):
        return valor_carrera
    if valor_carrera in [None, '']:
        return None
    return Carrera.objects.filter(pk=valor_carrera).first()


def _rol_usuario_solicitante(user, request=None):
    """Rol ACTIVO de quien hace la petición (no el rol base del perfil)."""
    perfil = get_effective_profile(user, request) if user else None
    return getattr(perfil, 'rol', None)


def _carreras_gestionables_director(user, request=None):
    """Carreras donde el usuario gestiona usuarios: None (todas) para el superusuario;
    las de su rol activo de Director; ninguna con cualquier otro rol activo."""
    if not user or not getattr(user, 'is_authenticated', False):
        return Carrera.objects.none()

    if user.is_superuser:
        return None

    if _rol_usuario_solicitante(user, request) != 'director':
        return Carrera.objects.none()

    return get_active_careers_for_user(user, request)


def _ids_carreras_gestionables(carreras_gestionables):
    if carreras_gestionables is None:
        return None
    return set(carreras_gestionables.values_list('id', flat=True))


MENSAJE_RESOLUCION_JEFE_OBLIGATORIA = (
    'Adjunte la resolución del Consejo de Carrera (PDF) que designa al Jefe de Estudios.'
)


def _parsear_asignaciones(valor):
    """En multipart (con la resolución del Jefe) las asignaciones llegan como texto JSON."""
    if isinstance(valor, str):
        try:
            return json.loads(valor) if valor.strip() else []
        except ValueError:
            raise serializers.ValidationError('Las asignaciones no son un JSON válido.')
    return valor


def _jefe_nuevo_en_bloques(bloques, user=None):
    """Carrera de un Jefe de Estudios que se asigna ahora (no lo era ya en esa carrera), o None."""
    for bloque in bloques:
        if not isinstance(bloque, dict) or str(bloque.get('rol') or '').strip() != 'jefe_estudios':
            continue
        carrera = _resolver_carrera_asignacion(bloque.get('carrera'))
        if not carrera:
            continue
        if user and AsignacionCarrera.objects.filter(
            user=user, rol='jefe_estudios', carrera=carrera, activo=True,
        ).exists():
            continue
        return carrera
    return None


def _validar_resolucion_jefe(data, bloques, user=None):
    """Designar un Jefe de Estudios exige la resolución del Consejo de Carrera en PDF
    (también al superusuario). Un Jefe que ya lo era no la vuelve a pedir."""
    if _jefe_nuevo_en_bloques(bloques, user) is None:
        return
    archivo = data.get('resolucion_jefe')
    if not archivo:
        raise serializers.ValidationError({'resolucion_jefe': MENSAJE_RESOLUCION_JEFE_OBLIGATORIA})
    if not es_pdf(archivo):
        raise serializers.ValidationError({
            'resolucion_jefe': 'La resolución del Consejo de Carrera debe ser un archivo PDF válido.',
        })


def _guardar_resolucion_jefe(user, archivo):
    """Guarda la resolución en la asignación de Jefe de Estudios del usuario."""
    if not archivo:
        return
    asignacion = AsignacionCarrera.objects.filter(user=user, rol='jefe_estudios', activo=True).first()
    if asignacion:
        asignacion.resolucion_consejo = archivo
        asignacion.save(update_fields=['resolucion_consejo'])


MENSAJE_CARRERA_DEL_EDITOR = 'Solo el superusuario elige la carrera: los usuarios que creas o editas son de tu carrera.'


def _aplicar_carrera_del_editor(data, asignaciones, current_user, editando=False, request=None):
    """Quien no es superusuario (el Director) no elige carrera: es la suya.

    Completa la carrera de cada rol que no la trae y rechaza cualquier otra.
    Al editar, la principal solo se completa si cambia el rol o la carrera.
    """
    if not current_user or not current_user.is_authenticated or current_user.is_superuser:
        return
    carreras = _carreras_gestionables_director(current_user, request)
    if carreras is None:
        return
    ids = list(carreras.values_list('id', flat=True))
    if len(ids) != 1:
        raise serializers.ValidationError({'carrera': 'No tienes una carrera activa asignada para gestionar usuarios.'})
    propia = carreras.first()

    principal = data.get('carrera')
    if principal is not None and principal.pk != propia.pk:
        raise serializers.ValidationError({'carrera': MENSAJE_CARRERA_DEL_EDITOR})
    if not editando or 'rol' in data or 'carrera' in data:
        data['carrera'] = propia

    for bloque in asignaciones:
        if not isinstance(bloque, dict):
            continue
        if bloque.get('carrera') in (None, ''):
            bloque['carrera'] = propia.pk
        elif str(bloque.get('carrera')) != str(propia.pk):
            raise serializers.ValidationError({'carrera': MENSAJE_CARRERA_DEL_EDITOR})


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

        if rol == 'director':
            raise serializers.ValidationError({
                'rol': 'El Director no puede asignar el rol Director de Carrera.'
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


def _rechazar_ficha_desde_usuarios(bloques):
    """Usuarios no crea fichas de docente (antes, con docente_data, las creaba con
    dedicación, condición y fecha inventadas): solo vincula una ficha existente."""
    for bloque in bloques:
        if isinstance(bloque, dict) and bloque.get('docente_data'):
            raise serializers.ValidationError({'docente_data': MENSAJE_FICHA_SOLO_EN_NUEVO_DOCENTE})


def _resolver_docente_asignacion(bloque, docente_por_defecto=None):
    if not isinstance(bloque, dict):
        return docente_por_defecto

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
MENSAJE_CONFLICTO_AUTORIDAD = 'Un usuario no puede tener más de un cargo de mando (Director, Jefe de Estudios o Instituto).'
MENSAJE_INCOMPATIBILIDAD_DEDICACION = 'Seg\u00fan normativa UABJB, los cargos de gesti\u00f3n (Director/Jefe) solo son compatibles con docencia a Tiempo Horario. No se permite dedicaci\u00f3n Tiempo Completo o Medio Tiempo.'
MENSAJE_DOCENTE_DEDICACION_EXCLUSIVA = 'Los usuarios con rol docente deben registrar dedicacion a Tiempo Horario.'
MENSAJE_UNA_SOLA_CARRERA = 'Un usuario pertenece a una sola carrera (la de su contrato): todos sus roles deben ser de esa carrera.'
MENSAJE_CARRERA_OBLIGATORIA = 'Debe seleccionar una carrera para cada rol asignado.'
MENSAJE_EXCLUSIVA_FUERA_DE_FICHA = 'La dedicación exclusiva no se registra en la ficha de docente: solo aplica al Director sin docencia, que no tiene ficha.'
MENSAJE_FICHA_SOLO_DOCENTES = 'Solo los usuarios con rol docente tienen ficha de docente.'
MENSAJE_FICHA_EN_CARRERA_DEL_USUARIO = 'La ficha de docente va en la carrera del usuario (la de su contrato).'
MENSAJE_FICHA_SOLO_EN_NUEVO_DOCENTE = (
    'La ficha de docente se crea en Docentes > Nuevo docente, con su fecha de ingreso, '
    'dedicación y condición reales.'
)


def _validar_carrera_en_bloques(bloques):
    """Todos los roles, no solo Director y Jefe de Estudios, necesitan carrera."""
    for bloque in bloques:
        if isinstance(bloque, dict) and str(bloque.get('rol') or '').strip() and not bloque.get('carrera'):
            raise serializers.ValidationError({'carrera': MENSAJE_CARRERA_OBLIGATORIA})


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
        fecha_ingreso=timezone.localdate(),
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

    autoridades = [item for item in asignaciones if item['rol'] in ROLES_UNICOS_POR_CARRERA]

    # Regla estricta: un usuario no puede tener más de UN cargo de mando
    # (Director, Jefe de Estudios o Instituto), sin importar la carrera.
    if len(autoridades) > 1:
        raise serializers.ValidationError({'asignaciones': MENSAJE_CONFLICTO_AUTORIDAD})

    # Un usuario pertenece a UNA sola carrera (la de su contrato): sus roles (hasta
    # 2, cargo + docente) son todos de esa carrera. También para el superusuario.
    if len({item['carrera'].id for item in asignaciones}) > 1:
        raise serializers.ValidationError({'asignaciones': MENSAJE_UNA_SOLA_CARRERA})


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

        actualizar_con_historial(AsignacionCarrera.objects.filter(user=user, carrera_id__in=ids_permitidos), activo=False)

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

    actualizar_con_historial(AsignacionCarrera.objects.filter(user=user), activo=False)

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
    programa_analitico_url = serializers.SerializerMethodField()
    # Estado del fondo: el programa analítico solo se sube en borrador u observado.
    fondo_estado = serializers.CharField(source='fondo.estado', read_only=True, default=None)
    materia_nombre = serializers.CharField(source='materia.nombre', read_only=True)
    materia_sigla = serializers.CharField(source='materia.sigla', read_only=True)
    # Ítems fuera de Académica (sin calendario): gestión del fondo al que van.
    gestion = serializers.IntegerField(write_only=True, required=False)
    categoria_display = serializers.CharField(source='get_categoria_display', read_only=True)
    creado_por_nombre = serializers.CharField(source='creado_por.get_full_name', read_only=True)

    class Meta:
        model = CargaHoraria
        fields = '__all__'
        read_only_fields = ['creado_por', 'fondo']
        validators = []

    def get_programa_analitico_url(self, obj):
        if obj.tipo_actividad != 'clases_aula' or not obj.calendario_id:
            return None
        programa = ProgramaAnalitico.objects.filter(
            fondo_id=obj.fondo_id, materia_id=obj.materia_id, calendario_id=obj.calendario_id,
        ).first()
        return programa.archivo.url if programa else None

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

        # Materias: en un calendario (de ahí la gestión). Lo demás: horas por año del fondo, sin calendario.
        gestion = data.pop('gestion', None)
        if categoria == 'academica':
            if not calendario:
                raise serializers.ValidationError({'calendario': 'Las materias se asignan en un calendario académico.'})
            gestion = calendario.gestion
        else:
            calendario = None
            data['calendario'] = None
            gestion = gestion or (self.instance.fondo.gestion if self.instance else None)
            if not gestion:
                raise serializers.ValidationError({'gestion': 'Indique la gestión del Fondo de Tiempo.'})

        fondo = None
        if docente and gestion:
            fondo = fondo_de_la_carga(docente, gestion)
            if not fondo:
                raise serializers.ValidationError({'docente': mensaje_sin_fondo(gestion)})
            data['fondo'] = fondo

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
                data['horas'] = (materia.horas_totales or 0) * calendario.semanas_de_clase
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

        materia_cambia = not self.instance or self.instance.materia_id != getattr(materia, 'pk', None)
        if materia and not materia.activo and materia_cambia:
            raise serializers.ValidationError({
                'materia': f'La materia {materia.nombre} está inactiva: no se puede asignar en cargas nuevas.'
            })

        if materia and calendario and materia.carrera_id != calendario.carrera_id:
            raise serializers.ValidationError({
                'materia': 'La materia seleccionada no pertenece a la carrera del calendario académico.'
            })

        es_clase = categoria == 'academica' and tipo_actividad == 'clases_aula'
        if fondo and categoria and tipo_actividad and not es_clase:
            # Cada ítem (y cada sub-actividad académica) se registra una vez por fondo.
            tipo_duplicado = CargaHoraria.objects.filter(fondo=fondo, categoria=categoria, tipo_actividad=tipo_actividad)
            if self.instance:
                tipo_duplicado = tipo_duplicado.exclude(pk=self.instance.pk)
            if tipo_duplicado.exists():
                raise serializers.ValidationError({
                    'tipo_actividad': 'Esta actividad ya está registrada en el Fondo de Tiempo.'
                })

        if tipo_actividad in TIPOS_EJERCICIO_CARGO and fondo:
            # Solo la variante del cargo que el docente ejerce en la carrera del fondo,
            # y una sola vez por fondo (cualquiera de las tres).
            if tipo_actividad not in tipos_ejercicio_cargo_del_fondo(fondo):
                raise serializers.ValidationError({
                    'tipo_actividad': (
                        f'{CARGA_HORARIA_TIPOS_LABELS[tipo_actividad]}: el docente no tiene ese cargo activo '
                        f'en {fondo.carrera.nombre}.'
                    )
                })
            otro_cargo = CargaHoraria.objects.filter(fondo=fondo, tipo_actividad__in=TIPOS_EJERCICIO_CARGO)
            if self.instance:
                otro_cargo = otro_cargo.exclude(pk=self.instance.pk)
            if otro_cargo.exists():
                raise serializers.ValidationError({
                    'tipo_actividad': 'El Ejercicio del cargo ya está registrado en el Fondo de Tiempo.'
                })

        if es_clase and fondo and calendario and materia:
            # Clases en aula: una por calendario, materia y paralelo. La misma materia en otro
            # semestre o en otro paralelo es otra asignación.
            materia_duplicada = CargaHoraria.objects.filter(
                fondo=fondo, tipo_actividad='clases_aula', calendario=calendario, materia=materia, paralelo=paralelo,
            )
            if self.instance:
                materia_duplicada = materia_duplicada.exclude(pk=self.instance.pk)
            if materia_duplicada.exists():
                raise serializers.ValidationError({
                    'materia': (
                        f'La materia {materia.nombre} (paralelo {paralelo}) ya está asignada en '
                        f'{calendario.get_periodo_display()} {calendario.gestion}.'
                    )
                })

        if hora_inicio and hora_fin and hora_fin <= hora_inicio:
            raise serializers.ValidationError({'hora_fin': 'La hora de fin debe ser mayor que la hora de inicio.'})

        if fondo:
            cargas_fondo = CargaHoraria.objects.filter(fondo=fondo)
            if self.instance:
                cargas_fondo = cargas_fondo.exclude(pk=self.instance.pk)

            horas_existentes_fondo = Decimal(cargas_fondo.aggregate(total=Sum('horas'))['total'] or 0)
            total_fondo_anual = horas_existentes_fondo + Decimal(horas_nuevas or 0)
            objetivo_anual = Decimal(str(fondo.horas_efectivas or 0))
            if total_fondo_anual > objetivo_anual:
                exceso_anual = total_fondo_anual - objetivo_anual
                raise serializers.ValidationError({
                    'horas': (
                        f'La suma de las unidades superaría las horas efectivas del fondo ({objetivo_anual.normalize():f}) '
                        f'por {exceso_anual.normalize():f} horas.'
                    )
                })

        # Cruces de horario del docente en cualquier calendario que coincide en fechas
        # (un semestre y un anual, o calendarios de otra carrera).
        if docente and calendario and dia_semana and hora_inicio and hora_fin:
            choques_docente = CargaHoraria.objects.filter(
                docente=docente,
                calendario__fecha_inicio__lte=calendario.fecha_fin,
                calendario__fecha_fin__gte=calendario.fecha_inicio,
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

        if fondo and calendario and materia and tipo_actividad == 'clases_aula':
            self._validar_tope_por_semestre(fondo, calendario, materia, vinculo)

        return data

    def _validar_tope_por_semestre(self, fondo, calendario, materia, vinculo):
        """En cada semestre, las horas semanales de clases en aula (materias del semestre y
        anuales, de todo el fondo) no superan las horas semanales del vínculo."""
        clases = fondo.cargas.filter(
            categoria='academica', tipo_actividad='clases_aula', calendario__isnull=False,
        ).select_related('materia', 'calendario')
        if self.instance:
            clases = clases.exclude(pk=self.instance.pk)
        horas_maximas = vinculo.horas_semanales_maximas if vinculo else 0
        nombres = dict(CalendarioAcademico.PERIODO_CHOICES)
        semestres = ['1', '2'] if calendario.periodo == 'anual' else [calendario.periodo]
        for semestre in semestres:
            total = (materia.horas_totales or 0) + sum(
                carga.materia.horas_totales or 0
                for carga in clases
                if carga.calendario.periodo in (semestre, 'anual')
            )
            if total > horas_maximas:
                raise serializers.ValidationError({
                    'materia': (
                        f'Con esta materia, el {nombres[semestre]} suma {total} h/sem de clases en aula '
                        f'(materias del semestre y anuales) y supera las {horas_maximas} h/sem del vínculo del docente.'
                    )
                })

    def create(self, validated_data):
        # Asignar el usuario que crea el registro
        validated_data['creado_por'] = self.context['request'].user
        return super().create(validated_data)


# ============================================================
# EVIDENCIA DE CARGA HORARIA SERIALIZER
# ============================================================
class ProgramaAnaliticoSerializer(serializers.ModelSerializer):
    """Sube o reemplaza el programa analítico (PDF) de una materia en un calendario del fondo."""

    class Meta:
        model = ProgramaAnalitico
        fields = ['id', 'fondo', 'materia', 'calendario', 'archivo', 'fecha_subida']
        read_only_fields = ['fecha_subida']
        validators = []

    def validate_archivo(self, archivo):
        if not es_pdf(archivo):
            raise serializers.ValidationError('El programa analítico debe ser un archivo PDF válido.')
        if archivo.size > ProgramaAnalitico.TAMANO_MAXIMO_MB * 1024 * 1024:
            raise serializers.ValidationError(
                f'El archivo supera el tamaño máximo de {ProgramaAnalitico.TAMANO_MAXIMO_MB} MB.'
            )
        return archivo

    def validate(self, data):
        fondo, materia, calendario = data['fondo'], data['materia'], data['calendario']
        if not fondo.cargas.filter(tipo_actividad='clases_aula', materia=materia, calendario=calendario).exists():
            raise serializers.ValidationError({
                'materia': 'La materia no tiene clases en aula en ese calendario dentro del Fondo de Tiempo.'
            })
        return data


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
    # En Docente son propiedades de DatosLaborales; sin declararlas, DRF las haría
    # de solo lectura y descartaría la fecha escrita en el formulario.
    fecha_ingreso = serializers.DateField(required=False)
    dias_vacacion = serializers.SerializerMethodField()
    # El C.I. vive en DatosLaborales: se guarda y solo se edita sin historial.
    ci = serializers.CharField(required=False, allow_blank=True, max_length=20)
    tiene_historial = serializers.SerializerMethodField()
    tiene_registros = serializers.SerializerMethodField()
    categoria = serializers.ChoiceField(choices=Docente.CATEGORIA_CHOICES, write_only=True, required=False)
    dedicacion = serializers.ChoiceField(choices=Docente.DEDICACION_CHOICES, write_only=True, required=False)
    condicion = serializers.ChoiceField(choices=DocenteCarrera.CONDICION_CHOICES, write_only=True, required=False)
    user = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), write_only=True, required=False, allow_null=True)
    user_data = serializers.JSONField(write_only=True, required=False, allow_null=True)
    carrera_id = serializers.SerializerMethodField()
    carrera_nombre = serializers.SerializerMethodField()
    # Al Director: solo el vínculo de su carrera.
    vinculos = serializers.SerializerMethodField()

    class Meta:
        model = Docente
        fields = [
            'id', 'user', 'user_id', 'user_data',
            'nombres', 'apellido_paterno', 'apellido_materno',
            'ci', 'email', 'telefono',
            'fecha_ingreso', 'dias_vacacion',
            'nombre_completo', 'usuario_nombre', 'usuario_email', 'usuario_id',
            'usuario_rol', 'usuario_rol_display', 'asignaciones',
            'horas_declaradas', 'fondos_validados', 'tiene_historial', 'tiene_registros',
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
        vinculo = vinculos_visibles(obj, self.context).filter(activo=True).first()
        return vinculo.carrera_id if vinculo else None

    def get_carrera_nombre(self, obj):
        vinculo = vinculos_visibles(obj, self.context).filter(activo=True).first()
        return vinculo.carrera.nombre if vinculo and vinculo.carrera else None

    def get_vinculos(self, obj):
        return DocenteCarreraSerializer(vinculos_visibles(obj, self.context), many=True).data

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
        propias = carreras_del_director(self.context)
        if propias is not None:
            asignaciones = asignaciones.filter(carrera_id__in=propias)
        resultado = []
        for asignacion in asignaciones:
            resultado.append({
                'id': asignacion.id,
                'rol': asignacion.rol,
                'rol_display': asignacion.get_rol_display(),
                'carrera': asignacion.carrera_id,
                'carrera_nombre': asignacion.carrera.nombre if asignacion.carrera else None,
                'carrera_codigo': asignacion.carrera.codigo if asignacion.carrera else None,
                'carrera_activa': asignacion.carrera.activo if asignacion.carrera else None,
                'docente': asignacion.docente_id,
                'activo': asignacion.activo,
            })
        return resultado

    def get_horas_declaradas(self, obj):
        cargas = obj.cargas_horarias.all()
        propias = carreras_del_director(self.context)
        if propias is not None:
            # Las del fondo de su carrera y las materias de sus calendarios.
            cargas = cargas.filter(Q(fondo__carrera_id__in=propias) | Q(calendario__carrera_id__in=propias))
        total_horas = cargas.aggregate(total=Sum('horas')).get('total') or 0
        return int(total_horas)

    def get_fondos_validados(self, obj):
        estados_con_historial = ['aprobado_director', 'en_ejecucion', 'informe_presentado', 'finalizado', 'archivado']
        fondos = obj.fondos_tiempo.filter(estado__in=estados_con_historial)
        propias = carreras_del_director(self.context)
        if propias is not None:
            fondos = fondos.filter(carrera_id__in=propias)
        return fondos.count()

    def get_dias_vacacion(self, obj):
        return obj.dias_vacacion

    def get_tiene_historial(self, obj):
        return docente_tiene_historial_operativo(obj)

    def get_tiene_registros(self, obj):
        return docente_tiene_registros(obj)

    def validate_ci(self, value):
        ci_normalizado = (value or '').strip()
        return ci_normalizado

    def _validar_vinculo_nueva_ficha(self, data, user):
        """El único vínculo de una ficha nueva (un docente tiene una sola dedicación).

        Que su carrera sea la del usuario y que traiga dedicación y condición lo exige
        POST /api/docentes/, después de sus permisos.
        """
        vinculo = {
            'carrera': data.get('carrera'),
            'categoria': data.get('categoria') or 'asistente',
            'dedicacion': data.get('dedicacion') or None,
            'condicion': data.get('condicion') or None,
        }
        self._validar_reglas_ficha(data, vinculo['dedicacion'], user)
        _validar_dedicacion_compatible_con_roles_gestion(vinculo['dedicacion'], user=user)
        return vinculo

    def _validar_cambio_carrera(self, carrera, user):
        """Un solo vínculo: cambiar de carrera lo mueve a la carrera del usuario, y solo sin
        registros (un fondo o una carga en la carrera anterior quedaría sin horas)."""
        actual = self.instance.vinculos_carrera.filter(activo=True).select_related('carrera').first()
        if not carrera or (actual and actual.carrera_id == carrera.pk):
            return
        carreras_usuario = carreras_docencia_usuario(user)
        if carreras_usuario and carrera.pk not in carreras_usuario:
            raise serializers.ValidationError({'carrera': MENSAJE_FICHA_EN_CARRERA_DEL_USUARIO})
        if actual and docente_tiene_registros(self.instance):
            raise serializers.ValidationError({
                'carrera': f'No se puede cambiar la carrera: el docente tiene fondos, cargas o saldos en {actual.carrera.nombre}.',
            })

    def _validar_reglas_ficha(self, data, dedicacion, user):
        """Reglas de la ficha de docente:

        - Solo tienen ficha los usuarios con rol docente.
        - Dedicación exclusiva: no se registra aquí (es del Director sin
          docencia, que no tiene ficha). Se respeta la que ya tenga un registro.
        - Solo docente: Tiempo Completo, Medio Tiempo u Horario. Con cargo:
          solo Horario (lo valida _validar_dedicacion_compatible_con_roles_gestion).
        """
        dedicacion_actual = None
        if self.instance:
            vinculo = self.instance.vinculos_carrera.first()
            dedicacion_actual = vinculo.dedicacion if vinculo else None
        if dedicacion == 'dedicacion_exclusiva' and dedicacion != dedicacion_actual:
            raise serializers.ValidationError({'dedicacion': MENSAJE_EXCLUSIVA_FUERA_DE_FICHA})

        if not self.instance and user is not None:
            perfil = PerfilUsuario.objects.filter(user=user).first()
            pendiente = bool(perfil and perfil.inactivo_por_ficha_pendiente)
            if 'docente' not in roles_actuales_usuario(user) and not pendiente:
                raise serializers.ValidationError({'user': MENSAJE_FICHA_SOLO_DOCENTES})

    def _validar_ci(self, data):
        """C.I. único y, en un docente existente, editable solo sin historial."""
        if 'ci' not in data:
            return
        ci = data['ci']
        if not ci:
            data.pop('ci')  # vacío: se conserva el que tiene
            return

        docente = self.instance
        if docente and ci == (docente.ci or ''):
            return
        if docente and docente_tiene_historial_operativo(docente):
            raise serializers.ValidationError({'ci': MENSAJE_FICHA_CON_HISTORIAL})

        usuario = data.get('user') or (docente.user if docente else None)
        datos_propios = docente.datos_laborales_id if docente else None
        conflicto_laboral = DatosLaborales.objects.filter(ci=ci).exclude(pk=datos_propios)
        if not docente and usuario:
            # Al crear, los datos laborales del propio usuario se reutilizan.
            conflicto_laboral = conflicto_laboral.exclude(perfiles__user=usuario)
        conflicto_laboral = conflicto_laboral.filter(docente__isnull=False) if not docente else conflicto_laboral
        conflicto_perfil = PerfilUsuario.objects.filter(ci=ci).exclude(user__isnull=True)
        if usuario:
            conflicto_perfil = conflicto_perfil.exclude(user=usuario)
        if docente:
            conflicto_perfil = conflicto_perfil.exclude(docente=docente)
        if conflicto_laboral.exists() or conflicto_perfil.exists():
            raise serializers.ValidationError({'ci': 'Este C.I. ya está registrado.'})

    def _validar_vinculo_con_historial(self, data):
        """Con historial, categoría, dedicación y condición del vínculo quedan fijas."""
        if not self.instance or not docente_tiene_historial_operativo(self.instance):
            return
        vinculo = self.instance.vinculos_carrera.filter(activo=True).first()
        for campo in ('categoria', 'dedicacion', 'condicion'):
            if campo in data and vinculo and data[campo] != getattr(vinculo, campo):
                raise serializers.ValidationError({campo: MENSAJE_FICHA_CON_HISTORIAL})

    def validate(self, data):
        self._validar_ci(data)
        self._validar_vinculo_con_historial(data)

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
        if self.instance:
            self._validar_reglas_ficha(data, dedicacion, user_obj)
            _validar_dedicacion_compatible_con_roles_gestion(dedicacion, docente=docente_obj, user=user_obj)
            if 'carrera' in data:
                self._validar_cambio_carrera(data['carrera'], user_obj)
        else:
            data['_vinculo'] = self._validar_vinculo_nueva_ficha(data, user_obj)

        if fecha_ingreso:
            validar_fecha_ingreso(fecha_ingreso)
        if self.instance and 'fecha_ingreso' in data:
            validar_cambio_fecha_ingreso(self.instance.datos_laborales, data['fecha_ingreso'])

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
        condicion = validated_data.pop('condicion', None)
        vinculo = validated_data.pop('_vinculo', None) or {
            'carrera': carrera, 'categoria': categoria, 'dedicacion': dedicacion, 'condicion': condicion,
        }
        fecha_ingreso = validated_data.pop('fecha_ingreso', None)
        dias_vacacion = validated_data.pop('dias_vacacion', 15)

        if user is None and user_data:
            user = User.objects.create_user(
                username=str(user_data.get('username') or '').strip(),
                email=str(user_data.get('email') or '').strip(),
                password=user_data.get('password'),
                first_name=str(user_data.get('first_name') or '').strip(),
                last_name=str(user_data.get('last_name') or '').strip(),
            )

        vinculo['dedicacion'] = _dedicacion_para_usuario(vinculo['dedicacion'], user)
        _validar_dedicacion_compatible_con_roles_gestion(vinculo['dedicacion'], user=user)

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

                if cambios_datos_laborales:
                    datos_laborales.full_clean()
                    datos_laborales.save(update_fields=cambios_datos_laborales)
            else:
                datos_laborales = DatosLaborales.objects.create(
                    # DatosLaborales.ci admite 20 caracteres: TEMP_ + 15 hex.
                    ci=effective_ci or f"TEMP_{uuid.uuid4().hex[:15]}",
                    fecha_ingreso=fecha_ingreso or timezone.localdate(),
                    dias_vacacion=dias_vacacion,
                )

        # La fecha escrita en el formulario manda también cuando se reutilizan
        # los DatosLaborales que ya tenía el usuario.
        if fecha_ingreso and datos_laborales.fecha_ingreso != fecha_ingreso:
            datos_laborales.fecha_ingreso = fecha_ingreso
            datos_laborales.full_clean()
            datos_laborales.save(update_fields=['fecha_ingreso'])

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
            # Con la ficha, el usuario desactivado por no tenerla vuelve a estar
            # activo (con su asignación docente). Uno desactivado a mano, no.
            activar_por_ficha_creada(user)

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

            # El perfil sigue el estado del usuario.
            if perfil and perfil.activo != user.is_active:
                perfil.activo = user.is_active
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
            )

        DocenteCarrera.objects.update_or_create(
            docente=docente,
            carrera=carrera,
            defaults={
                'categoria': vinculo['categoria'],
                'dedicacion': vinculo['dedicacion'],
                'condicion': vinculo['condicion'] or 'titular',
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

        dl_fields = ['ci', 'fecha_ingreso', 'dias_vacacion']
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
            if 'ci' in dl_data:
                # El usuario vinculado guarda el mismo C.I. en su perfil.
                actualizar_con_historial(PerfilUsuario.objects.filter(docente=instance), ci=dl_data['ci'])

        if user is not serializers.empty:
            instance.user = user

        docente = super().update(instance, validated_data)

        if carrera is not serializers.empty:
            if not carrera:
                raise serializers.ValidationError({'carrera': 'Debe seleccionar una carrera valida para el docente.'})
            # Un solo vínculo: el de esta carrera o, si cambió de carrera, el que ya tenía.
            vinculo_existente = (
                docente.vinculos_carrera.filter(carrera=carrera).first()
                or docente.vinculos_carrera.filter(activo=True).first()
            )
            dedicacion_final = dedicacion if dedicacion is not serializers.empty else (vinculo_existente.dedicacion if vinculo_existente else 'horario_40')
            dedicacion_final = _dedicacion_para_usuario(dedicacion_final, docente.user)
            _validar_dedicacion_compatible_con_roles_gestion(dedicacion_final, docente=docente, user=docente.user)
            valores = {
                'categoria': categoria if categoria is not serializers.empty else (vinculo_existente.categoria if vinculo_existente else 'asistente'),
                'dedicacion': dedicacion_final,
                'condicion': condicion if condicion is not serializers.empty else (vinculo_existente.condicion if vinculo_existente else 'titular'),
                'activo': True,
            }
            if vinculo_existente:
                vinculo_existente.carrera = carrera
                for campo, valor in valores.items():
                    setattr(vinculo_existente, campo, valor)
                vinculo_existente.save()
            else:
                DocenteCarrera.objects.create(docente=docente, carrera=carrera, **valores)
            if _usuario_tiene_rol_docente_activo(docente.user):
                perfil, _ = PerfilUsuario.objects.get_or_create(
                    docente=docente,
                    defaults={
                        'user': docente.user,
                        'rol': 'docente',
                        'carrera': carrera,
                        'telefono': '',
                        'activo': True,
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
                    actualizar_con_historial(
                        AsignacionCarrera.objects.filter(user=perfil_vinculado.user, rol='docente', activo=True),
                        activo=False,
                    )
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
            'id', 'ci', 'fecha_ingreso', 'dias_vacacion',
            'nombre_completo', 'rol_usuario', 'antiguedad',
            'fecha_creacion', 'fecha_modificacion',
        ]
        # dias_vacacion se calcula desde fecha_ingreso (DatosLaborales.save).
        read_only_fields = ['dias_vacacion', 'fecha_creacion', 'fecha_modificacion']

    def validate_fecha_ingreso(self, value):
        # Mismas reglas que la edición del docente.
        validar_fecha_ingreso(value)
        validar_cambio_fecha_ingreso(self.instance, value)
        return value

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
    # La API usa el nombre de la facultad; en la base es una relación con FacultadCatalogo.
    facultad = serializers.SlugRelatedField(
        slug_field='nombre',
        queryset=FacultadCatalogo.objects.all(),
        error_messages={
            'required': 'La facultad es obligatoria y no puede estar vacía.',
            'null': 'La facultad es obligatoria y no puede estar vacía.',
            'does_not_exist': 'La facultad seleccionada no es valida.',
            'invalid': 'La facultad seleccionada no es valida.',
        },
    )
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
        # 'responsable' lo llena la señal al asignar un Director de Carrera.
        read_only_fields = ['responsable']

    def get_logo_carrera(self, obj):
        return obj.get_logo_carrera_data_uri()

    def validate(self, attrs):
        instance = getattr(self, 'instance', None)

        # El logo es obligatorio al crear; al editar se puede dejar el que ya tiene.
        if instance is None and not attrs.get('logo_carrera_file'):
            raise serializers.ValidationError({
                'logo_carrera_file': 'El logo de carrera es obligatorio para crear una nueva carrera.'
            })

        codigo = attrs.get('codigo', getattr(instance, 'codigo', ''))
        codigo_normalizado = (codigo or '').strip().upper()
        if not codigo_normalizado:
            raise serializers.ValidationError({'codigo': 'El codigo de carrera es obligatorio.'})
        if len(codigo_normalizado) < 2:
            raise serializers.ValidationError({'codigo': 'El codigo de carrera debe tener al menos 2 caracteres.'})
        attrs['codigo'] = codigo_normalizado

        resolucion = attrs.get('resolucion_ministerial', getattr(instance, 'resolucion_ministerial', ''))
        if not (resolucion or '').strip():
            raise serializers.ValidationError({
                'resolucion_ministerial': 'Debe registrar la resolución de creación (HCU) de la carrera.'
            })

        fecha_resolucion = attrs.get('fecha_resolucion', getattr(instance, 'fecha_resolucion', None))
        if not fecha_resolucion:
            raise serializers.ValidationError({
                'fecha_resolucion': 'Debe registrar la fecha de resolución de creación (HCU) de la carrera.'
            })
        if fecha_resolucion and fecha_resolucion > timezone.localdate():
            raise serializers.ValidationError({
                'fecha_resolucion': 'La fecha de resolución de creación (HCU) no puede ser futura.'
            })

        return attrs

    def create(self, validated_data):
        logo_file = validated_data.pop('logo_carrera_file', None)
        validated_data.pop('remove_logo_carrera', None)

        instance = super().create(validated_data)
        if logo_file:
            instance.set_logo_carrera(logo_file)
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
            instance.set_logo_carrera(logo_file)
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
        # Formato CARRERA-XXX-[O|E][-]NNNNN (ej. CIS-ALG-O11101, CP-CBA-O-11101): el
        # prefijo es el código de la carrera de la materia.
        formato = re.fullmatch(r'([A-Z0-9]{2,10})-[A-Z]{2,6}-[OE]-?\d{5}', sigla_normalizada or '')
        if sigla_normalizada and not formato:
            errors = {'sigla': 'La sigla debe seguir el formato CARRERA-XXX-O-NNNNN. Ej: CIS-ALG-O11101 o CP-CBA-O-11101.'}
            raise serializers.ValidationError(errors)
        carrera_materia = attrs.get('carrera', getattr(instance, 'carrera', None))
        codigo_carrera = str(getattr(carrera_materia, 'codigo', '') or '').strip().upper()
        if formato and codigo_carrera and formato.group(1) != codigo_carrera:
            raise serializers.ValidationError({
                'sigla': f'La sigla debe empezar con el código de la carrera ({codigo_carrera}-...).',
            })
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


def _detalle_de_carga(carga, fondo, programas):
    return {
        "id": carga.id,
        "materia_id": carga.materia_id,
        "categoria": carga.categoria,
        "tipo_actividad": carga.tipo_actividad,
        "tipo_actividad_display": CARGA_HORARIA_TIPOS_LABELS.get(carga.tipo_actividad, carga.tipo_actividad.replace('_', ' ').title() if carga.tipo_actividad else ''),
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
        "respaldo": carga.documento_respaldo,
        "carrera_calendario": carga.calendario.carrera.nombre if carga.calendario_id else None,
        # Clases en aula: la misma materia puede darse en dos calendarios (igual que en el PDF).
        "calendario_nombre": nombre_calendario_en_fondo(carga.calendario, fondo) if carga.calendario_id else None,
        "es_de_otra_carrera": bool(carga.calendario_id) and carga.calendario.carrera_id != fondo.carrera_id,
        "calendario_id": carga.calendario_id,
        # Programa analítico (PDF) de la materia en ese calendario, solo en clases en aula.
        "programa_analitico_url": (
            programas.get((carga.materia_id, carga.calendario_id))
            if carga.tipo_actividad == 'clases_aula' else None
        ),
    }


def unidades_del_fondo(fondo):
    """Las 7 unidades del fondo: su total es la suma de sus ítems (horas por año), su
    porcentaje es ese total sobre las horas efectivas, y detalles_carga son sus ítems."""
    detalles = {tipo: [] for tipo, _nombre in UNIDADES_FONDO}
    programas = {
        (programa.materia_id, programa.calendario_id): programa.archivo.url
        for programa in fondo.programas_analiticos.all()
    }
    totales = dict.fromkeys(detalles, 0)
    # Orden fijo: por inicio del calendario (los ítems sin calendario al final) y por alta.
    cargas = fondo.cargas.select_related('materia', 'calendario__carrera').order_by(
        F('calendario__fecha_inicio').asc(nulls_last=True), 'id',
    )
    for carga in cargas:
        detalles[carga.categoria].append(_detalle_de_carga(carga, fondo, programas))
        totales[carga.categoria] += carga.horas
    horas_efectivas = Decimal(str(fondo.horas_efectivas or 0))
    return [
        {
            'tipo': tipo,
            'tipo_display': nombre,
            'total_horas': totales[tipo],
            'porcentaje': round(Decimal(totales[tipo]) / horas_efectivas * 100, 2) if horas_efectivas else 0,
            'detalles_carga': detalles[tipo],
        }
        for tipo, nombre in UNIDADES_FONDO
    ]


class FondoTiempoSerializer(serializers.ModelSerializer):
    docente_nombre = serializers.CharField(source='docente.nombre_completo', read_only=True)
    carrera_nombre = serializers.CharField(source='carrera.nombre', read_only=True)
    categorias = serializers.SerializerMethodField()
    porcentaje_completado = serializers.SerializerMethodField()
    horas_disponibles = serializers.SerializerMethodField()
    total_asignado = serializers.SerializerMethodField()
    informe_actual = serializers.SerializerMethodField()
    
    descripcion = serializers.CharField(read_only=True)

    class Meta:
        model = FondoTiempo
        fields = '__all__'
        # La unicidad (docente, gestión) se valida en validate() con un mensaje claro.
        validators = []
        # El estado y todo lo del flujo cambian solo por sus acciones (presentar,
        # aprobar, archivar, iniciar, finalizar...), nunca editando el fondo.
        read_only_fields = [
            'estado', 'horas_efectivas', 'archivado',
            'aprobado_por', 'validado_por', 'documento_decanatura', 'documento_decanatura_informe',
            'fecha_presentacion', 'fecha_aprobacion', 'fecha_validacion',
            'fecha_inicio_ejecucion', 'fecha_informe', 'fecha_finalizacion',
        ]

    # Docente, carrera y gestión se eligen al crear el fondo; después no cambian.
    CAMPOS_FIJOS_AL_EDITAR = ('docente', 'carrera', 'gestion')

    def get_fields(self):
        fields = super().get_fields()
        if self.instance is not None:
            for nombre in self.CAMPOS_FIJOS_AL_EDITAR:
                fields[nombre].read_only = True
        return fields

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return _filtrar_categorias_investigacion_para_iisyp(data, self.context)
    
    def get_total_asignado(self, obj):
        if not hasattr(obj, '_total_asignado_calculado'):
            obj._total_asignado_calculado = obj.total_asignado
        return obj._total_asignado_calculado

    def get_porcentaje_completado(self, obj):
        total_asignado = self.get_total_asignado(obj)
        if not obj.horas_efectivas or obj.horas_efectivas == 0:
            return 0
        return (total_asignado / obj.horas_efectivas) * 100


    def validate(self, data):
        """Un fondo por docente y gestión, en la carrera de su vínculo."""
        # Obtener el docente (puede venir en data o ya existir en la instancia)
        docente = data.get('docente')
        if not docente and hasattr(self, 'instance') and self.instance:
            docente = self.instance.docente
        
        if not docente:
            return data
        
        # El fondo va en la carrera del vínculo del docente: el límite sale de ese vínculo.
        carrera = data.get('carrera') or (self.instance.carrera if self.instance else None)
        vinculo_carrera = DocenteCarrera.objects.filter(
            docente=docente, carrera=carrera, activo=True
        ).first() if carrera else None
        if not self.instance and carrera and not vinculo_carrera:
            raise serializers.ValidationError({
                'carrera': 'El Fondo de Tiempo se crea en la carrera del vínculo activo del docente.'
            })

        gestion = data.get('gestion') or (self.instance.gestion if self.instance else None)
        if gestion:
            duplicado_qs = FondoTiempo.objects.filter(docente=docente, gestion=gestion, archivado=False)
            if self.instance:
                duplicado_qs = duplicado_qs.exclude(pk=self.instance.pk)
            if duplicado_qs.exists():
                raise serializers.ValidationError({
                    'docente': f'Este docente ya tiene un Fondo de Tiempo de la gestión {gestion}.'
                })

        return data

    def get_categorias(self, obj):
        return unidades_del_fondo(obj)

    def get_horas_disponibles(self, obj):
        total_asignado = self.get_total_asignado(obj)
        return obj.horas_efectivas - total_asignado

    def get_informe_actual(self, obj):
        """Documento del informe (guardado o precargado con defaults, ver
        _informe_actual_o_borrador)."""
        return _informe_actual_o_borrador(obj, self.context)


class FondoTiempoListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listados"""
    descripcion = serializers.CharField(read_only=True)
    docente_nombre = serializers.CharField(source='docente.nombre_completo', read_only=True)
    carrera_nombre = serializers.CharField(source='carrera.nombre', read_only=True)
    porcentaje_completado = serializers.SerializerMethodField()
    total_asignado = serializers.SerializerMethodField()
    # Aseguramos que se devuelva la URL como string explícito
    
    class Meta:
        model = FondoTiempo
        fields = ['id', 'docente', 'docente_nombre', 'carrera', 'carrera_nombre', 
                  'gestion', 'descripcion', 'total_asignado', 'horas_efectivas',
                  'porcentaje_completado', 'estado']

    def get_total_asignado(self, obj):
        if not hasattr(obj, '_total_asignado_calculado'):
            obj._total_asignado_calculado = obj.total_asignado
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
    antiguedad = serializers.SerializerMethodField()

    class Meta:
        model = PerfilUsuario
        fields = [
            'id', 'rol', 'carrera', 'carrera_nombre', 'docente', 'docente_id', 'docente_nombre',
            'telefono', 'activo', 'foto_perfil', 'foto_perfil_es_propia', 'debe_cambiar_password',
            'fecha_ingreso', 'dias_vacacion', 'antiguedad',
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
        return obj.tiene_foto_propia

    def get_fecha_ingreso(self, obj):
        datos = obj.obtener_datos_laborales()
        return datos.fecha_ingreso if datos else None

    def get_dias_vacacion(self, obj):
        return obj.dias_vacacion

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
            instance.set_foto_perfil(incoming)

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
    # Aviso "Falta crear la ficha de docente" (no bloquea al usuario).
    ficha_docente_pendiente = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'nombre_completo',
              'is_staff', 'is_superuser', 'is_active', 'date_joined', 'perfil',
              'ci', 'carrera_codigo', 'telefono', 'asignaciones',
              'asignaciones_activas', 'asignacion_activa', 'ficha_docente_pendiente']
        read_only_fields = ['id', 'date_joined']

    def get_ficha_docente_pendiente(self, obj):
        return ficha_docente_pendiente(obj)


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

            # El superusuario no tiene rol de carrera: el frontend decide con is_superuser.
            if obj.is_superuser:
                data['rol'] = None
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
                'rol': None,
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
                'carrera_activa': asignacion.carrera.activo if asignacion.carrera else None,
                'docente': asignacion.docente_id,
                'docente_nombre': asignacion.docente.nombre_completo if asignacion.docente else None,
                'activo': asignacion.activo,
                'resolucion_consejo': asignacion.resolucion_consejo.url if asignacion.resolucion_consejo else None,
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
    # Resolución del Consejo de Carrera (PDF): obligatoria al designar un Jefe de Estudios.
    resolucion_jefe = serializers.FileField(write_only=True, required=False, allow_null=True)
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
                  'last_name', 'rol', 'carrera', 'docente', 'docente_data', 'asignaciones', 'ci', 'resolucion_jefe']
        extra_kwargs = {
            'first_name': {'required': False, 'allow_blank': True},
            'last_name': {'required': False, 'allow_blank': True},
            'email': {'required': False, 'allow_blank': True},
        }

    def validate(self, data):
        # Obtener usuario actual del contexto (quien está creando)
        request = self.context.get('request')
        current_user = request.user if request else None
        if 'asignaciones' in data:
            data['asignaciones'] = _parsear_asignaciones(data['asignaciones'])
        asignaciones = data.get('asignaciones') or []

        if asignaciones and not isinstance(asignaciones, list):
            raise serializers.ValidationError({'asignaciones': 'Debe enviar una lista de asignaciones.'})

        if asignaciones and not all(isinstance(item, dict) for item in asignaciones):
            raise serializers.ValidationError({'asignaciones': 'Cada asignación debe ser un objeto con rol y carrera.'})

        _aplicar_carrera_del_editor(data, asignaciones, current_user, request=request)

        bloques = [{
            'rol': data.get('rol'),
            'carrera': data.get('carrera'),
            'docente': data.get('docente'),
            'docente_data': data.get('docente_data'),
        }] + asignaciones
        _rechazar_ficha_desde_usuarios(bloques)

        carreras_gestionables = _carreras_gestionables_director(current_user, request)
        if current_user and not current_user.is_superuser:
            if _rol_usuario_solicitante(current_user, request) != 'director':
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
        
        # Validar que las contraseñas coincidan
        if data['password'] != data['password_confirm']:
            raise serializers.ValidationError({
                'password_confirm': 'Las contraseñas no coinciden'
            })

        _validar_carrera_en_bloques(bloques)
        # Después de las reglas de estructura (carrera, cargos): el PDF es lo último que falta.
        _validar_resolucion_jefe(data, bloques)

        ci_normalizado = (data.get('ci') or '').strip()

        if ci_normalizado:
            perfil_ci = obtener_perfil_por_ci(ci_normalizado)
            if perfil_ci and perfil_ci.user and perfil_ci.user_id:
                # Crear nunca modifica a otro usuario: agregarle asignaciones es
                # una edición que solo hace el superusuario.
                raise serializers.ValidationError({
                    'ci': 'Este C.I. ya está registrado.'
                })
            if perfil_ci and not perfil_ci.user_id and not perfil_ci_es_reutilizable(perfil_ci, data['rol']):
                raise serializers.ValidationError({
                    'ci': 'Ese C.I. sigue reservado por un perfil huérfano con historial del sistema. No se puede reutilizar automáticamente.'
                })

        data['ci'] = ci_normalizado or None

        # Validar unicidad de cargos por carrera (director, jefe_estudios, iiisyp)
        for bloque in bloques:
            bloque_rol = bloque.get('rol')
            if bloque_rol in ROLES_UNICOS_POR_CARRERA:
                validar_unicidad_cargo_por_carrera(_resolver_carrera_asignacion(bloque.get('carrera')) or data.get('carrera'), bloque_rol)

        if data.get('docente') and not data['docente'].activo:
            raise serializers.ValidationError({
                'docente': 'No se puede vincular un docente inactivo a un usuario.'
            })

        return data

    def create(self, validated_data):
        with transaction.atomic():
            # Extraer datos del perfil
            validated_data.pop('password_confirm')
            rol = validated_data.pop('rol')
            carrera = validated_data.pop('carrera', None)
            docente = validated_data.pop('docente', None)
            validated_data.pop('docente_data', None)
            resolucion_jefe = validated_data.pop('resolucion_jefe', None)
            asignaciones_extra = validated_data.pop('asignaciones', []) or []
            ci = validated_data.pop('ci', None)

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

            # Resolver el Docente EXISTENTE si 'docente' está presente en CUALQUIER
            # asignación (principal o secundaria en asignaciones_extra). La ficha
            # nueva no se crea aquí: solo en Docentes > Nuevo docente.
            docente_ref_resolucion = docente
            if not docente_ref_resolucion:
                for asignacion in asignaciones_extra:
                    if str(asignacion.get('rol') or '').strip() != 'docente':
                        continue
                    docente_ref_extra = asignacion.get('docente')
                    if docente_ref_extra:
                        docente_ref_resolucion = docente_ref_extra
                        break

            if tiene_rol_docente and docente_ref_resolucion:
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
                perfil.debe_cambiar_password = True
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
                perfil.debe_cambiar_password = True
                perfil.save()
            elif not perfil_actual_usuario:
                # Crear DatosLaborales si es administrativo puro y no hay perfil previo
                dl_obj = None
                if not tiene_rol_docente and ci:
                    from .models import DatosLaborales
                    dl_obj, _ = DatosLaborales.objects.get_or_create(
                        ci=ci,
                        defaults={
                            'fecha_ingreso': timezone.localdate(),
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
                    debe_cambiar_password=True
                )
            else:
                # Perfil existe, actualizarlo y asegurar DatosLaborales para admin puro
                if not tiene_rol_docente and ci and not perfil_actual_usuario.datos_laborales:
                    from .models import DatosLaborales
                    dl_obj, _ = DatosLaborales.objects.get_or_create(
                        ci=ci,
                        defaults={
                            'fecha_ingreso': timezone.localdate(),
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
            _guardar_resolucion_jefe(user, resolucion_jefe)

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
    # Resolución del Consejo de Carrera (PDF): obligatoria al designar un Jefe de Estudios.
    resolucion_jefe = serializers.FileField(write_only=True, required=False, allow_null=True)
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
        fields = ['username', 'email', 'first_name', 'last_name', 'is_active',
                  'rol', 'carrera', 'docente', 'docente_data', 'asignaciones', 'ci', 'resolucion_jefe']
        extra_kwargs = {
            'username': {'required': False},
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

    CAMPOS_IDENTIDAD = {
        'username': 'el nombre de usuario',
        'first_name': 'el nombre',
        'last_name': 'el apellido',
        'ci': 'el C.I.',
    }

    def _validar_asignaciones_nuevas(self, data, asignaciones, perfil_actual, current_user):
        """Solo el superusuario agrega asignaciones (rol + carrera) a un usuario existente.

        Excepción: el Director puede cambiar rol y carrera de un usuario sin datos
        registrados; que sea dentro de su carrera y con roles operativos lo valida
        _validar_bloques_en_carreras_gestionables.
        """
        if not current_user or current_user.is_superuser:
            return
        if _rol_usuario_solicitante(current_user, self.context.get('request')) == 'director' and not datos_registrados_usuario(self.instance)['tiene_datos']:
            return
        principal = {
            'rol': data.get('rol', perfil_actual.rol if perfil_actual else None),
            'carrera': data.get('carrera', perfil_actual.carrera if perfil_actual else None),
        }
        pedidas = _normalizar_claves_asignaciones([principal] + list(asignaciones))
        actuales = set(
            AsignacionCarrera.objects.filter(user=self.instance, activo=True, carrera__isnull=False)
            .values_list('rol', 'carrera_id')
        )
        if pedidas - actuales:
            raise serializers.ValidationError({
                'asignaciones': 'Solo el superusuario puede agregar asignaciones a un usuario existente.'
            })

    def _validar_resolucion_jefe_edicion(self, data, perfil_actual):
        """Con el resultado final de la edición: un Jefe de Estudios nuevo trae su resolución."""
        bloques = [{
            'rol': data.get('rol', perfil_actual.rol if perfil_actual else None),
            'carrera': data.get('carrera', perfil_actual.carrera if perfil_actual else None),
        }]
        if 'asignaciones' in data:
            bloques += list(data.get('asignaciones') or [])
        else:
            bloques += [
                {'rol': asignacion.rol, 'carrera': asignacion.carrera}
                for asignacion in AsignacionCarrera.objects.filter(user=self.instance, activo=True)
            ]
        _validar_resolucion_jefe(data, bloques, user=self.instance)

    def _validar_una_sola_carrera(self, data, perfil_actual):
        """Resultado final de la edición en una sola carrera: la principal (nueva o actual)
        y las asignaciones (las enviadas o, si no se envían, las que ya tiene)."""
        self._mover_vinculo_a = None
        if self.instance.is_superuser:
            return
        carreras = set()
        principal = data['carrera'] if 'carrera' in data else (perfil_actual.carrera if perfil_actual else None)
        if principal:
            carreras.add(principal.pk)
        if 'asignaciones' in data:
            for bloque in data.get('asignaciones') or []:
                carrera = _resolver_carrera_asignacion(bloque.get('carrera')) if isinstance(bloque, dict) else None
                if carrera:
                    carreras.add(carrera.pk)
        else:
            carreras |= set(AsignacionCarrera.objects.filter(
                user=self.instance, activo=True,
            ).values_list('carrera_id', flat=True))
        if len(carreras) > 1:
            raise serializers.ValidationError({'asignaciones': MENSAJE_UNA_SOLA_CARRERA})

        # El único vínculo de su ficha va en la carrera del usuario: si cambia de
        # carrera, el vínculo se mueve con él (ver update), salvo con historial.
        docente = docente_del_usuario(self.instance)
        vinculo = docente.vinculos_carrera.filter(activo=True).select_related('carrera').first() if docente else None
        if vinculo and carreras and vinculo.carrera_id not in carreras:
            if docente_tiene_registros(docente):
                raise serializers.ValidationError({
                    'carrera': (
                        f'No se puede cambiar la carrera: el docente tiene fondos, cargas '
                        f'horarias o saldos en {vinculo.carrera.nombre}.'
                    ),
                })
            self._mover_vinculo_a = next(iter(carreras))

    def _validar_ci_compartido(self, data, perfil_actual, current_user):
        """El C.I. de un docente con dos o más carreras solo lo cambia el superusuario."""
        if 'ci' not in data or (current_user and current_user.is_superuser):
            return
        ci_actual = perfil_actual.ci if perfil_actual else ''
        if str(data['ci'] or '').strip() == str(ci_actual or '').strip():
            return
        if usuario_con_varias_carreras_docentes(self.instance):
            raise serializers.ValidationError({
                'ci': 'El C.I. de un docente con varias carreras solo lo cambia el superusuario.',
            })

    def _validar_identidad(self, data, perfil_actual):
        """Con datos registrados, la identidad del usuario no se puede cambiar."""
        actuales = {
            'username': self.instance.username,
            'first_name': self.instance.first_name,
            'last_name': self.instance.last_name,
            'ci': perfil_actual.ci if perfil_actual else '',
        }
        cambiados = [
            campo for campo, actual in actuales.items()
            if campo in data and str(data[campo] or '').strip() != str(actual or '').strip()
        ]
        if not cambiados:
            return
        datos = datos_registrados_usuario(self.instance)
        if not datos['tiene_datos']:
            return
        texto = texto_datos_registrados(datos)
        raise serializers.ValidationError({
            campo: (
                f'No se puede cambiar {self.CAMPOS_IDENTIDAD[campo]} porque el usuario ya tiene '
                f'datos registrados ({texto}).'
            )
            for campo in cambiados
        })

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
        if 'asignaciones' in data:
            data['asignaciones'] = _parsear_asignaciones(data['asignaciones'])
        asignaciones = data.get('asignaciones') or []
        
        # Obtener perfil actual al inicio para evitar UnboundLocalError
        perfil_actual = self._get_perfil_actual()
        self._validar_identidad(data, perfil_actual)
        self._validar_ci_compartido(data, perfil_actual, current_user)
        self._validar_asignaciones_nuevas(data, asignaciones, perfil_actual, current_user)

        if asignaciones and not isinstance(asignaciones, list):
            raise serializers.ValidationError({'asignaciones': 'Debe enviar una lista de asignaciones.'})

        if asignaciones and not all(isinstance(item, dict) for item in asignaciones):
            raise serializers.ValidationError({'asignaciones': 'Cada asignación debe ser un objeto con rol y carrera.'})

        _aplicar_carrera_del_editor(data, asignaciones, current_user, editando=True, request=request)

        bloques = [{
            'rol': data.get('rol'),
            'carrera': data.get('carrera'),
            'docente': data.get('docente'),
            'docente_data': data.get('docente_data'),
        }] + asignaciones
        _rechazar_ficha_desde_usuarios(bloques)

        carreras_gestionables = _carreras_gestionables_director(current_user, request)
        if current_user and not current_user.is_superuser and _rol_usuario_solicitante(current_user, request) == 'director':
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
        self._validar_una_sola_carrera(data, perfil_actual)
        self._validar_resolucion_jefe_edicion(data, perfil_actual)
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
            or (not current_user.is_superuser and _rol_usuario_solicitante(current_user, self.context.get('request')) != 'director')
        ):
            raise serializers.ValidationError({
                'rol': 'Solo el Superusuario tiene la potestad de cambiar el rol de cualquier usuario en el sistema.'
            })
        
        rol_actual = perfil_actual.rol if perfil_actual else ('' if self.instance.is_superuser else 'docente')
        carrera_actual = perfil_actual.carrera if perfil_actual else None
        docente_actual = perfil_actual.docente if perfil_actual else None

        # Determina el rol final (el nuevo si se provee, o el existente si no)
        rol = data.get('rol', rol_actual)
        carrera_final = data.get('carrera', carrera_actual)
        is_active_final = data.get('is_active', self.instance.is_active)
        # Inactivo por falta de ficha: si recibe un cargo, queda activo con él.
        if perfil_actual and perfil_actual.inactivo_por_ficha_pendiente:
            is_active_final = True
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
            if data.get('rol'):
                raise serializers.ValidationError({'rol': 'El Super Admin no tiene rol de carrera.'})
            if asignaciones:
                raise serializers.ValidationError({'asignaciones': 'El Super Admin no maneja asignaciones de carrera.'})

        # Regla 0.5: todo rol necesita carrera (la principal puede ser la que ya tiene).
        if not es_superusuario_objetivo:
            _validar_carrera_en_bloques([{'rol': rol, 'carrera': carrera_final}] + list(asignaciones))
            for bloque in bloques:
                bloque_rol = bloque.get('rol')
                if bloque_rol in ROLES_UNICOS_POR_CARRERA:
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
                'rol': '' if instance.is_superuser else 'docente',
                'activo': instance.is_active,
                'debe_cambiar_password': not instance.is_superuser,
            }
        )
        ci = validated_data.pop('ci', None)
        asignaciones_extra = validated_data.pop('asignaciones', None)
        resolucion_jefe = validated_data.pop('resolucion_jefe', None)

        # 1. Actualizar campos del modelo User
        instance.username = validated_data.get('username', instance.username)
        instance.email = validated_data.get('email', instance.email)
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.is_active = validated_data.get('is_active', instance.is_active)

        # 2. Determinar el rol final
        new_rol = validated_data.get('rol')
        final_rol = new_rol or perfil.rol

        # Lógica de Doble Rol para el guardado
        roles_extra = [a.get('rol') for a in (asignaciones_extra or [])]
        roles_totales = [final_rol] + roles_extra
        tiene_rol_docente = 'docente' in roles_totales
        if asignaciones_extra is not None:
            roles_finales = set(roles_totales)
        else:
            roles_finales = {final_rol} | set(
                AsignacionCarrera.objects.filter(user=instance, activo=True).values_list('rol', flat=True)
            )

        # Actualizar el rol en el perfil
        perfil.rol = final_rol
        perfil.activo = instance.is_active

        # 3. Ajustar 'is_staff' según el rol final (el superusuario lo conserva siempre)
        if final_rol in ['director', 'jefe_estudios'] or instance.is_superuser:
            instance.is_staff = True
        else:
            instance.is_staff = False

        # 4. Gestionar 'carrera'
        if 'carrera' in validated_data:
            carrera = validated_data.get('carrera')
            # El vínculo de la ficha con una carrera (dedicación, categoría y
            # condición) no se inventa aquí: se registra en Docentes.
            perfil.carrera = carrera

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
            if 'docente' in validated_data:
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
                defaults={'fecha_ingreso': timezone.localdate()}
            )
        
        # 5.2 Solo docente y sin ficha: inactivo hasta crearle la ficha. Con un
        # cargo (o ya con ficha) vuelve a estar activo si el sistema lo había desactivado.
        solo_docente_sin_ficha = roles_finales == {'docente'} and perfil.docente is None
        reactivar_por_ficha = False
        if perfil.inactivo_por_ficha_pendiente:
            if solo_docente_sin_ficha:
                instance.is_active = False
            else:
                perfil.inactivo_por_ficha_pendiente = False
                instance.is_active = True
                reactivar_por_ficha = True
        elif instance.is_active and solo_docente_sin_ficha and not instance.is_superuser:
            perfil.inactivo_por_ficha_pendiente = True
            instance.is_active = False
        perfil.activo = instance.is_active

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
        _guardar_resolucion_jefe(instance, resolucion_jefe)
        carrera_vinculo = getattr(self, '_mover_vinculo_a', None)
        if carrera_vinculo and perfil.docente_id:
            for vinculo in DocenteCarrera.objects.filter(docente_id=perfil.docente_id, activo=True).exclude(carrera_id=carrera_vinculo):
                vinculo.carrera_id = carrera_vinculo
                vinculo.save()
        if reactivar_por_ficha:
            actualizar_con_historial(instance.asignaciones_carrera.filter(rol='docente', activo=False), activo=True)

        # Regla de independencia: si el usuario queda inactivo, también se inactiva su docente vinculado.
        if instance.is_active is False and perfil.docente and perfil.docente.activo:
            perfil.docente.activo = False
            perfil.docente.save(update_fields=['activo'])
        
        return instance
    
# ============================================
# SERIALIZERS PARA MODELOS NUEVOS (Reglamento UAB)
# ============================================

from .models import CalendarioAcademico


# =====================================================
# CALENDARIO ACADEMICO SERIALIZER
# =====================================================

class CalendarioAcademicoSerializer(serializers.ModelSerializer):
    semanas_de_clase = serializers.IntegerField(read_only=True)
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
            'dias_feriados_gestion', 'semanas_de_clase', 'activo'
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

        # Los feriados son de la gestión: todos sus calendarios en la carrera tienen el mismo
        # valor. Al editar uno sin cambiar de gestión, el valor se copia a los demás (vista).
        dias_feriados = attrs.get('dias_feriados_gestion', getattr(instance, 'dias_feriados_gestion', None))
        misma_gestion = bool(instance) and instance.carrera_id == carrera.pk and instance.gestion == gestion
        if gestion and dias_feriados is not None and not misma_gestion:
            otro = CalendarioAcademico.objects.filter(carrera=carrera, gestion=gestion).exclude(
                pk=getattr(instance, 'pk', None),
            ).first()
            if otro and otro.dias_feriados_gestion != dias_feriados:
                raise serializers.ValidationError({
                    'dias_feriados_gestion': (
                        f'Los calendarios de la gestión {gestion} deben tener los mismos días de feriado: '
                        f'{otro.dias_feriados_gestion}.'
                    )
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
# INFORME FONDO SERIALIZER
# =====================================================

class InformeFondoSerializer(serializers.ModelSerializer):
    tipo_display = serializers.CharField(source='get_tipo_display', read_only=True)
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    cumplimiento_display = serializers.CharField(source='get_cumplimiento_display', read_only=True)
    elaborado_por_nombre = serializers.CharField(source='elaborado_por.get_full_name', read_only=True)
    evaluado_por_nombre = serializers.SerializerMethodField()
    fondo_descripcion = serializers.CharField(source='fondo_tiempo.descripcion', read_only=True)

    class Meta:
        model = InformeFondo
        fields = [
            'id', 'fondo_tiempo', 'fondo_descripcion',
            'tipo', 'tipo_display', 'estado', 'estado_display', 'fecha_elaboracion',
            'elaborado_por', 'elaborado_por_nombre',
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
            'fecha_modificacion'
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
        # El HTML se entrega limpio también al leer (cubre informes guardados
        # antes de que se limpiara al guardar). Las imágenes del editor se
        # guardan en media con su ruta canónica: se entregan como URL firmada
        # para que el navegador las pueda cargar.
        request = self.context.get('request')
        for campo in CAMPOS_HTML_RICO_INFORME:
            if data.get(campo):
                data[campo] = firmar_imagenes_html(sanitizar_html_informe(data[campo]), request)
        return data


def _informe_actual_o_borrador(fondo, context=None):
    """Informe 'parcial' mas reciente del fondo, ya serializado (con los 12
    campos del documento precargados por InformeFondoSerializer). Si el
    docente todavia no guardo ningun borrador, arma un dict sintetico
    (id=None, estado='borrador') con el documento completo precargado desde
    Docente/Carrera/Director, para que el editor tipo Word siempre tenga
    algo que mostrar aunque no exista fila en InformeFondo todavia."""
    informe = fondo.informes.filter(tipo='parcial').order_by('-fecha_elaboracion').first()
    if informe:
        return InformeFondoSerializer(informe, context=context or {}).data
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
    fondo_descripcion = serializers.CharField(source='fondo_tiempo.descripcion', read_only=True)
    
    class Meta:
        model = InformeFondo
        fields = [
            'id', 'fondo_tiempo', 'fondo_descripcion', 'tipo', 'tipo_display',
            'cumplimiento', 'cumplimiento_display', 'fecha_elaboracion',
        ]


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


class HiloObservacionSerializer(serializers.ModelSerializer):
    """Datos del hilo de observación sin sus mensajes (consulta incremental del chat)."""
    resuelta_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = ObservacionFondo
        fields = [
            'id', 'fondo_tiempo', 'fecha_creacion', 'resuelta',
            'resuelta_por', 'resuelta_por_nombre', 'fecha_resolucion',
        ]
        read_only_fields = ['id', 'fecha_creacion', 'resuelta', 'resuelta_por', 'fecha_resolucion']

    def get_resuelta_por_nombre(self, obj):
        """Retorna el nombre completo del usuario que resolvió la observación."""
        if obj.resuelta_por:
            return obj.resuelta_por.get_full_name()
        return None


class ObservacionFondoSerializer(HiloObservacionSerializer):
    """Serializer para hilos de observación"""
    mensajes = serializers.SerializerMethodField()
    cantidad_mensajes = serializers.SerializerMethodField()
    ultimo_mensaje = serializers.SerializerMethodField()

    class Meta(HiloObservacionSerializer.Meta):
        fields = HiloObservacionSerializer.Meta.fields + ['mensajes', 'cantidad_mensajes', 'ultimo_mensaje']

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



# =====================================================
# HISTORIAL FONDO SERIALIZER
# =====================================================

class HistorialFondoSerializer(serializers.ModelSerializer):
    tipo_cambio_display = serializers.CharField(source='get_tipo_cambio_display', read_only=True)
    usuario_nombre = serializers.CharField(source='usuario.get_full_name', read_only=True)
    fondo_descripcion = serializers.CharField(source='fondo_tiempo.descripcion', read_only=True)
    
    class Meta:
        model = HistorialFondo
        fields = [
            'id', 'fondo_tiempo', 'fondo_descripcion',
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
    # Al Director, solo el vínculo de su carrera.
    vinculos = serializers.SerializerMethodField()

    def get_vinculos(self, obj):
        return DocenteCarreraSerializer(vinculos_visibles(obj, self.context), many=True).data

    class Meta:
        model = Docente
        fields = [
            'id', 'nombres', 'apellido_paterno', 'apellido_materno', 'ci',
            'fecha_ingreso', 'dias_vacacion',
            'email', 'telefono', 'activo', 'fecha_creacion',
            'nombre_completo', 'vinculos',
        ]


# =====================================================
# ACTUALIZACION DE FONDO TIEMPO SERIALIZER
# =====================================================

class FondoTiempoDetalleSerializer(serializers.ModelSerializer):
    """Serializer completo con todas las relaciones"""
    descripcion = serializers.CharField(read_only=True)
    docente = DocenteDetalleSerializer(read_only=True)
    carrera = CarreraSerializer(read_only=True)
    # Calendarios de la carrera en la gestión del fondo (para asignar materias).
    calendarios = serializers.SerializerMethodField()
    programas_analiticos_faltantes = serializers.SerializerMethodField()
    
    estado_display = serializers.CharField(source='get_estado_display', read_only=True)
    # Aseguramos que se devuelva la URL como string explícito
    
    # Propiedades calculadas
    porcentaje_completado = serializers.SerializerMethodField()
    horas_disponibles = serializers.SerializerMethodField()
    antiguedad = serializers.SerializerMethodField()
    
    # Relaciones
    categorias = serializers.SerializerMethodField()
    informes = InformeFondoListSerializer(many=True, read_only=True)
    observaciones_detalladas = ObservacionFondoSerializer(many=True, read_only=True)
    informe_actual = serializers.SerializerMethodField()
    
    total_asignado = serializers.SerializerMethodField()
    # Permisos
    puede_editar = serializers.SerializerMethodField()
    # El editor del informe se abre en solo lectura si es False.
    puede_editar_informe = serializers.SerializerMethodField()
    # Variantes de "Ejercicio del cargo" que el formulario de cargas ofrece.
    tipos_ejercicio_cargo = serializers.SerializerMethodField()
    # El botón Iniciar del detalle sigue exactamente a iniciar_ejecucion.
    puede_iniciar_ejecucion = serializers.SerializerMethodField()
    # Revisión: nadie revisa su propio fondo; el del Director lo revisa el superusuario.
    es_fondo_propio = serializers.SerializerMethodField()
    es_fondo_de_director = serializers.SerializerMethodField()
    
    class Meta:
        model = FondoTiempo
        fields = [
            'id', 'docente', 'carrera', 'calendarios',
            'gestion', 'descripcion',
            'horas_semana', 'horas_vacacion', 'horas_feriados',
            'contrato_horas',
            'horas_efectivas', 'total_asignado',
            'estado', 'estado_display', 'observaciones',
            'programas_analiticos_faltantes',
            'fecha_presentacion', 'fecha_aprobacion', 'fecha_validacion',
            'aprobado_por', 'validado_por',
            'archivado', 'comentarios_admin',
            'fecha_creacion', 'fecha_modificacion',
            # Calculados
            'porcentaje_completado', 'horas_disponibles',
            'antiguedad', # Relaciones
            'categorias', 'informes', 'observaciones_detalladas',
            'informe_actual',
            # Permisos
            'puede_editar', 'puede_editar_informe', 'tipos_ejercicio_cargo', 'puede_iniciar_ejecucion',
            'es_fondo_propio', 'es_fondo_de_director', 'documento_decanatura', 'documento_decanatura_informe',
        ]
        read_only_fields = [
            'estado', 'horas_efectivas',
            'fecha_aprobacion', 'fecha_validacion',
        ]
    
    def get_total_asignado(self, obj):
        if not hasattr(obj, '_total_asignado_calculado'):
            obj._total_asignado_calculado = obj.total_asignado
        return obj._total_asignado_calculado

    def get_porcentaje_completado(self, obj):
        total_asignado = self.get_total_asignado(obj)
        if not obj.horas_efectivas or obj.horas_efectivas == 0:
            return 0
        return float((total_asignado / obj.horas_efectivas) * 100)

    def get_categorias(self, obj):
        return unidades_del_fondo(obj)

    def get_horas_disponibles(self, obj):
        total_asignado = self.get_total_asignado(obj)
        return obj.horas_efectivas - total_asignado

    def get_antiguedad(self, obj):
        if obj.docente:
            return obj.docente.calcular_antiguedad(obj.fecha_referencia_antiguedad())
        return 0

    def get_programas_analiticos_faltantes(self, obj):
        return obj.programas_analiticos_faltantes()

    def get_calendarios(self, obj):
        return CalendarioAcademicoSerializer(
            obj.calendarios_de_la_gestion().order_by('fecha_inicio'), many=True,
        ).data

    def get_puede_editar(self, obj):
        """Mismas condiciones que FondoTiempoViewSet._puede_editar_fondo (rol activo):
        superusuario, o Director / Jefe de Estudios de la carrera con el fondo en
        borrador u observado. El docente no edita su fondo."""
        request = self.context.get('request')
        if not request or not getattr(request, 'user', None):
            return False
        if request.user.is_superuser:
            return True
        if obj.estado not in ['borrador', 'observado']:
            return False
        perfil = get_effective_profile(request.user, request)
        if not (perfil and perfil.rol in ['director', 'jefe_estudios']):
            return False
        return get_active_careers_for_user(request.user, request).filter(pk=obj.carrera_id).exists()

    def get_puede_editar_informe(self, obj):
        """Mismas condiciones que guardar-informe-borrador: el docente dueño (o el
        superusuario), con el fondo en ejecución y el informe sin enviar."""
        request = self.context.get('request')
        if not request or obj.estado != 'en_ejecucion':
            return False
        if not obj.puede_redactar_informe(request.user, get_effective_profile(request.user, request)):
            return False
        informe = obj.informes.filter(tipo='parcial').order_by('-fecha_elaboracion').first()
        return informe is None or informe.estado in ('borrador', 'observado')

    def get_tipos_ejercicio_cargo(self, obj):
        return tipos_ejercicio_cargo_del_fondo(obj)

    def get_puede_iniciar_ejecucion(self, obj):
        """Mismas condiciones que FondoTiempoViewSet.iniciar_ejecucion: fondo aprobado,
        nadie inicia su propio fondo, el del Director lo inicia el superusuario y el resto
        el superusuario o el Director (rol activo) de la carrera."""
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or obj.estado != 'aprobado_director' or obj.pertenece_a(user):
            return False
        if obj.es_de_director_de_su_carrera():
            return user.is_superuser
        if user.is_superuser:
            return True
        perfil = get_effective_profile(user, request)
        return bool(
            perfil and perfil.rol == 'director'
            and get_active_careers_for_user(user, request).filter(pk=obj.carrera_id).exists()
        )

    def get_es_fondo_propio(self, obj):
        request = self.context.get('request')
        return obj.pertenece_a(getattr(request, 'user', None))

    def get_es_fondo_de_director(self, obj):
        return obj.es_de_director_de_su_carrera()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return _filtrar_categorias_investigacion_para_iisyp(data, self.context)
    
    def get_informe_actual(self, obj):
        """Documento del informe (guardado o precargado con defaults, ver
        _informe_actual_o_borrador)."""
        return _informe_actual_o_borrador(obj, self.context)


# =====================================================
# SERIALIZERS PARA ACCIONES ESPEC\u00cdFICAS
# =====================================================

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
