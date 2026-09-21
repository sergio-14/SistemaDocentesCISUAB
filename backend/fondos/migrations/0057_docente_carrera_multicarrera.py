# Migración de transición: Docente multi-carrera
# Crea DocenteCarrera, migra datos de Docente → DocenteCarrera,
# y elimina carrera/categoria/dedicacion/horas_contrato_semanales de Docente.

from django.db import migrations, models
import django.db.models.deletion


def crear_docente_carrera_vinculos(apps, schema_editor):
    Docente = apps.get_model('fondos', 'Docente')
    DocenteCarrera = apps.get_model('fondos', 'DocenteCarrera')

    creados = 0
    for d in Docente.objects.all():
        if not getattr(d, 'carrera_id', None):
            continue
        DocenteCarrera.objects.get_or_create(
            docente_id=d.id,
            carrera_id=d.carrera_id,
            defaults={
                'categoria': d.categoria or 'asistente',
                'dedicacion': d.dedicacion or 'horario_40',
                'activo': bool(getattr(d, 'activo', True)),
            },
        )
        creados += 1
    print(f"\n  DocenteCarrera: {creados} docentes migrados.\n")


def revertir_docente_carrera_vinculos(apps, schema_editor):
    DocenteCarrera = apps.get_model('fondos', 'DocenteCarrera')
    DocenteCarrera.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0056_facultadcatalogo_and_dynamic_carrera_facultad'),
    ]

    operations = [
        # 1. Crear DocenteCarrera
        migrations.CreateModel(
            name='DocenteCarrera',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('categoria', models.CharField(choices=[('catedratico', 'Catedrático'), ('adjunto', 'Adjunto'), ('asistente', 'Asistente')], max_length=20)),
                ('dedicacion', models.CharField(choices=[('tiempo_completo', 'Tiempo Completo'), ('medio_tiempo', 'Medio Tiempo'), ('horario_16', 'Horario 16hrs/mes'), ('horario_24', 'Horario 24hrs/mes'), ('horario_40', 'Horario 40hrs/mes'), ('horario_48', 'Horario 48hrs/mes')], max_length=20)),
                ('activo', models.BooleanField(default=True)),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
                ('fecha_modificacion', models.DateTimeField(auto_now=True)),
                ('carrera', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='docentes_carrera', to='fondos.carrera')),
                ('docente', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='vinculos_carrera', to='fondos.docente')),
            ],
            options={
                'verbose_name': 'Vínculo Docente-Carrera',
                'verbose_name_plural': 'Vínculos Docente-Carrera',
                'ordering': ['carrera__nombre', 'docente__apellido_paterno'],
                'unique_together': {('docente', 'carrera')},
            },
        ),

        # 2. Migrar datos
        migrations.RunPython(crear_docente_carrera_vinculos, revertir_docente_carrera_vinculos),

        # 3. Eliminar campos legacy de Docente
        migrations.RemoveField(model_name='docente', name='carrera'),
        migrations.RemoveField(model_name='docente', name='categoria'),
        migrations.RemoveField(model_name='docente', name='dedicacion'),
        migrations.RemoveField(model_name='docente', name='horas_contrato_semanales'),
    ]
