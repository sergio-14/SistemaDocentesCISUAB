"""Asocia cada carrera con su facultad del catálogo.

Carrera.facultad era texto libre. Aquí se busca la facultad equivalente en
FacultadCatalogo comparando sin mayúsculas, sin acentos y sin espacios de más.
Si alguna carrera no tiene equivalente, la migración se detiene y lista cuáles
fallan: no se crea ni se adivina ninguna facultad.

El historial (HistoricalCarrera) se asocia cuando hay equivalente y, si no, queda
vacío: son registros viejos y no deben bloquear la migración.
"""
import unicodedata

from django.db import migrations


def _normalizar(texto):
    texto = (texto or '').strip().lower()
    texto = unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode('ascii')
    return ' '.join(texto.split())


def _indice_catalogo(FacultadCatalogo):
    indice = {}
    for facultad in FacultadCatalogo.objects.all():
        indice.setdefault(_normalizar(facultad.nombre), []).append(facultad)
    return indice


def asociar_facultades(apps, schema_editor):
    Carrera = apps.get_model('fondos', 'Carrera')
    HistoricalCarrera = apps.get_model('fondos', 'HistoricalCarrera')
    FacultadCatalogo = apps.get_model('fondos', 'FacultadCatalogo')

    indice = _indice_catalogo(FacultadCatalogo)

    fallas = []
    for carrera in Carrera.objects.all().order_by('id'):
        candidatas = indice.get(_normalizar(carrera.facultad), [])
        if len(candidatas) == 1:
            carrera.facultad_ref_id = candidatas[0].pk
            carrera.save(update_fields=['facultad_ref'])
        elif not candidatas:
            fallas.append(f'  - Carrera id={carrera.pk} "{carrera.nombre}": facultad "{carrera.facultad}" no existe en el catálogo')
        else:
            nombres = ', '.join(f'"{f.nombre}"' for f in candidatas)
            fallas.append(f'  - Carrera id={carrera.pk} "{carrera.nombre}": facultad "{carrera.facultad}" coincide con varias ({nombres})')

    if fallas:
        raise RuntimeError(
            'No se pudo asociar la facultad de estas carreras con el catálogo de facultades.\n'
            + '\n'.join(fallas)
            + '\nAgrega la facultad al catálogo (o corrige el texto de la carrera) y vuelve a ejecutar migrate.'
        )

    for registro in HistoricalCarrera.objects.all().iterator():
        candidatas = indice.get(_normalizar(registro.facultad), [])
        if len(candidatas) == 1:
            HistoricalCarrera.objects.filter(pk=registro.pk).update(facultad_ref_id=candidatas[0].pk)


def restaurar_texto(apps, schema_editor):
    Carrera = apps.get_model('fondos', 'Carrera')
    HistoricalCarrera = apps.get_model('fondos', 'HistoricalCarrera')
    FacultadCatalogo = apps.get_model('fondos', 'FacultadCatalogo')

    nombres = dict(FacultadCatalogo.objects.values_list('pk', 'nombre'))
    for modelo in (Carrera, HistoricalCarrera):
        for registro in modelo.objects.exclude(facultad_ref__isnull=True).iterator():
            modelo.objects.filter(pk=registro.pk).update(facultad=nombres.get(registro.facultad_ref_id, ''))


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0092_carrera_facultad_ref'),
    ]

    operations = [
        migrations.RunPython(asociar_facultades, restaurar_texto),
    ]
