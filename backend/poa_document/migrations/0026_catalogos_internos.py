from django.db import migrations, models


def remove_legacy_catalogos_content_types(apps, schema_editor):
    ContentType = apps.get_model('contenttypes', 'ContentType')
    ContentType.objects.using(schema_editor.connection.alias).filter(
        app_label='catalogos',
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('contenttypes', '0002_remove_content_type_name'),
        ('poa_document', '0025_remove_campos_formulacion_actividad'),
    ]

    operations = [
        migrations.CreateModel(
            name='IndicadorCatalogo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('indicador', models.CharField(db_index=True, max_length=500, unique=True)),
            ],
            options={
                'ordering': ['indicador'],
            },
        ),
        migrations.CreateModel(
            name='ItemCatalogo',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('detalle', models.CharField(default='', max_length=255)),
                ('unidad_medida', models.CharField(default='Sin unidad', max_length=50)),
                ('partida', models.CharField(db_index=True, max_length=50)),
            ],
            options={
                'indexes': [models.Index(fields=['partida'], name='poa_item_partida_idx')],
            },
        ),
        migrations.RunSQL(
            sql=[
                'DROP TABLE IF EXISTS catalogos_itemcatalogo;',
                'DROP TABLE IF EXISTS catalogos_indicadorcatalogo;',
            ],
            reverse_sql=migrations.RunSQL.noop,
        ),
        migrations.RunPython(
            remove_legacy_catalogos_content_types,
            migrations.RunPython.noop,
        ),
    ]
