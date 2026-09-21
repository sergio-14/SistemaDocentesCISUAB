from django.db import migrations


def recalcular_fondos_tiempo(apps, schema_editor):
    from fondos.models import FondoTiempo

    for fondo in FondoTiempo.objects.select_related('docente', 'carrera').all():
        fondo.save()


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0075_alter_docentecarrera_dedicacion'),
    ]

    operations = [
        migrations.RunPython(recalcular_fondos_tiempo, migrations.RunPython.noop),
    ]
