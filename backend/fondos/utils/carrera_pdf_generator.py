import base64
import io
from html import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


class CarreraPDFGenerator:
    """Genera la ficha oficial de una carrera como documento PDF."""

    @staticmethod
    def _texto(valor, fallback='No registrado.'):
        texto = str(valor or '').strip()
        return texto if texto else fallback

    @staticmethod
    def _parrafo(texto):
        limpio = escape(CarreraPDFGenerator._texto(texto)).replace('\n', '<br/>')
        return limpio

    @staticmethod
    def _fecha(fecha):
        if not fecha:
            return 'No registrada.'
        return fecha.strftime('%d/%m/%Y')

    @staticmethod
    def _logo_element(carrera):
        data_uri = carrera.get_logo_carrera_data_uri()
        if not data_uri or ',' not in data_uri:
            return Paragraph('Sin logo', CarreraPDFGenerator._styles()['placeholder'])

        try:
            image_bytes = base64.b64decode(data_uri.split(',', 1)[1])
            return Image(io.BytesIO(image_bytes), width=3.0 * cm, height=3.0 * cm, kind='proportional')
        except Exception:
            return Paragraph('Sin logo', CarreraPDFGenerator._styles()['placeholder'])

    @staticmethod
    def _styles():
        base = getSampleStyleSheet()
        return {
            'title': ParagraphStyle(
                'CarreraTitulo',
                parent=base['Heading1'],
                fontName='Helvetica-Bold',
                fontSize=18,
                leading=22,
                textColor=colors.HexColor('#1d4ed8'),
                alignment=TA_LEFT,
                spaceAfter=4,
            ),
            'code': ParagraphStyle(
                'CarreraCodigo',
                parent=base['Normal'],
                fontName='Helvetica-Bold',
                fontSize=10,
                leading=13,
                textColor=colors.HexColor('#2563eb'),
            ),
            'label': ParagraphStyle(
                'CarreraEtiqueta',
                parent=base['Normal'],
                fontName='Helvetica-Bold',
                fontSize=7.5,
                leading=10,
                textColor=colors.HexColor('#475569'),
                uppercase=True,
            ),
            'value': ParagraphStyle(
                'CarreraValor',
                parent=base['Normal'],
                fontName='Helvetica-Bold',
                fontSize=9,
                leading=12,
                textColor=colors.HexColor('#172033'),
            ),
            'section_title': ParagraphStyle(
                'CarreraSeccionTitulo',
                parent=base['Normal'],
                fontName='Helvetica-Bold',
                fontSize=9,
                leading=11,
                textColor=colors.HexColor('#1d4ed8'),
            ),
            'section_text': ParagraphStyle(
                'CarreraSeccionTexto',
                parent=base['Normal'],
                fontName='Helvetica',
                fontSize=9,
                leading=12,
                textColor=colors.HexColor('#1f2937'),
            ),
            'placeholder': ParagraphStyle(
                'CarreraPlaceholder',
                parent=base['Normal'],
                fontName='Helvetica-Bold',
                fontSize=9,
                leading=11,
                textColor=colors.HexColor('#64748b'),
                alignment=TA_CENTER,
            ),
            'footer': ParagraphStyle(
                'CarreraFooter',
                parent=base['Normal'],
                fontSize=7.5,
                leading=9,
                textColor=colors.HexColor('#64748b'),
                alignment=TA_CENTER,
            ),
        }

    @staticmethod
    def _section(title, text, styles):
        content = Paragraph(CarreraPDFGenerator._parrafo(text), styles['section_text'])
        table = Table(
            [[Paragraph(title.upper(), styles['section_title'])], [content]],
            colWidths=[8.0 * cm],
        )
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 1), (0, 1), colors.HexColor('#f8fafc')),
            ('BOX', (0, 1), (0, 1), 0.7, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING', (0, 0), (-1, -1), 8),
            ('RIGHTPADDING', (0, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        return table

    @staticmethod
    def generar_ficha(carrera):
        buffer = io.BytesIO()
        styles = CarreraPDFGenerator._styles()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=1.6 * cm,
            leftMargin=1.6 * cm,
            topMargin=1.5 * cm,
            bottomMargin=1.3 * cm,
            title=f"Ficha de carrera - {carrera.nombre}",
        )

        story = []
        story.append(Paragraph('FICHA DE CARRERA', styles['section_title']))
        story.append(Spacer(1, 0.25 * cm))

        header = Table(
            [[
                CarreraPDFGenerator._logo_element(carrera),
                [
                    Paragraph(escape(CarreraPDFGenerator._texto(carrera.nombre, 'Carrera sin nombre')), styles['title']),
                    Paragraph(escape(CarreraPDFGenerator._texto(carrera.codigo, 'Sin codigo')), styles['code']),
                ],
            ]],
            colWidths=[3.4 * cm, 12.3 * cm],
        )
        header.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#eff6ff')),
            ('BOX', (0, 0), (-1, -1), 0.8, colors.HexColor('#bfdbfe')),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('TOPPADDING', (0, 0), (-1, -1), 12),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
            ('LEFTPADDING', (0, 0), (-1, -1), 12),
            ('RIGHTPADDING', (0, 0), (-1, -1), 12),
        ]))
        story.append(header)
        story.append(Spacer(1, 0.45 * cm))

        meta = [
            [
                Paragraph('FACULTAD', styles['label']),
                Paragraph('RESPONSABLE', styles['label']),
                Paragraph('ACTUALIZADO', styles['label']),
            ],
            [
                Paragraph(escape(CarreraPDFGenerator._texto(carrera.facultad)), styles['value']),
                Paragraph(escape(CarreraPDFGenerator._texto(carrera.responsable)), styles['value']),
                Paragraph(CarreraPDFGenerator._fecha(carrera.fecha_actualizacion), styles['value']),
            ],
            [
                Paragraph('RESOLUCION', styles['label']),
                Paragraph('FECHA RESOLUCION', styles['label']),
                Paragraph('ESTADO', styles['label']),
            ],
            [
                Paragraph(escape(CarreraPDFGenerator._texto(carrera.resolucion_ministerial)), styles['value']),
                Paragraph(CarreraPDFGenerator._fecha(carrera.fecha_resolucion), styles['value']),
                Paragraph('Activa' if carrera.activo else 'Inactiva', styles['value']),
            ],
        ]
        meta_table = Table(meta, colWidths=[5.2 * cm, 5.2 * cm, 5.2 * cm])
        meta_table.setStyle(TableStyle([
            ('LINEBELOW', (0, 1), (-1, 1), 0.6, colors.HexColor('#cbd5e1')),
            ('LINEBELOW', (0, 3), (-1, 3), 0.6, colors.HexColor('#cbd5e1')),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
            ('LEFTPADDING', (0, 0), (-1, -1), 4),
            ('RIGHTPADDING', (0, 0), (-1, -1), 4),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(meta_table)
        story.append(Spacer(1, 0.4 * cm))

        sections = Table(
            [
                [
                    CarreraPDFGenerator._section('Mision', carrera.mision, styles),
                    CarreraPDFGenerator._section('Vision', carrera.vision, styles),
                ],
                [
                    CarreraPDFGenerator._section('Perfil profesional', carrera.perfil_profesional, styles),
                    CarreraPDFGenerator._section('Objetivo de carrera', carrera.objetivo_carrera, styles),
                ],
            ],
            colWidths=[8.0 * cm, 8.0 * cm],
        )
        sections.setStyle(TableStyle([
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(sections)
        story.append(Spacer(1, 0.4 * cm))
        story.append(Paragraph('Sistema Docentes UABJB', styles['footer']))

        doc.build(story)
        buffer.seek(0)
        return buffer
