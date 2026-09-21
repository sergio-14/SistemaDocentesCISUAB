from django.db import migrations, models
import django.db.models.deletion


def forwards(apps, schema_editor):
    Docente = apps.get_model('fondos', 'Docente')
    PerfilUsuario = apps.get_model('fondos', 'PerfilUsuario')

    docentes_sin_carrera = []

    for docente in Docente.objects.all().iterator():
        if getattr(docente, 'carrera_id', None):
            continue

        perfil = (
            PerfilUsuario.objects.filter(docente_id=docente.id, carrera__isnull=False)
            .order_by('id')
            .first()
        )

        if perfil and perfil.carrera_id:
            docente.carrera_id = perfil.carrera_id
            docente.save(update_fields=['carrera'])
        else:
            docentes_sin_carrera.append(f'{docente.id}: {docente}')

    if docentes_sin_carrera:
        raise RuntimeError(
            'No se pudo completar la migración porque existen docentes sin carrera asociada: '
            + '; '.join(docentes_sin_carrera)
        )


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0053_backfill_asignacioncarrera_from_perfil'),
    ]

    operations = [
        migrations.AddField(
            model_name='docente',
            name='carrera',
            field=models.ForeignKey(null=True, blank=True, on_delete=django.db.models.deletion.PROTECT, related_name='docentes', to='fondos.carrera'),
        ),
        migrations.RunPython(forwards, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='docente',
            name='carrera',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='docentes', to='fondos.carrera'),
        ),
    ]