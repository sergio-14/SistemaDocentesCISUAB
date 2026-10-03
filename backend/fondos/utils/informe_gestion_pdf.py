"""Informe de gestión de la carrera (Arts. 19 y 28 del Reglamento, RR 14-A/2017).

PDF por carrera y gestión que descarga el Director (o el superusuario) para elevarlo a
la Decanatura y, por su intermedio, al Vicerrectorado y a Planificación Académica:
los docentes con el estado de su fondo, horas efectivas, horas asignadas y el nivel de
cumplimiento evaluado de su informe, más un resumen por unidad (Art. 12).
"""
import io
from decimal import Decimal
from html import escape

from django.db.models import Sum
from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from fondos.models import UNIDADES_FONDO, CargaHoraria, FondoTiempo, InformeFondo

AZUL = colors.HexColor('#1d4ed8')
GRIS_BORDE = colors.HexColor('#cbd5e1')
GRIS_FONDO = colors.HexColor('#f1f5f9')


def _horas(valor):
    return f'{int(round(Decimal(str(valor or 0))))}'


def _porcentaje(parte, total):
    total = Decimal(str(total or 0))
    if not total:
        return '0,0 %'
    return f'{Decimal(str(parte or 0)) / total * 100:.1f} %'.replace('.', ',')


def datos_informe_gestion(carrera, gestion):
    """Filas por docente y resumen por unidad de los fondos vigentes de la carrera en la gestión."""
    fondos = list(
        FondoTiempo.objects.filter(carrera=carrera, gestion=gestion, archivado=False)
        .select_related('docente')
        .annotate(asignado=Sum('cargas__horas'))
        .order_by('docente__apellido_paterno', 'docente__apellido_materno', 'docente__nombres')
    )
    cumplimientos = {}
    informes = InformeFondo.objects.filter(fondo_tiempo__in=fondos, tipo='parcial').order_by('fecha_elaboracion', 'id')
    for informe in informes:  # el último de cada fondo queda al final
        cumplimientos[informe.fondo_tiempo_id] = informe.get_cumplimiento_display() if informe.cumplimiento else ''

    filas = [
        {
            'docente': fondo.docente.nombre_completo if fondo.docente else 'Sin docente',
            'estado': fondo.get_estado_display(),
            'horas_efectivas': fondo.horas_efectivas or 0,
            'horas_asignadas': fondo.asignado or 0,
            'cumplimiento': cumplimientos.get(fondo.pk) or 'Sin evaluar',
            'fuera_de_plazo': bool(fondo.fuera_de_plazo),
        }
        for fondo in fondos
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
    return {
        'filas': filas,
        'unidades': unidades,
        'total_efectivas': sum(Decimal(str(fila['horas_efectivas'])) for fila in filas),
        'total_asignado': total_asignado,
    }


class InformeGestionCarreraPDF:
    @staticmethod
    def _estilos():
        base = getSampleStyleSheet()
        return {
            'titulo': ParagraphStyle('IGTitulo', parent=base['Heading1'], fontName='Helvetica-Bold',
                                     fontSize=15, leading=19, textColor=AZUL, spaceAfter=2),
            'subtitulo': ParagraphStyle('IGSub', parent=base['Normal'], fontName='Helvetica', fontSize=9.5,
                                        leading=12, textColor=colors.HexColor('#334155')),
            'seccion': ParagraphStyle('IGSeccion', parent=base['Normal'], fontName='Helvetica-Bold',
                                      fontSize=10, leading=13, textColor=AZUL, spaceBefore=4, spaceAfter=4),
            'celda': ParagraphStyle('IGCelda', parent=base['Normal'], fontName='Helvetica', fontSize=8, leading=10),
            'num': ParagraphStyle('IGNum', parent=base['Normal'], fontName='Helvetica', fontSize=8, leading=10, alignment=2),
            'cabecera': ParagraphStyle('IGCab', parent=base['Normal'], fontName='Helvetica-Bold', fontSize=8,
                                       leading=10, textColor=colors.white),
            'nota': ParagraphStyle('IGNota', parent=base['Normal'], fontName='Helvetica', fontSize=7.5,
                                   leading=9.5, textColor=colors.HexColor('#64748b')),
        }

    @staticmethod
    def _tabla(filas, anchos):
        tabla = Table(filas, colWidths=anchos, repeatRows=1)
        comandos = [
            ('BACKGROUND', (0, 0), (-1, 0), AZUL),
            ('GRID', (0, 0), (-1, -1), 0.5, GRIS_BORDE),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, GRIS_FONDO]),
        ]
        tabla.setStyle(TableStyle(comandos))
        return tabla

    @staticmethod
    def generar(carrera, gestion):
        datos = datos_informe_gestion(carrera, gestion)
        e = InformeGestionCarreraPDF._estilos()
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer, pagesize=landscape(A4), leftMargin=1.5 * cm, rightMargin=1.5 * cm,
            topMargin=1.3 * cm, bottomMargin=1.3 * cm,
            title=f'Informe de gestión {gestion} - {carrera.nombre}',
        )

        def p(texto, estilo='celda'):
            return Paragraph(escape(str(texto)), e[estilo])


        story = [
            p('INFORME DE GESTIÓN DE LA CARRERA', 'titulo'),
            p(f'Carrera de {carrera.nombre} · {carrera.facultad.nombre} · Gestión {gestion}', 'subtitulo'),
            p('Control y Distribución del Tiempo de la Docencia (RR 14-A/2017, Arts. 19 y 28). '
              f'Emitido el {timezone.localdate().strftime("%d/%m/%Y")}.', 'nota'),
            Spacer(1, 0.4 * cm),
            p('Docentes y cumplimiento', 'seccion'),
        ]

        cabecera = ['N°', 'Docente', 'Estado del fondo', 'Horas efectivas', 'Horas asignadas',
                    'Cumplimiento evaluado', 'Fuera de plazo']
        filas = [[p(texto, 'cabecera') for texto in cabecera]]
        for numero, fila in enumerate(datos['filas'], start=1):
            filas.append([
                p(numero), p(fila['docente']), p(fila['estado']),
                p(_horas(fila['horas_efectivas']), 'num'), p(_horas(fila['horas_asignadas']), 'num'),
                p(fila['cumplimiento']), p('Sí' if fila['fuera_de_plazo'] else 'No'),
            ])
        if not datos['filas']:
            filas.append([p('-'), p('No hay fondos de tiempo en esta gestión.'), '', '', '', '', ''])
        filas.append([
            p(''), p('TOTAL', 'celda'), p(f"{len(datos['filas'])} docentes"),
            p(_horas(datos['total_efectivas']), 'num'), p(_horas(datos['total_asignado']), 'num'), p(''), p(''),
        ])
        story.append(InformeGestionCarreraPDF._tabla(
            filas, [1.0 * cm, 7.6 * cm, 4.2 * cm, 2.8 * cm, 2.8 * cm, 4.2 * cm, 2.6 * cm],
        ))

        story += [Spacer(1, 0.5 * cm), p('Resumen por unidad (Art. 12)', 'seccion')]
        filas = [[p(texto, 'cabecera') for texto in ['Unidad', 'Horas asignadas', '% del total asignado', 'Docentes con horas']]]
        for unidad in datos['unidades']:
            filas.append([p(unidad['unidad']), p(_horas(unidad['horas']), 'num'), p(unidad['porcentaje'], 'num'),
                          p(unidad['docentes'], 'num')])
        filas.append([p('TOTAL'), p(_horas(datos['total_asignado']), 'num'),
                      p('100,0 %' if datos['total_asignado'] else '0,0 %', 'num'), p('')])
        story.append(InformeGestionCarreraPDF._tabla(
            filas, [9.0 * cm, 4.0 * cm, 4.0 * cm, 4.0 * cm],
        ))

        doc.build(story)
        buffer.seek(0)
        return buffer
