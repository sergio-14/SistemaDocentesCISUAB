from django.db import migrations, models


DEFAULT_FACULTADES = [
    'Facultad de Ingeniería y Tecnología',
    'Facultad de Ciencias y Tecnologia',
    'Facultad de Ciencias de la Salud',
    'Facultad de Ciencias Juridicas, Politicas y Sociales',
    'Facultad de Ciencias Economicas y Financieras',
    'Facultad de Humanidades y Ciencias de la Educacion',
    'Facultad de Ciencias Agropecuarias',
]


def seed_facultades(apps, schema_editor):
    FacultadCatalogo = apps.get_model('fondos', 'FacultadCatalogo')
    for nombre in DEFAULT_FACULTADES:
        FacultadCatalogo.objects.get_or_create(nombre=nombre)


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0055_merge_0032_0054'),
    ]

    operations = [
        # No-op: 0001_initial already handles this.
    ]
