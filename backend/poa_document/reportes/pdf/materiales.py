from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import LongTable, Paragraph, SimpleDocTemplate, Spacer

from .estilos import crear_estilos_reporte, estilo_tabla_base, parrafo


def generar_informe_materiales_pdf(datos, gestion):
    estilos = crear_estilos_reporte('poa-materiales')
    estilos['header'] = ParagraphStyle(
        'poa-materiales-header', parent=estilos['cell_bold'],
        textColor=colors.white, alignment=1,
    )
    elementos = [
        Paragraph(f'Seguimiento de abastecimiento de materiales POA · Gestión {gestion}', estilos['title']),
        Spacer(1, 6),
        Paragraph('Control de compras por proveedor, recepciones físicas, existencias y distribución a actividades.', estilos['subtitle']),
        Spacer(1, 8),
    ]
    resumen = [[Paragraph('<b>Indicador</b>', estilos['header']), Paragraph('<b>Resultado</b>', estilos['header'])]]
    resumen.extend([parrafo(nombre, estilos['cell']), parrafo(valor, estilos['cell'])] for nombre, valor in datos['resumen'])
    tabla_resumen = LongTable(resumen, colWidths=[330, 300], repeatRows=1)
    tabla_resumen.setStyle(estilo_tabla_base([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#17365d')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f1f5f9')),
    ]))
    elementos.extend([tabla_resumen, Spacer(1, 12)])

    secciones = [
        ('Compras por proveedor', 'compras', ['Proveedor / compra', 'Fecha', 'Material', 'Actividades solicitantes', 'Plan.', 'Comprado', 'Recibido', 'Saldo', 'Costo unit.', 'Total'], [90, 45, 120, 140, 36, 40, 40, 36, 55, 60], lambda fila: [f'{fila[1]} · {fila[0]}', fila[2], f"{fila[5]} ({fila[4]})", fila[14], fila[7], fila[8], fila[9], fila[10], f"Bs. {fila[11]:,.2f}", f"Bs. {fila[12]:,.2f}"]),
        ('Recepciones', 'recepciones', ['Compra / proveedor', 'Acta', 'Fecha', 'Estado', 'Material', 'Cantidad', 'Costo unit.', 'Total'], [100, 60, 50, 55, 155, 55, 65, 70], lambda fila: [f'{fila[1]} · {fila[0]}', fila[2], fila[3], fila[4], f'{fila[6]} ({fila[5]})', fila[8], f"Bs. {fila[9]:,.2f}", f"Bs. {fila[10]:,.2f}"]),
        ('Existencias por recepción', 'stock', ['Material', 'Proveedor / compra', 'Fecha', 'Recibido', 'Entregado', 'Disponible', 'Costo unit.', 'Valor stock', 'Estado'], [112, 125, 48, 48, 48, 52, 60, 65, 55], lambda fila: [f'{fila[1]} ({fila[0]})', f'{fila[3]} · {fila[4]}', fila[5], fila[6], fila[7], fila[8], f"Bs. {fila[9]:,.2f}", f"Bs. {fila[10]:,.2f}", fila[11]]),
        ('Entregas a actividades', 'entregas', ['Fecha', 'Compra', 'Material', 'Actividad', 'Cantidad', 'Receptor', 'Estado', 'Documento'], [52, 90, 105, 145, 50, 90, 55, 75], lambda fila: [fila[0], f'{fila[2]} · {fila[1]}', fila[4], fila[5], fila[7], fila[8], fila[11], fila[9]]),
    ]
    for titulo, clave, encabezados, anchos, proyectar in secciones:
        elementos.append(Paragraph(titulo, estilos['subtitle']))
        elementos.append(Spacer(1, 4))
        tabla = [[Paragraph(f'<b>{texto}</b>', estilos['header']) for texto in encabezados]]
        tabla.extend([[parrafo(valor, estilos['cell']) for valor in proyectar(fila)] for fila in datos[clave]])
        if len(tabla) == 1:
            tabla.append([parrafo('Sin registros para esta gestión.', estilos['cell'])] + [''] * (len(encabezados) - 1))
            tabla[-1][0] = Paragraph('Sin registros para esta gestión.', estilos['cell'])
        tabla_pdf = LongTable(tabla, colWidths=anchos, repeatRows=1)
        tabla_pdf.setStyle(estilo_tabla_base([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#17365d')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('ALIGN', (3, 1), (-1, -1), 'RIGHT'),
        ]))
        elementos.extend([tabla_pdf, Spacer(1, 10)])

    buffer = BytesIO()
    documento = SimpleDocTemplate(buffer, pagesize=landscape(letter), leftMargin=18, rightMargin=18, topMargin=20, bottomMargin=20)
    documento.build(elementos)
    buffer.seek(0)
    return buffer
