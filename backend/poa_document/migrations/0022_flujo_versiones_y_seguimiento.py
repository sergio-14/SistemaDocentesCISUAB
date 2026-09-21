from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def normalizar_estados_heredados(apps, schema_editor):
    Actividad = apps.get_model('poa_document', 'Actividad')
    Actividad.objects.filter(estado='en_proceso').update(estado='en_ejecucion')
    Actividad.objects.filter(estado='ejecutado').update(estado='completado')
    Actividad.objects.filter(estado='suspendido').update(estado='cancelado')


class Migration(migrations.Migration):
    dependencies = [('poa_document', '0021_formulacion_calidad_poa')]

    operations = [
        migrations.RunPython(normalizar_estados_heredados, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='actividad', name='estado',
            field=models.CharField(choices=[('programado', 'Programado'), ('en_ejecucion', 'En ejecución'), ('completado', 'Completado'), ('cancelado', 'Cancelado')], default='programado', max_length=20),
        ),
        migrations.DeleteModel(name='RevisionDocumentoPOA'),
        migrations.CreateModel(
            name='VersionDocumentoPOA',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('numero', models.PositiveIntegerField()), ('snapshot', models.JSONField(default=dict)),
                ('motivo', models.TextField()), ('creado_en', models.DateTimeField(auto_now_add=True)), ('vigente', models.BooleanField(default=True)),
                ('creado_por', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='versiones_poa_creadas', to=settings.AUTH_USER_MODEL)),
                ('documento', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='versiones', to='poa_document.documentopoa')),
            ],
            options={'ordering': ['-numero']},
        ),
        migrations.AddConstraint(model_name='versiondocumentopoa', constraint=models.UniqueConstraint(fields=('documento', 'numero'), name='poa_version_documento_numero_unico')),
        migrations.CreateModel(
            name='SeguimientoActividadPOA',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('estado_anterior', models.CharField(blank=True, default='', max_length=20)),
                ('estado_nuevo', models.CharField(choices=[('programado', 'Programado'), ('en_ejecucion', 'En ejecución'), ('completado', 'Completado'), ('cancelado', 'Cancelado')], max_length=20)),
                ('avance_porcentaje', models.PositiveSmallIntegerField(default=0)), ('nota', models.TextField(blank=True, default='')), ('registrado_en', models.DateTimeField(auto_now_add=True)),
                ('actividad', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='seguimientos', to='poa_document.actividad')),
                ('registrado_por', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='seguimientos_actividad_poa', to=settings.AUTH_USER_MODEL)),
            ], options={'ordering': ['-registrado_en']},
        ),
        migrations.AddIndex(model_name='seguimientoactividadpoa', index=models.Index(fields=['actividad', 'registrado_en'], name='poa_seg_act_fecha_idx')),
    ]
