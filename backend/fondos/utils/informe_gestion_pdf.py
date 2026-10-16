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
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from fondos.models import UNIDADES_FONDO, CargaHoraria, FondoTiempo, InformeFondo
from fondos.utils.informe_texto import nombre_director
from fondos.utils.pdf_generator import _capitalizar

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
    """Filas por docente y resumen por unidad de los fondos vigentes de la carrera en la
    gestión. Los fondos en borrador no se incluyen (aún no se presentaron): se cuentan
    aparte para la nota del informe."""
    vigentes = FondoTiempo.objects.filter(carrera=carrera, gestion=gestion, archivado=False)
    borradores_excluidos = vigentes.filter(estado='borrador').count()
    fondos = list(
        vigentes.exclude(estado='borrador')
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
        'borradores_excluidos': borradores_excluidos,
        'otras_carreras': otras_carreras,
        'unidades': unidades,
        'total_efectivas': sum(Decimal(str(fila['horas_efectivas'])) for fila in filas),
        'total_asignado': total_asignado,
    }


class InformeGestionCarreraPDF:
    @staticmethod
    def _estilos():
        base = getSampleStyleSheet()
        return {
            'seccion': ParagraphStyle('IGSeccion', parent=base['Normal'], fontName='Helvetica-Bold',
                                      fontSize=10, leading=13, textColor=AZUL, spaceBefore=4, spaceAfter=4),
            # Mismo título y encabezado institucional que el PDF del Fondo de Tiempo
            # (FondoPDFGenerator: _get_estilo_titulo y estilo_header_bold).
            'titulo_fondo': ParagraphStyle('IGTituloFondo', parent=base['Heading1'], fontName='Helvetica-Bold',
                                           fontSize=10, alignment=1, spaceAfter=6),
            'institucion': ParagraphStyle('IGInstitucion', parent=base['Normal'], fontName='Helvetica-Bold',
                                          fontSize=8, alignment=1, leading=9),
            'firma': ParagraphStyle('IGFirma', parent=base['Normal'], fontName='Helvetica', fontSize=9,
                                    alignment=1, leading=12),
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
            p(f'INFORME DE GESTIÓN – GESTIÓN {gestion} – CARRERA DE {carrera.nombre.upper()}', 'titulo_fondo'),
            p('Universidad Autónoma del Beni José Ballivián', 'institucion'),
            p(_capitalizar(carrera.facultad.nombre) if carrera.facultad else '', 'institucion'),
            p(f'Carrera de {_capitalizar(carrera.nombre)}', 'institucion'),
            Spacer(1, 0.3 * cm),
            p('Control y Distribución del Tiempo de la Docencia (RR 14-A/2017, Arts. 19 y 28). '
              f'Emitido el {timezone.localdate().strftime("%d/%m/%Y")}.', 'nota'),
        ]
        if datos['borradores_excluidos']:
            cantidad = datos['borradores_excluidos']
            story.append(p(
                f'No se incluye{"n" if cantidad > 1 else ""} {cantidad} fondo{"s" if cantidad > 1 else ""} '
                f'en borrador (aún no presentado{"s" if cantidad > 1 else ""} al Director).', 'nota',
            ))
        story += [Spacer(1, 0.4 * cm), p('Docentes y cumplimiento', 'seccion')]

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

        if datos['otras_carreras']:
            story += [
                Spacer(1, 0.5 * cm), p('Docentes de otras carreras con materias de esta carrera', 'seccion'),
                p('Sus horas figuran en el Fondo de Tiempo de su carrera: no se suman a los totales de este informe.', 'nota'),
                Spacer(1, 0.15 * cm),
            ]
            filas = [[p(texto, 'cabecera') for texto in
                      ['N°', 'Docente', 'Carrera del fondo', 'Materia', 'Horas asignadas', 'Estado del fondo']]]
            for numero, fila in enumerate(datos['otras_carreras'], start=1):
                filas.append([
                    p(numero), p(fila['docente']), p(fila['carrera_fondo']), p(fila['materia']),
                    p(_horas(fila['horas']), 'num'), p(fila['estado']),
                ])
            story.append(InformeGestionCarreraPDF._tabla(
                filas, [1.0 * cm, 6.4 * cm, 4.6 * cm, 6.4 * cm, 2.8 * cm, 4.0 * cm],
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

        # Firma del Director de Carrera (Art. 19: eleva el informe a la Decanatura).
        director = nombre_director(carrera)
        firma = [p('_' * 40, 'firma')]
        if director != 'SIN DIRECTOR ASIGNADO':
            firma.append(p(director, 'firma'))
        firma += [p('DIRECTOR(A) DE CARRERA', 'institucion'), p(f'Carrera de {_capitalizar(carrera.nombre)}', 'firma')]
        story += [Spacer(1, 1.6 * cm), KeepTogether(firma)]

        doc.build(story)
        buffer.seek(0)
        return buffer
