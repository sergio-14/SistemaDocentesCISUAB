from openpyxl import Workbook

from .estilos import finalizar_tabla, guardar_en_buffer


def generar_catalogo_items_excel(items):
    libro = Workbook()
    hoja = libro.active
    hoja.title = 'CatalogoItems'
    hoja.append(['DETALLE', 'partida', 'UNIDAD_MEDIDA'])
    for item in items:
        hoja.append([
            str(item.detalle or ''),
            str(item.partida or ''),
            str(item.unidad_medida or ''),
        ])
    finalizar_tabla(hoja)
    hoja.row_dimensions[1].height = 24
    return guardar_en_buffer(libro)
