from django.db import migrations


def recalcular_fondos_tiempo(apps, schema_editor):
    # Usa el modelo actual (no el histórico) para recalcular con la lógica de save().
    # En una base nueva no hay fondos, y el modelo actual puede tener columnas que
    # todavía no existen en este punto de la historia: salir antes de consultarlo.
    if not apps.get_model('fondos', 'FondoTiempo').objects.exists():
        return

    from fondos.models import FondoTiempo

    for fondo in FondoTiempo.objects.select_related('docente', 'carrera').all():
        fondo.save()


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0077_docentecarrera_es_exento_fondo_tiempo'),
    ]

    operations = [
        migrations.RunPython(recalcular_fondos_tiempo, migrations.RunPython.noop),
    ]
