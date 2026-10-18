"""Informe de gestión de la carrera (Arts. 19, 20 y 28 del Reglamento, RR 14-A/2017).

Nota del Director de Carrera al Vicerrectorado de Pregrado, por vía de la Decanatura y con copia
a la Dirección de Planificación Académica, sobre el control y la distribución del tiempo de la
docencia en la gestión: el cumplimiento de cada docente (evaluado a través de su informe,
Art. 19), sus proyectos y actividades de investigación, interacción social, extensión, cursos
y seminarios (Arts. 18 a 20), el resumen por unidad (Art. 12) y los docentes de otras carreras
con materias de esta. Es "parcial" mientras queden fondos sin finalizar y "final" cuando
todos lo están (Art. 28: a la finalización de la gestión). Hoja carta, texto sobrio.
"""
import io
from decimal import Decimal
from html import escape

from django.db.models import Sum
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas as pdfgen_canvas
from reportlab.platypus import HRFlowable, KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from fondos.models import (
    TIPOS_ACTIVIDAD_CURSO, TIPOS_ACTIVIDAD_PROYECTO, UNIDADES_FONDO, CargaHoraria, FondoTiempo, InformeFondo,
)
from fondos.utils.informe_texto import dedicacion_docente, fecha_larga_es, nombre_director
from fondos.utils.pdf_generator import _capitalizar

NEGRO = colors.HexColor('#0f172a')
GRIS_TEXTO = colors.HexColor('#475569')
GRIS_BORDE = colors.HexColor('#94a3b8')
GRIS_CABECERA = colors.HexColor('#e2e8f0')
ANCHO_UTIL = LETTER[0] - 4 * cm  # márgenes de 2 cm
PENDIENTE_EVALUACION = 'Pendiente de evaluación'

# Proyectos y actividades de los Arts. 18 a 20 (los que llevan documento PDF).
TIPO_PROYECTO = {
    'elaboracion_trabajos_investigacion': 'Proyecto de investigación',
    'proyectos_extension': 'Proyecto de extensión universitaria',
    'proyectos_interaccion': 'Proyecto de interacción social',
    'proyectos_sociales': 'Proyecto social',
    'cursos': 'Curso',
    'seminarios': 'Seminario',
    'talleres': 'Taller',
    'capacitacion_externa': 'Capacitación',
}


def _horas(valor):
    return f'{int(round(Decimal(str(valor or 0))))}'


def _porcentaje(parte, total):
    total = Decimal(str(total or 0))
    if not total:
        return '0,0 %'
    return f'{Decimal(str(parte or 0)) / total * 100:.1f} %'.replace('.', ',')


def _plural(cantidad, singular, plural=None):
    return f'{cantidad} {singular if cantidad == 1 else (plural or singular + "s")}'


def datos_informe_gestion(carrera, gestion):
    """Datos del informe de los fondos vigentes de la carrera en la gestión. Los fondos en
    borrador no se incluyen (aún no se presentaron): se cuentan aparte para la nota. El
    informe es final cuando todos los fondos vigentes están finalizados."""
    vigentes = FondoTiempo.objects.filter(carrera=carrera, gestion=gestion, archivado=False)
    borradores_excluidos = vigentes.filter(estado='borrador').count()
    pendientes = vigentes.exclude(estado='finalizado').count()
    fondos = list(
        vigentes.exclude(estado='borrador')
        .select_related('docente', 'carrera')
        .annotate(asignado=Sum('cargas__horas'))
        .order_by('docente__apellido_paterno', 'docente__apellido_materno', 'docente__nombres')
    )
    # Evaluación del informe (Art. 19), la del último informe de cada fondo: con el fondo
    # finalizado, el resultado; evaluado sin finalizar, el resultado "(sin finalizar)".
    evaluaciones = {}
    informes = InformeFondo.objects.filter(fondo_tiempo__in=fondos, tipo='parcial').order_by('fecha_elaboracion', 'id')
    for informe in informes:  # el último de cada fondo queda al final
        evaluaciones[informe.fondo_tiempo_id] = informe.get_cumplimiento_display() if informe.cumplimiento else ''

    def evaluacion(fondo):
        resultado = evaluaciones.get(fondo.pk)
        if resultado and fondo.estado == 'finalizado':
            return resultado
        if resultado and fondo.estado == 'informe_evaluado':
            return f'{resultado} (sin finalizar)'  # sigue contando como pendiente
        return PENDIENTE_EVALUACION

    filas = [
        {
            'docente': fondo.docente.nombre_completo if fondo.docente else 'Sin docente',
            'dedicacion': dedicacion_docente(fondo)[0] or '-',
            'estado': fondo.get_estado_display(),
            'horas_efectivas': fondo.horas_efectivas or 0,
            'horas_asignadas': fondo.asignado or 0,
            'evaluacion': evaluacion(fondo),
        }
        for fondo in fondos
    ]

    # Proyectos y actividades (Arts. 18 a 20). El sistema evalúa el fondo, no cada proyecto:
    # el cumplimiento de cada uno es el de la evaluación del informe de su docente.
    por_fondo = {fondo.pk: fondo for fondo in fondos}
    proyectos = [
        {
            'docente': por_fondo[carga.fondo_id].docente.nombre_completo,
            'tipo': TIPO_PROYECTO.get(carga.tipo_actividad, carga.tipo_actividad),
            'titulo': carga.titulo_actividad,
            'horas': carga.horas or 0,
            'cumplimiento': evaluacion(por_fondo[carga.fondo_id]),
        }
        for carga in CargaHoraria.objects.filter(
            fondo__in=fondos, tipo_actividad__in=TIPOS_ACTIVIDAD_PROYECTO | TIPOS_ACTIVIDAD_CURSO,
        ).order_by('fondo__docente__apellido_paterno', 'fondo__docente__nombres', 'categoria', 'id')
    ]

    horas_por_unidad = dict(
        CargaHoraria.objects.filter(fondo__in=fondos).order_by().values_list('categoria').annotate(total=Sum('horas'))
    )
    docentes_por_unidad = {}
    for categoria, _fondo in CargaHoraria.objects.filter(fondo__in=fondos).order_by().values_list('categoria', 'fondo').distinct():
        docentes_por_unidad[categoria] = docentes_por_unidad.get(categoria, 0) + 1
    total_asignado = sum(Decimal(str(fila['horas_asignadas'])) for fila in filas)
    unidades = [
        {
            'unidad': nombre,
            'horas': horas_por_unidad.get(tipo, 0),
            'docentes': docentes_por_unidad.get(tipo, 0),
            'porcentaje': _porcentaje(horas_por_unidad.get(tipo, 0), total_asignado),
        }
        for tipo, nombre in UNIDADES_FONDO
    ]
    # Doble carrera: materias de esta carrera que dictan docentes cuyo fondo es de otra.
    # Esas horas ya cuentan en el fondo (y el informe) de la otra carrera: aquí van aparte,
    # sin sumarse a los totales.
    horas_otras = (
        CargaHoraria.objects.filter(calendario__carrera=carrera, fondo__gestion=gestion, fondo__archivado=False)
        .exclude(fondo__carrera=carrera).exclude(fondo__estado='borrador')
        .order_by().values('fondo', 'materia__nombre').annotate(horas_total=Sum('horas'))
    )
    fondos_otras = FondoTiempo.objects.select_related('docente__user', 'carrera').in_bulk(
        {fila['fondo'] for fila in horas_otras}
    )
    otras_carreras = sorted(
        (
            {
                'docente': fondos_otras[fila['fondo']].docente.nombre_completo,
                'carrera_fondo': fondos_otras[fila['fondo']].carrera.nombre,
                'materia': fila['materia__nombre'],
                'horas': fila['horas_total'] or 0,
                'estado': fondos_otras[fila['fondo']].get_estado_display(),
            }
            for fila in horas_otras
        ),
        key=lambda fila: (fila['docente'], fila['materia']),
    )
    return {
        'filas': filas,
        'proyectos': proyectos,
        'borradores_excluidos': borradores_excluidos,
        'pendientes': pendientes,
        'total_fondos': vigentes.count(),
        'es_final': vigentes.exists() and pendientes == 0,
        'otras_carreras': otras_carreras,
        'unidades': unidades,
        'total_efectivas': sum(Decimal(str(fila['horas_efectivas'])) for fila in filas),
        'total_asignado': total_asignado,
    }


def _canvas_con_paginas():
    """Canvas que dibuja "Página X de Y" al pie de cada hoja."""
    class _Canvas(pdfgen_canvas.Canvas):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, **kwargs)
            self._paginas = []

        def showPage(self):
            self._paginas.append(dict(self.__dict__))
            self._startPage()

        def save(self):
            total = len(self._paginas)
            for estado in self._paginas:
                self.__dict__.update(estado)
                self.setFont('Helvetica', 7.5)
                self.setFillColor(GRIS_TEXTO)
                self.drawCentredString(LETTER[0] / 2, 1.1 * cm, f'Página {self.getPageNumber()} de {total}')
                super().showPage()
            super().save()
    return _Canvas


class InformeGestionCarreraPDF:
    @staticmethod
    def _estilos():
        base = getSampleStyleSheet()['Normal']

        def estilo(nombre, **kwargs):
            return ParagraphStyle(nombre, parent=base, **{
                'fontName': 'Helvetica', 'fontSize': 9, 'leading': 12, 'textColor': NEGRO, **kwargs,
            })
        return {
            'institucion': estilo('IGInst', fontName='Helvetica-Bold', fontSize=8.5, leading=10.5, alignment=1),
            'titulo': estilo('IGTitulo', fontName='Helvetica-Bold', fontSize=11, leading=14, alignment=1),
            'subtitulo': estilo('IGSubtitulo', fontName='Helvetica-Bold', fontSize=9.5, leading=12, alignment=1),
            'etiqueta': estilo('IGEtiqueta', fontName='Helvetica-Bold'),
            'texto': estilo('IGTexto', alignment=4),
            # El título (y su nota) quedan en la misma hoja que su tabla.
            'seccion': estilo('IGSeccion', fontName='Helvetica-Bold', fontSize=10, leading=13, spaceAfter=3, keepWithNext=1),
            'celda': estilo('IGCelda', fontSize=8, leading=10),
            'num': estilo('IGNum', fontSize=8, leading=10, alignment=2),
            'cabecera': estilo('IGCab', fontName='Helvetica-Bold', fontSize=8, leading=10),
            'total': estilo('IGTotal', fontName='Helvetica-Bold', fontSize=8, leading=10),
            'total_num': estilo('IGTotalNum', fontName='Helvetica-Bold', fontSize=8, leading=10, alignment=2),
            'nota_seccion': estilo('IGNotaSeccion', fontSize=8, leading=10.5, textColor=GRIS_TEXTO, spaceAfter=3, keepWithNext=1),
            'firma': estilo('IGFirma', alignment=1),
        }

    @staticmethod
    def _tabla(filas, anchos, con_total=False):
        tabla = Table(filas, colWidths=anchos, repeatRows=1)
        comandos = [
            ('BACKGROUND', (0, 0), (-1, 0), GRIS_CABECERA),
            ('GRID', (0, 0), (-1, -1), 0.4, GRIS_BORDE),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ]
        if con_total:
            comandos.append(('LINEABOVE', (0, -1), (-1, -1), 0.9, NEGRO))
        tabla.setStyle(TableStyle(comandos))
        return tabla

    @staticmethod
    def generar(carrera, gestion):
        datos = datos_informe_gestion(carrera, gestion)
        e = InformeGestionCarreraPDF._estilos()
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=LETTER, leftMargin=2 * cm, rightMargin=2 * cm,
            topMargin=1.8 * cm, bottomMargin=1.8 * cm,
            title=f'Informe de gestión {gestion} - {carrera.nombre}',
        )

        def p(texto, estilo='celda'):
            return Paragraph(escape(str(texto)), e[estilo])

        carrera_nombre = _capitalizar(carrera.nombre)
        facultad = _capitalizar(carrera.facultad.nombre) if carrera.facultad else ''
        director = nombre_director(carrera)
        tipo_informe = 'INFORME FINAL' if datos['es_final'] else 'INFORME PARCIAL'

        # 1. Encabezado institucional (como el PDF del fondo) y título.
        story = [
            p('Universidad Autónoma del Beni José Ballivián', 'institucion'),
            p('Vicerrectorado de Pregrado', 'institucion'),
            p(facultad, 'institucion'),
            p(f'Carrera de {carrera_nombre}', 'institucion'),
            Spacer(1, 0.25 * cm),
            HRFlowable(width='100%', thickness=0.8, color=NEGRO),
            Spacer(1, 0.35 * cm),
            p(f'INFORME DE GESTIÓN – GESTIÓN {gestion} – CARRERA DE {carrera.nombre.upper()}', 'titulo'),
            p(tipo_informe, 'subtitulo'),
            Spacer(1, 0.4 * cm),
        ]

        # Bloque de nota.
        de = [p(director if director != 'SIN DIRECTOR ASIGNADO' else '', 'texto'), p(f'Director(a) de Carrera de {carrera_nombre}', 'texto')]
        nota = [
            ('A:', [p('Vicerrector(a) de Pregrado', 'texto')]),
            ('Vía:', [p(f'Decano(a) de la {facultad}' if facultad else 'Decano(a) de la Facultad', 'texto')]),
            ('Copia:', [p('Dirección de Planificación Académica', 'texto')]),
            ('De:', de),
            ('Ref.:', [p('Informe de gestión – Control y Distribución del Tiempo de la Docencia, '
                         f'Gestión {gestion}', 'etiqueta')]),
            ('Fecha:', [p(f'Trinidad, {fecha_larga_es(timezone.localdate())}', 'texto')]),
        ]
        tabla_nota = Table([[p(etiqueta, 'etiqueta'), valor] for etiqueta, valor in nota], colWidths=[1.8 * cm, ANCHO_UTIL - 1.8 * cm])
        tabla_nota.setStyle(TableStyle([
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 1.5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 1.5),
        ]))
        story += [tabla_nota, Spacer(1, 0.25 * cm), HRFlowable(width='100%', thickness=0.5, color=GRIS_BORDE), Spacer(1, 0.35 * cm)]

        # 2. Introducción.
        borradores = datos['borradores_excluidos']
        estado = (
            'Todos los fondos de la gestión están finalizados, por lo que este es el informe final.'
            if datos['es_final'] else
            f'Este informe es parcial: de {_plural(datos["total_fondos"], "fondo")} de la gestión, '
            f'{datos["pendientes"]} {"queda" if datos["pendientes"] == 1 else "quedan"} sin finalizar'
            + (f', {"incluido" if borradores == 1 else "incluidos"} {borradores} en borrador que no se '
               f'{"lista" if borradores == 1 else "listan"}' if borradores else '')
            + '.'
        )
        story += [
            p('De mi consideración:', 'texto'),
            Spacer(1, 0.15 * cm),
            p(
                'En cumplimiento de los Arts. 19, 20 y 28 del Reglamento General para el Control y Distribución '
                'del Tiempo de la Docencia (RR 14-A/2017), elevo a su autoridad el informe de gestión '
                f'{gestion} de la Carrera de {carrera_nombre}: el cumplimiento o incumplimiento del fondo de tiempo '
                'de cada docente, evaluado a través de su informe, y de sus proyectos y actividades de '
                'investigación, interacción social, extensión universitaria, cursos y seminarios. '
                + estado, 'texto',
            ),
        ]

        # 3. Cumplimiento por docente (Art. 19).
        story += [Spacer(1, 0.45 * cm), p('1. Cumplimiento por docente', 'seccion')]
        filas = [[p(texto, 'cabecera') for texto in
                  ['N°', 'Docente', 'Dedicación', 'Horas efectivas', 'Horas asignadas', 'Estado del fondo', 'Evaluación']]]
        for numero, fila in enumerate(datos['filas'], start=1):
            filas.append([
                p(numero), p(fila['docente']), p(fila['dedicacion']),
                p(_horas(fila['horas_efectivas']), 'num'), p(_horas(fila['horas_asignadas']), 'num'),
                p(fila['estado']), p(fila['evaluacion']),
            ])
        if not datos['filas']:
            filas.append([p('-'), p('No hay fondos de tiempo presentados en esta gestión.'), '', '', '', '', ''])
        filas.append([
            p(''), p('Total', 'total'), p(_plural(len(datos['filas']), 'docente'), 'total'),
            p(_horas(datos['total_efectivas']), 'total_num'), p(_horas(datos['total_asignado']), 'total_num'), p(''), p(''),
        ])
        story.append(InformeGestionCarreraPDF._tabla(
            filas, [0.7 * cm, 4.3 * cm, 2.7 * cm, 1.6 * cm, 1.7 * cm, 3.0 * cm, 3.6 * cm], con_total=True,
        ))

        # 4. Proyectos y actividades (Arts. 18 a 20).
        story += [
            Spacer(1, 0.45 * cm), p('2. Proyectos y actividades (Arts. 18 a 20)', 'seccion'),
            p('El cumplimiento de cada proyecto o actividad es el de la evaluación del informe de su docente: '
              'el sistema evalúa el fondo de tiempo, no cada proyecto por separado.', 'nota_seccion'),
        ]
        filas = [[p(texto, 'cabecera') for texto in ['N°', 'Docente', 'Tipo', 'Título', 'Horas', 'Cumplimiento']]]
        for numero, fila in enumerate(datos['proyectos'], start=1):
            filas.append([
                p(numero), p(fila['docente']), p(fila['tipo']), p(fila['titulo']),
                p(_horas(fila['horas']), 'num'), p(fila['cumplimiento']),
            ])
        if not datos['proyectos']:
            filas.append([p('-'), p('No se registraron proyectos, cursos ni seminarios en los fondos de la gestión.'), '', '', '', ''])
        story.append(InformeGestionCarreraPDF._tabla(
            filas, [0.8 * cm, 3.6 * cm, 3.0 * cm, 5.4 * cm, 1.3 * cm, 3.5 * cm],
        ))

        # 5. Resumen por unidad (Art. 12).
        story += [Spacer(1, 0.45 * cm), p('3. Resumen por unidad (Art. 12)', 'seccion')]
        filas = [[p(texto, 'cabecera') for texto in ['Unidad', 'Horas asignadas', '% del total asignado', 'Docentes con horas']]]
        for unidad in datos['unidades']:
            filas.append([p(unidad['unidad']), p(_horas(unidad['horas']), 'num'), p(unidad['porcentaje'], 'num'),
                          p(unidad['docentes'], 'num')])
        filas.append([p('Total', 'total'), p(_horas(datos['total_asignado']), 'total_num'),
                      p('100,0 %' if datos['total_asignado'] else '0,0 %', 'total_num'), p('')])
        story.append(InformeGestionCarreraPDF._tabla(
            filas, [7.6 * cm, 3.3 * cm, 3.3 * cm, 3.4 * cm], con_total=True,
        ))

        # 6. Docentes de otras carreras con materias de esta carrera.
        if datos['otras_carreras']:
            story += [
                Spacer(1, 0.45 * cm), p('4. Docentes de otras carreras con materias de esta carrera', 'seccion'),
                p('Sus horas figuran en el Fondo de Tiempo de su carrera: no se suman a los totales de este informe.', 'nota_seccion'),
            ]
            filas = [[p(texto, 'cabecera') for texto in
                      ['N°', 'Docente', 'Carrera del fondo', 'Materia', 'Horas', 'Estado del fondo']]]
            for numero, fila in enumerate(datos['otras_carreras'], start=1):
                filas.append([
                    p(numero), p(fila['docente']), p(fila['carrera_fondo']), p(fila['materia']),
                    p(_horas(fila['horas']), 'num'), p(fila['estado']),
                ])
            story.append(InformeGestionCarreraPDF._tabla(
                filas, [0.8 * cm, 4.2 * cm, 3.2 * cm, 4.4 * cm, 1.4 * cm, 3.6 * cm],
            ))

        # 8. Firma del Director de Carrera.
        firma = [p('Atentamente,', 'texto'), Spacer(1, 1.5 * cm), p('_' * 38, 'firma')]
        if director != 'SIN DIRECTOR ASIGNADO':
            firma.append(p(director, 'firma'))
        firma += [p('DIRECTOR(A) DE CARRERA', 'institucion'), p(f'Carrera de {carrera_nombre}', 'firma')]
        story += [Spacer(1, 0.7 * cm), KeepTogether(firma)]

        doc.build(story, canvasmaker=_canvas_con_paginas())
        buffer.seek(0)
        return buffer
