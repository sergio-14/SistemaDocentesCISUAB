"""
Construye los valores por defecto (precargados desde la BD) de cada bloque
editable del Informe de Fondo de Tiempo: encabezado institucional, fecha,
destinatario/remitente/referencia, saludo + parrafo introductorio, cierre y
firma. Estos defaults se usan en dos lugares que deben quedar sincronizados:

  1. El serializer (InformeFondoSerializer.to_representation) los usa para
     precargar el documento en el editor tipo Word del frontend cuando el
     docente aun no guardo su propio texto en ese campo (o no existe informe).
  2. InformePDFGenerator los usa como fallback al generar el PDF, para los
     mismos campos que el docente aun no personalizo.

Por eso viven en un solo modulo compartido en vez de duplicarse.
"""
from html import escape

from django.apps import apps
from django.utils import timezone

_MESES_ES = {
    1: 'enero', 2: 'febrero', 3: 'marzo', 4: 'abril', 5: 'mayo', 6: 'junio',
    7: 'julio', 8: 'agosto', 9: 'septiembre', 10: 'octubre', 11: 'noviembre', 12: 'diciembre',
}

_ABREVIATURA_DEDICACION = {
    'tiempo_completo': 'T.C.',
    'medio_tiempo': 'M.T.',
    'dedicacion_exclusiva': 'D.E.',
}

_ETIQUETAS_CARGO_GESTION = {
    'iiisyp': 'RESPONSABLE I.I.S. Y P.',
    'director': 'DIRECTOR(A) DE CARRERA',
    'jefe_estudios': 'JEFE(A) DE ESTUDIOS',
}

# Campos editables cuyo valor por defecto se calcula aqui. Los 4 campos de
# texto plano multi-linea/corto no llevan formato HTML; los 2 de "_html"
# admiten negrita/cursiva/listas/etc. desde el editor y se parsean en el PDF
# con _InformeHTMLParser.
CAMPOS_TEXTO_INFORME = [
    'encabezado_texto', 'fecha_texto',
    'destinatario_nombre', 'destinatario_cargo',
    'remitente_nombre', 'remitente_cargo', 'referencia_texto',
    'saludo_intro_html', 'cierre_html',
    'firma_nombre', 'firma_cargo', 'firma_email',
]


def fecha_larga_es(fecha):
    return f"{fecha.day} de {_MESES_ES.get(fecha.month, '')} de {fecha.year}"


def nombre_director(carrera):
    """Director(a) de la carrera según su asignación activa (la misma fuente que
    FondoTiempo.es_de_director_de_su_carrera): el rol base del perfil no sirve
    para quien tiene varios cargos."""
    if not carrera:
        return 'SIN DIRECTOR ASIGNADO'
    AsignacionCarrera = apps.get_model('fondos', 'AsignacionCarrera')
    asignacion = AsignacionCarrera.objects.filter(
        carrera=carrera, rol='director', activo=True, user__isnull=False,
    ).select_related('docente', 'user').order_by('id').first()
    if not asignacion:
        return 'SIN DIRECTOR ASIGNADO'
    docente = asignacion.docente or getattr(getattr(asignacion.user, 'perfil', None), 'docente', None)
    if docente:
        return docente.nombre_completo.upper()
    nombre = asignacion.user.get_full_name().strip()
    return (nombre or asignacion.user.username).upper()


def dedicacion_docente(fondo):
    """(texto, abreviatura_o_vacio) de la dedicación vigente del docente en
    esta carrera, ej. ('Tiempo Completo', 'T.C.')."""
    if not (fondo.docente and fondo.carrera):
        return ('', '')
    DocenteCarrera = apps.get_model('fondos', 'DocenteCarrera')
    vinculo = DocenteCarrera.objects.filter(
        docente=fondo.docente, carrera=fondo.carrera, activo=True,
    ).first()
    if not vinculo:
        return ('', '')
    return (vinculo.get_dedicacion_display(), _ABREVIATURA_DEDICACION.get(vinculo.dedicacion, ''))


def _siglas_facultad(nombre_facultad):
    conectores = {'de', 'del', 'y', 'la', 'el', 'los', 'las', 'en'}
    palabras = [p for p in (nombre_facultad or '').split() if p.lower() not in conectores]
    if not palabras:
        return ''
    return '.'.join(p[0].upper() for p in palabras) + '.'


def _etiqueta_gestion_docente(fondo):
    """Cargo de gestión (Director, Jefe de Estudios o I.I.S. y P.) que el
    docente ejerce en esta carrera ADEMÁS de la docencia, o None."""
    if not (fondo.docente and fondo.carrera):
        return None
    PerfilUsuario = apps.get_model('fondos', 'PerfilUsuario')
    perfil = PerfilUsuario.objects.filter(
        docente=fondo.docente, carrera=fondo.carrera, activo=True,
    ).exclude(rol='docente').first()
    if not perfil:
        return None
    return _ETIQUETAS_CARGO_GESTION.get(perfil.rol)


def cargo_gestion_docente(fondo):
    """Version larga del cargo de gestión para el destinatario "DE :", ej.
    'RESPONSABLE I.I.S. Y P. - CIS – F.I.T. - U.A.B.J.B.'. None si no tiene."""
    etiqueta = _etiqueta_gestion_docente(fondo)
    if not etiqueta:
        return None
    siglas_facultad = _siglas_facultad(fondo.carrera.facultad.nombre)
    return f'{etiqueta} - {fondo.carrera.codigo} – {siglas_facultad} - U.A.B.J.B.'


def _codigo_con_puntos(codigo):
    letras = [c for c in (codigo or '').upper() if c.isalnum()]
    if not letras:
        return ''
    return '.'.join(letras) + '.'


def cargo_firma_docente(fondo, cargo_dedicacion):
    """Version corta del cargo para la firma, ej. 'DOCENTE RESPONSABLE
    I.I.S. Y P. – C.I.S.'. Cae a `cargo_dedicacion` si no tiene cargo de
    gestión."""
    etiqueta = _etiqueta_gestion_docente(fondo)
    if not etiqueta:
        return cargo_dedicacion
    codigo_puntos = _codigo_con_puntos(fondo.carrera.codigo)
    return f'DOCENTE {etiqueta} – {codigo_puntos}'


def asignaturas_dictadas_html(fondo):
    """'la asignatura de <b>A</b>' / 'las asignaturas de <b>A</b>, <b>B</b> y <b>C</b>'
    (HTML ya escapado) con las materias de las Clases en aula del fondo: una vez
    cada una aunque se dicte en los dos semestres; las de otra carrera llevan su
    carrera entre paréntesis."""
    cargas = fondo.cargas.filter(
        tipo_actividad='clases_aula', materia__isnull=False,
    ).select_related('materia__carrera').order_by('calendario__fecha_inicio', 'id')
    materias = []
    vistos = set()
    for carga in cargas:
        materia = carga.materia
        if materia.pk in vistos:
            continue
        vistos.add(materia.pk)
        nombre = f'<b>{escape(materia.nombre)}</b>'
        if materia.carrera_id != fondo.carrera_id and materia.carrera:
            nombre += f' ({escape(materia.carrera.nombre)})'
        materias.append(nombre)
    if not materias:
        return 'las asignaturas asignadas'
    if len(materias) == 1:
        return f'la asignatura de {materias[0]}'
    return 'las asignaturas de ' + ', '.join(materias[:-1]) + f' y {materias[-1]}'


def construir_defaults_informe(fondo):
    """Dict con el valor por defecto de cada uno de los 12 campos de texto
    editables del Informe (ver CAMPOS_TEXTO_INFORME), calculado a partir de
    los datos reales de Docente/Carrera/Director en este momento."""
    nombre_direct = nombre_director(fondo.carrera)
    nombre_docente = fondo.docente.nombre_completo.upper() if fondo.docente else 'SIN DOCENTE ASIGNADO'
    carrera_nombre = fondo.carrera.nombre.upper() if fondo.carrera else 'CARRERA'
    gestion_texto = str(fondo.gestion) if fondo.gestion else ''
    dedicacion_texto, dedicacion_abrev = dedicacion_docente(fondo)
    cargo_docente = f'Docente a {dedicacion_texto}' if dedicacion_texto else 'Docente'
    cargo_destinatario = cargo_gestion_docente(fondo) or cargo_docente
    email_docente = fondo.docente.correo_institucional if fondo.docente else ''
    asignaturas = asignaturas_dictadas_html(fondo) if fondo.docente else 'las asignaturas asignadas'
    cargo_firma = cargo_firma_docente(fondo, cargo_docente)

    abreviatura_texto = f' ({dedicacion_abrev})' if dedicacion_abrev else ''
    dedicacion_intro = dedicacion_texto or 'Tiempo Completo'

    encabezado_texto = (
        'UNIVERSIDAD AUTÓNOMA DEL BENI "JOSÉ BALLIVIÁN"\n'
        'VICERRECTORADO DE PREGRADO\n'
        'FACULTAD DE INGENIERÍA Y TECNOLOGÍA\n'
        f'CARRERA: "{carrera_nombre}"'
    )

    saludo_intro_html = (
        '<p>Señor Director:</p>'
        '<p>En cumplimiento al Reglamento de Control y Distribución del tiempo de la Docencia de la U.A.B.J.B., '
        f'en mi calidad de docente con dedicación a {escape(dedicacion_intro)}{abreviatura_texto}, dicto '
        f'{asignaturas} y de acuerdo a la planificación presentada al inicio de la gestión académica para '
        f'las 7 unidades de medida establecidas, es que, al culminar la gestión {escape(gestion_texto)} paso a '
        'informar lo siguiente:</p>'
    )

    punto_final = '' if cargo_firma.rstrip().endswith('.') else '.'
    cierre_html = (
        f'<p>Adjunto Informe de las Actividades realizadas como {escape(cargo_firma)}{punto_final}</p>'
        '<p>Es todo en cuanto debo informar a su autoridad para los fines consiguientes.</p>'
        '<p>Sin otro particular, me despido con las atenciones más distinguidas.</p>'
        '<p>Atentamente,</p>'
    )

    return {
        'encabezado_texto': encabezado_texto,
        'fecha_texto': f'Trinidad, {fecha_larga_es(timezone.localdate())}',
        'destinatario_nombre': nombre_direct,
        'destinatario_cargo': f'DIRECTOR(A) DE LA CARRERA DE {carrera_nombre} – U.A.B.J.B.',
        'remitente_nombre': nombre_docente,
        'remitente_cargo': cargo_destinatario,
        'referencia_texto': f'Informe de Fondo de Tiempo Docente {carrera_nombre} {gestion_texto}',
        'saludo_intro_html': saludo_intro_html,
        'cierre_html': cierre_html,
        'firma_nombre': nombre_docente,
        'firma_cargo': cargo_firma,
        'firma_email': email_docente or '',
    }
