"""Ayudas para preparar datos en las pruebas."""
from django.db.models import QuerySet


def forzar_campos(queryset, **campos):
    """Escribe directo en la base, sin el flujo ni HistorialFondo, para dejar un fondo en
    un estado de partida. FondoTiempoQuerySet.update() no acepta estado ni archivado:
    esto lo hace a propósito y solo en pruebas."""
    return QuerySet.update(queryset, **campos)
