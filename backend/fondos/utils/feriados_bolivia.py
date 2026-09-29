"""Feriados de una gestión para precargar (Bolivia, con los departamentales del Beni).

Se toman de la librería `holidays`. No incluye traslados ni feriados adicionales
por decreto: el superusuario los corrige en la pantalla de Feriados.
"""
import holidays

# Subdivisión del Beni en la librería (ISO 3166-2:BO-B).
SUBDIVISION_BENI = 'B'

# Nombres oficiales cuando la librería usa otro.
NOMBRES_OFICIALES = {
    'Año Nuevo Aymara Amazónico': 'Año Nuevo Andino Amazónico Chaqueño',
    'Día del departamento de Beni': 'Aniversario del Departamento del Beni',
}

# Ley 424: el Día de la Dignidad Nacional (17 de octubre) se conmemora sin
# suspensión de actividades, no es feriado.
NO_FERIADOS = {'Día de la Dignidad Nacional'}

SUFIJO_OBSERVADO = ' (observado)'


def _nombre_oficial(nombre):
    if nombre.endswith(SUFIJO_OBSERVADO):
        nombre = nombre[:-len(SUFIJO_OBSERVADO)]
    return NOMBRES_OFICIALES.get(nombre, nombre)


def feriados_precargables(gestion):
    """[(fecha, nombre, tipo)] de la gestión que caen de lunes a viernes, sin los que no son feriado."""
    beni = holidays.country_holidays('BO', subdiv=SUBDIVISION_BENI, years=gestion, language='es')
    nacionales = holidays.country_holidays('BO', years=gestion, language='es')

    feriados = []
    for fecha, nombres in sorted(beni.items()):
        if fecha.weekday() >= 5:
            continue
        validos = [n for n in nombres.split('; ') if _nombre_oficial(n) not in NO_FERIADOS]
        if not validos:
            continue
        tipo = 'nacional' if fecha in nacionales else 'departamental'
        feriados.append((fecha, _nombre_oficial(validos[0]), tipo))
    return feriados
