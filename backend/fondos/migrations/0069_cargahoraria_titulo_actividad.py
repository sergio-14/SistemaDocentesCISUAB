from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0068_alter_calendarioacademico_carrera_required'),
    ]

    operations = [
        migrations.AddField(
            model_name='cargahoraria',
            name='titulo_actividad',
            field=models.CharField(
                blank=True,
                help_text='Descripcion de la actividad para cargas no academicas.',
                max_length=200,
            ),
        ),
    ]
