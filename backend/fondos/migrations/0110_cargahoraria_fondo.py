import django.db.models.deletion
from django.db import migrations, models


def asignar_fondo_a_cargas(apps, schema_editor):
    """Cada carga va al fondo (no archivado) de su docente en su calendario."""
    CargaHoraria = apps.get_model('fondos', 'CargaHoraria')
    FondoTiempo = apps.get_model('fondos', 'FondoTiempo')
    for carga in CargaHoraria.objects.filter(fondo__isnull=True):
        fondo = FondoTiempo.objects.filter(
            docente_id=carga.docente_id,
            calendario_academico_id=carga.calendario_id,
            archivado=False,
        ).first()
        if fondo is None:
            raise RuntimeError(
                f'La carga horaria {carga.pk} no tiene Fondo de Tiempo del docente en su calendario.'
            )
        carga.fondo_id = fondo.pk
        carga.save(update_fields=['fondo'])


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0109_limpieza_fondo_tipo_asignatura_semanas'),
    ]

    operations = [
        migrations.AddField(
            model_name='cargahoraria',
            name='fondo',
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='cargas',
                to='fondos.fondotiempo',
            ),
        ),
        migrations.RunPython(asignar_fondo_a_cargas, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='cargahoraria',
            name='fondo',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='cargas',
                to='fondos.fondotiempo',
            ),
        ),
        migrations.RemoveConstraint(
            model_name='cargahoraria',
            name='cargahoraria_unique_tipo_no_academica',
        ),
        migrations.AddConstraint(
            model_name='cargahoraria',
            constraint=models.UniqueConstraint(
                condition=models.Q(('categoria', 'academica'), _negated=True),
                fields=('fondo', 'categoria', 'tipo_actividad'),
                name='cargahoraria_unique_tipo_no_academica_por_fondo',
            ),
        ),
    ]
