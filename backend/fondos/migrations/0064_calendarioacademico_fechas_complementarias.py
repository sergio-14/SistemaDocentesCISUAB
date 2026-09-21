from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0063_remove_docentecarrera_resolucion_nombramiento'),
    ]

    operations = [
        migrations.AddField(
            model_name='calendarioacademico',
            name='fecha_limite_programas_analiticos',
            field=models.DateField(blank=True, help_text='Fecha limite para presentar programas analiticos', null=True),
        ),
        migrations.AddField(
            model_name='calendarioacademico',
            name='fecha_inicio_receso',
            field=models.DateField(blank=True, help_text='Inicio del receso academico', null=True),
        ),
        migrations.AddField(
            model_name='calendarioacademico',
            name='fecha_fin_receso',
            field=models.DateField(blank=True, help_text='Fin del receso academico', null=True),
        ),
    ]
