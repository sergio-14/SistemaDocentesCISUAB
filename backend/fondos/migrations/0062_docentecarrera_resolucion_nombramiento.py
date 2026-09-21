from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0061_docente_user_relacion'),
    ]

    operations = [
        migrations.AddField(
            model_name='docentecarrera',
            name='resolucion_nombramiento',
            field=models.CharField(
                default='',
                help_text='Resolución de nombramiento del docente para esta carrera',
                max_length=255,
            ),
        ),
    ]
