from django.db import migrations


FACULTADES_OFICIALES = [
    'Facultad de Ciencias Pecuarias',
    'Facultad de Ciencias de la Salud',
    'Facultad de Ciencias Económicas',
    'Facultad de Humanidades y Ciencias de la Educación',
    'Facultad de Ciencias Jurídicas, Políticas y Sociales',
    'Facultad de Ingeniería y Tecnología',
    'Facultad de Ciencias Agrícolas',
    'Facultad de Ciencias Forestales',
]


def seed_facultades_oficiales(apps, schema_editor):
    FacultadCatalogo = apps.get_model('fondos', 'FacultadCatalogo')
    for nombre in FACULTADES_OFICIALES:
        FacultadCatalogo.objects.get_or_create(nombre=nombre)


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0071_mensajeobservacion_responde_a'),
    ]

    operations = [
        migrations.RunPython(seed_facultades_oficiales, migrations.RunPython.noop),
    ]
