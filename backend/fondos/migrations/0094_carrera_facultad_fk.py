"""Reemplaza el texto Carrera.facultad por la relación con FacultadCatalogo.

La columna nueva ya se llenó en 0093; aquí se borra el texto viejo y la
relación pasa a llamarse `facultad` y a ser obligatoria.
"""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0093_carrera_facultad_datos'),
    ]

    operations = [
        # Con default, revertir esta migración puede volver a crear la columna de
        # texto aunque ya haya filas (0093 la rellena después).
        migrations.AlterField(model_name='carrera', name='facultad', field=models.CharField(max_length=200, default='')),
        migrations.AlterField(model_name='historicalcarrera', name='facultad', field=models.CharField(max_length=200, default='')),
        migrations.RemoveField(model_name='carrera', name='facultad'),
        migrations.RemoveField(model_name='historicalcarrera', name='facultad'),
        migrations.RenameField(model_name='carrera', old_name='facultad_ref', new_name='facultad'),
        migrations.RenameField(model_name='historicalcarrera', old_name='facultad_ref', new_name='facultad'),
        migrations.AlterField(
            model_name='carrera',
            name='facultad',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='carreras', to='fondos.facultadcatalogo'),
        ),
        migrations.AlterField(
            model_name='historicalcarrera',
            name='facultad',
            field=models.ForeignKey(blank=True, db_constraint=False, null=True, on_delete=django.db.models.deletion.DO_NOTHING, related_name='+', to='fondos.facultadcatalogo'),
        ),
        migrations.AlterModelOptions(
            name='carrera',
            options={'ordering': ['facultad__nombre', 'nombre'], 'verbose_name': 'Carrera', 'verbose_name_plural': 'Carreras'},
        ),
    ]
