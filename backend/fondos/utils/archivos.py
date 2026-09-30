"""Comprobaciones de archivos subidos."""


def es_pdf(archivo):
    """Extensión .pdf y cabecera %PDF (no basta con el nombre)."""
    if not str(getattr(archivo, 'name', '')).lower().endswith('.pdf'):
        return False
    posicion = archivo.tell() if hasattr(archivo, 'tell') else 0
    cabecera = archivo.read(5)
    archivo.seek(posicion)
    return cabecera.startswith(b'%PDF')
