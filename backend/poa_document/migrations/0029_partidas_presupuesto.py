from django.db import migrations, models
import django.db.models.deletion


NOMBRES_PARTIDA = {
    '22110': 'Pasajes Al Interior Del País',
    '22210': 'Viáticos Por Viajes Al Interior Del País',
    '32100': 'Papel',
    '39100': 'Material De Limpieza E Higiene',
    '39500': 'Útiles De Escritorio Y Oficina',
}


def clasificar_detalles_existentes(apps, schema_editor):
    alias = schema_editor.connection.alias
    DetallePresupuesto = apps.get_model('poa_document', 'DetallePresupuesto')
    PartidaPresupuesto = apps.get_model('poa_document', 'PartidaPresupuesto')
    grupos = {}

    for detalle in DetallePresupuesto.objects.using(alias).all().iterator():
        codigo = str(detalle.partida or '').strip()
        key = (detalle.actividad_id, codigo)
        partida = grupos.get(key)
        if partida is None:
            nombre = NOMBRES_PARTIDA.get(codigo, f'Partida {codigo}' if codigo else 'Sin partida')
            partida, _ = PartidaPresupuesto.objects.using(alias).get_or_create(
                actividad_id=detalle.actividad_id,
                codigo=codigo,
                defaults={'nombre': nombre},
            )
            grupos[key] = partida
        detalle.grupo_partida_id = partida.pk
        detalle.save(using=alias, update_fields=['grupo_partida'])


class Migration(migrations.Migration):

    dependencies = [
        ('poa_document', '0028_unidad_destino_presupuesto'),
    ]

    operations = [
        migrations.CreateModel(
            name='PartidaPresupuesto',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.CharField(blank=True, default='', max_length=50)),
                ('nombre', models.CharField(max_length=200)),
                ('actividad', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='partidas_presupuesto', to='poa_document.actividad')),
            ],
            options={
                'verbose_name': 'Partida de presupuesto',
                'verbose_name_plural': 'Partidas de presupuesto',
                'ordering': ['codigo', 'id'],
                'unique_together': {('actividad', 'codigo')},
            },
        ),
        migrations.AddField(
            model_name='detallepresupuesto',
            name='grupo_partida',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='items', to='poa_document.partidapresupuesto'),
        ),
        migrations.RunPython(clasificar_detalles_existentes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='detallepresupuesto',
            name='grupo_partida',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='items', to='poa_document.partidapresupuesto'),
        ),
    ]
