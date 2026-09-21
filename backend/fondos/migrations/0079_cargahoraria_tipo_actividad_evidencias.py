from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0078_recalcular_horas_efectivas_dedicacion_contractual'),
    ]

    operations = [
        migrations.AddField(
            model_name='cargahoraria',
            name='tipo_actividad',
            field=models.CharField(
                blank=True,
                help_text='Sub-actividad especifica segun la categoria del Fondo de Tiempo.',
                max_length=80,
            ),
        ),
        migrations.AddField(
            model_name='cargahoraria',
            name='evidencias',
            field=models.TextField(
                blank=True,
                default='',
                help_text='Evidencias o respaldo descriptivo de la actividad.',
            ),
        ),
    ]
