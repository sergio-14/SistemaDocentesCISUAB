from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.platypus import Paragraph, TableStyle


def texto_seguro(valor, default=''):
    """Convierte datos del usuario en texto válido para Paragraph de ReportLab."""
    if valor is None:
        return escape(str(default))
    texto = str(valor).strip()
    return escape(texto if texto else str(default))


def crear_estilos_documento():
    base = getSampleStyleSheet()
    return {
        'title': ParagraphStyle(
            'poa-title', parent=base['Heading3'], fontName='Helvetica-Bold',
            fontSize=10, alignment=1, leading=12, spaceAfter=1,
        ),
        'subtitle': ParagraphStyle(
            'poa-subtitle', parent=base['Heading4'], fontName='Helvetica-Bold',
            fontSize=8, alignment=1, leading=10, spaceAfter=4,
        ),
        'cell': ParagraphStyle(
            'poa-cell', parent=base['Normal'], fontName='Helvetica',
            fontSize=7, leading=9,
        ),
        'cell_bold': ParagraphStyle(
            'poa-cell-bold', parent=base['Normal'], fontName='Helvetica-Bold',
            fontSize=7, leading=9,
        ),
        'cell_small': ParagraphStyle(
            'poa-cell-small', parent=base['Normal'], fontName='Helvetica',
            fontSize=6.2, leading=8,
        ),
    }


def crear_estilos_reporte(prefijo):
    base = getSampleStyleSheet()
    return {
        'title': ParagraphStyle(
            f'{prefijo}-title', parent=base['Heading2'], fontName='Helvetica-Bold',
            fontSize=15, leading=18, textColor=colors.HexColor('#0f172a'),
        ),
        'subtitle': ParagraphStyle(
            f'{prefijo}-subtitle', parent=base['Normal'], fontName='Helvetica',
            fontSize=9, leading=11, textColor=colors.HexColor('#334155'),
        ),
        'cell': ParagraphStyle(
            f'{prefijo}-cell', parent=base['Normal'], fontName='Helvetica',
            fontSize=7.5, leading=9,
        ),
        'cell_bold': ParagraphStyle(
            f'{prefijo}-cell-bold', parent=base['Normal'], fontName='Helvetica-Bold',
            fontSize=7.5, leading=9,
        ),
    }


def parrafo(valor, estilo):
    return Paragraph(texto_seguro(valor), estilo)


def estilo_tabla_base(extra=None, color_borde=colors.HexColor('#cbd5e1')):
    reglas = [
        ('GRID', (0, 0), (-1, -1), 0.45, color_borde),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]
    if extra:
        reglas.extend(extra)
    return TableStyle(reglas)
