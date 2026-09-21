from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import landscape, letter
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table

from .estilos import crear_estilos_reporte, estilo_tabla_base, parrafo


def generar_seguimiento_institucional_pdf(filas, gestion):
    estilos = crear_estilos_reporte('poa-seguimiento')
    data = [[
        Paragraph('<b>Programa</b>', estilos['cell_bold']),
        Paragraph('<b>Actividad</b>', estilos['cell_bold']),
        Paragraph('<b>Estado</b>', estilos['cell_bold']),
        Paragraph('<b>% físico</b>', estilos['cell_bold']),
        Paragraph('<b>Presupuesto</b>', estilos['cell_bold']),
        Paragraph('<b>Resultados</b>', estilos['cell_bold']),
    ]]
    for fila in filas:
        data.append([
            parrafo(fila[0], estilos['cell']),
            parrafo(f'{fila[1]} - {fila[2]}', estilos['cell']),
            parrafo(fila[6], estilos['cell']),
            parrafo(f'{fila[7]:.2f}%', estilos['cell']),
            parrafo(fila[8], estilos['cell']),
            parrafo(fila[9], estilos['cell']),
        ])

    buffer = BytesIO()
    documento = SimpleDocTemplate(
        buffer, pagesize=landscape(letter),
        leftMargin=18, rightMargin=18, topMargin=18, bottomMargin=18,
    )
    tabla = Table(data, colWidths=[90, 170, 70, 60, 85, 220], repeatRows=1)
    tabla.setStyle(estilo_tabla_base([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1d4ed8')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('ALIGN', (3, 1), (4, -1), 'RIGHT'),
    ]))
    documento.build([
        Paragraph(f'Informe de Seguimiento y Evaluación POA - Gestión {gestion}', estilos['title']),
        Spacer(1, 8),
        Paragraph(
            'Ejecución física, financiera y resultados reportados por las actividades de la carrera.',
            estilos['subtitle'],
        ),
        Spacer(1, 8),
        tabla,
    ])
    buffer.seek(0)
    return buffer
