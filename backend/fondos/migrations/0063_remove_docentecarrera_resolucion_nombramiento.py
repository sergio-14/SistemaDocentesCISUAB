# Generated migration to remove resolucion_nombramiento field

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0062_docentecarrera_resolucion_nombramiento'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='docentecarrera',
            name='resolucion_nombramiento',
        ),
    ]
