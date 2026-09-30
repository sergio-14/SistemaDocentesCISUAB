from django.db import migrations, models

UNIDADES_FONDO = [
    ('academica', 'Académica'),
    ('investigacion', 'Investigación'),
    ('extension_universitaria', 'Extensión universitaria'),
    ('interaccion_social', 'Interacción social'),
    ('gestion', 'Gestión'),
    ('academica_administrativa', 'Académica-administrativa'),
    ('social_cultural_deportiva', 'Social, cultural, deportiva y Otros'),
]


def copiar_unidad_de_proyectos(apps, schema_editor):
    """Proyecto.categoria pasa de FK a CategoriaFuncion a su tipo (texto)."""
    Proyecto = apps.get_model('fondos', 'Proyecto')
    for proyecto in Proyecto.objects.select_related('categoria'):
        proyecto.unidad = proyecto.categoria.tipo
        proyecto.save(update_fields=['unidad'])


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0113_unidades_suma_de_items'),
    ]

    operations = [
        migrations.AddField(
            model_name='proyecto',
            name='unidad',
            field=models.CharField(max_length=30, choices=UNIDADES_FONDO, default='investigacion'),
            preserve_default=False,
        ),
        migrations.RunPython(copiar_unidad_de_proyectos, migrations.RunPython.noop),
        migrations.RemoveField(model_name='proyecto', name='categoria'),
        migrations.RenameField(model_name='proyecto', old_name='unidad', new_name='categoria'),
        migrations.DeleteModel(name='Actividad'),
        migrations.DeleteModel(name='CategoriaFuncion'),
    ]
