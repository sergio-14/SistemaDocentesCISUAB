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
from datetime import date
from html import escape

from django.apps import apps

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
    if not carrera:
        return 'SIN DIRECTOR ASIGNADO'
    PerfilUsuario = apps.get_model('fondos', 'PerfilUsuario')
    perfil_director = PerfilUsuario.objects.filter(
        carrera=carrera, rol='director', activo=True,
    ).select_related('docente', 'user').first()
    if not perfil_director:
        return 'SIN DIRECTOR ASIGNADO'
    if perfil_director.docente:
        return perfil_director.docente.nombre_completo.upper()
    if perfil_director.user:
        nombre = perfil_director.user.get_full_name().strip()
        return (nombre or perfil_director.user.username).upper()
    return 'SIN DIRECTOR ASIGNADO'


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
    siglas_facultad = _siglas_facultad(fondo.carrera.facultad)
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


def asignatura_principal_html(fondo):
    """Nombres de materias del docente, en negrita y unidos en prosa ('A y
    B' / 'A, B y C'), como HTML ya escapado listo para un Paragraph/editor."""
    CargaHoraria = apps.get_model('fondos', 'CargaHoraria')
    cargas = CargaHoraria.objects.filter(
        docente=fondo.docente, calendario=fondo.calendario_academico, categoria='academica',
    ).select_related('materia')
    materias = []
    vistos = set()
    for carga in cargas:
        if not carga.materia or carga.materia_id in vistos:
            continue
        vistos.add(carga.materia_id)
        materias.append(carga.materia.nombre)
    if not materias:
        return escape(fondo.asignatura or 'las asignaturas asignadas')
    nombres = [f'<b>{escape(nombre)}</b>' for nombre in materias]
    if len(nombres) == 1:
        return nombres[0]
    return ', '.join(nombres[:-1]) + f' y {nombres[-1]}'


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
    asignatura_principal = asignatura_principal_html(fondo) if fondo.docente else 'sus asignaturas asignadas'
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
        f'en mi calidad de docente con dedicación a {escape(dedicacion_intro)}{abreviatura_texto}, dicto la '
        f'Asignatura de {asignatura_principal} del área de Tecnologías de Información y Comunicación y '
        'de acuerdo a la planificación presentada al inicio de la gestión académica para las 7 unidades de '
        f'medida establecidas, es que, al culminar el semestre de la gestión {escape(gestion_texto)} paso a '
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
        'fecha_texto': f'Trinidad, {fecha_larga_es(date.today())}',
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
