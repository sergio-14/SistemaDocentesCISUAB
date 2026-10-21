from django.db import migrations, models
import django.db.models.deletion


def crear_unidad_inicial(apps, schema_editor):
    UnidadDestinoPresupuesto = apps.get_model('poa_document', 'UnidadDestinoPresupuesto')
    UnidadDestinoPresupuesto.objects.using(schema_editor.connection.alias).get_or_create(
        nombre='Vicerrectorado de Pregrado'
    )


class Migration(migrations.Migration):

    dependencies = [
        ('poa_document', '0027_alter_evidenciaarchivo_archivo'),
    ]

    operations = [
        migrations.CreateModel(
            name='UnidadDestinoPresupuesto',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('nombre', models.CharField(max_length=150, unique=True)),
            ],
            options={
                'verbose_name': 'Unidad destino del presupuesto',
                'verbose_name_plural': 'Unidades destino del presupuesto',
                'ordering': ['nombre', 'id'],
            },
        ),
        migrations.RunPython(crear_unidad_inicial, migrations.RunPython.noop),
        migrations.AddField(
            model_name='actividad',
            name='unidad_destino_presupuesto',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='actividades',
                to='poa_document.unidaddestinopresupuesto',
                verbose_name='Unidad destino del presupuesto',
            ),
        ),
    ]
