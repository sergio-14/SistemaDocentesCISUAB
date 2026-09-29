import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0106_feriado_y_sin_horas_feriados_gestion'),
    ]

    operations = [
        migrations.DeleteModel(
            name='HistoricalFeriado',
        ),
        migrations.DeleteModel(
            name='Feriado',
        ),
        # Campo obligatorio: el 0 solo rellena los calendarios que ya existían.
        migrations.AddField(
            model_name='calendarioacademico',
            name='dias_feriados_gestion',
            field=models.PositiveIntegerField(
                default=0,
                help_text='Feriados de la gestión que caen de lunes a viernes.',
                validators=[django.core.validators.MaxValueValidator(30)],
                verbose_name='Días de feriado de la gestión',
            ),
            preserve_default=False,
        ),
    ]
