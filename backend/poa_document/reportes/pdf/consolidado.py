from decimal import Decimal
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table

from .estilos import crear_estilos_reporte, estilo_tabla_base, parrafo


def generar_consolidado_requerimientos_pdf(items, gestion, total=None):
    items = list(items or [])
    total = Decimal(total if total is not None else sum(
        (Decimal(item['monto_estimado_total']) for item in items),
        Decimal('0'),
    ))
    estilos = crear_estilos_reporte('poa-consolidado')
    filas = [[
        Paragraph('<b>Partida</b>', estilos['cell_bold']),
        Paragraph('<b>Ítem</b>', estilos['cell_bold']),
        Paragraph('<b>Unidad</b>', estilos['cell_bold']),
        Paragraph('<b>Cantidad</b>', estilos['cell_bold']),
        Paragraph('<b>Costo estimado</b>', estilos['cell_bold']),
    ]]
    for item in items:
        filas.append([
            parrafo(item['partida'], estilos['cell']),
            parrafo(item['item'], estilos['cell']),
            parrafo(item['unidad_medida'], estilos['cell']),
            parrafo(item['cantidad_total'], estilos['cell']),
            parrafo(f"{Decimal(item['monto_estimado_total']):,.2f}", estilos['cell']),
        ])
    filas.append([
        '', Paragraph('<b>TOTAL</b>', estilos['cell_bold']), '', '',
        Paragraph(f'<b>{total:,.2f}</b>', estilos['cell_bold']),
    ])

    buffer = BytesIO()
    documento = SimpleDocTemplate(
        buffer, pagesize=landscape(letter),
        leftMargin=18, rightMargin=18, topMargin=18, bottomMargin=18,
    )
    tabla = Table(filas, colWidths=[75, 285, 70, 75, 95], repeatRows=1)
    tabla.setStyle(estilo_tabla_base([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#dbeafe')),
        ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
        ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f8fafc')),
    ]))
    documento.build([
        Paragraph(f'Consolidado de requerimientos para compra - Gestión {gestion}', estilos['title']),
        Spacer(1, 10),
        tabla,
    ])
    buffer.seek(0)
    return buffer
