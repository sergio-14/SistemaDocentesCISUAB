# Generated migration for DatosLaborales model
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


def crear_datos_laborales_para_docentes_existentes(apps, schema_editor):
    """
    Data migration: crea registros DatosLaborales para cada Docente existente.
    Mueve los campos fecha_ingreso, dias_vacacion, horas_feriados_gestion, ci
    desde Docente hacia el nuevo modelo DatosLaborales.
    """
    Docente = apps.get_model('fondos', 'Docente')
    DatosLaborales = apps.get_model('fondos', 'DatosLaborales')

    docentes = Docente.objects.all()
    for docente in docentes:
        # Obtener valores de los campos legacy (si existen en el modelo anterior)
        ci = getattr(docente, 'ci', '') or f"LEGACY_{docente.pk}"
        fecha_ingreso = getattr(docente, 'fecha_ingreso', None)
        dias_vacacion = getattr(docente, 'dias_vacacion', 15)
        horas_feriados = getattr(docente, 'horas_feriados_gestion', 128)

        if fecha_ingreso is None:
            fecha_ingreso = timezone.now().date()

        # Evitar duplicados de CI
        try:
            datos_laborales = DatosLaborales.objects.get(ci=ci)
        except DatosLaborales.DoesNotExist:
            datos_laborales = DatosLaborales.objects.create(
                ci=ci,
                fecha_ingreso=fecha_ingreso,
                dias_vacacion=dias_vacacion,
                horas_feriados_gestion=horas_feriados,
            )

        # Vincular el Docente al nuevo DatosLaborales
        Docente.objects.filter(pk=docente.pk).update(datos_laborales=datos_laborales)

    print(f"  ✓ DatosLaborales creados para {docentes.count()} docentes")


def poblar_datos_laborales_en_perfiles_administrativos(apps, schema_editor):
    """
    Para perfiles administrativos puros (Director, Jefe, IIISYP) que NO tienen
    docente vinculado, crear DatosLaborales desde su CI en PerfilUsuario.
    """
    PerfilUsuario = apps.get_model('fondos', 'PerfilUsuario')
    DatosLaborales = apps.get_model('fondos', 'DatosLaborales')
    Docente = apps.get_model('fondos', 'Docente')

    perfiles_sin_docente = PerfilUsuario.objects.filter(
        docente__isnull=True,
        ci__isnull=False,
    ).exclude(ci='')

    for perfil in perfiles_sin_docente:
        ci = perfil.ci.strip()
        if not ci:
            continue

        # Intentar reutilizar DatosLaborales existente
        datos, created = DatosLaborales.objects.get_or_create(
            ci=ci,
            defaults={
                'fecha_ingreso': timezone.now().date(),
                'dias_vacacion': 15,
                'horas_feriados_gestion': 128,
            }
        )

        perfil.datos_laborales = datos
        perfil.save(update_fields=['datos_laborales'])

    print(f"  ✓ DatosLaborales asignados a {perfiles_sin_docente.count()} perfiles administrativos")


class Migration(migrations.Migration):

    initial = False

    dependencies = [
        ('fondos', '0059_rename_admin_to_iiisyp'),
    ]

    operations = [
        # 1. Crear el modelo DatosLaborales
        migrations.CreateModel(
            name='DatosLaborales',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ci', models.CharField(max_length=20, unique=True, verbose_name='Cédula de Identidad')),
                ('fecha_ingreso', models.DateField(default=django.utils.timezone.now, help_text='Fecha de ingreso a la institución para cálculo de antigüedad')),
                ('dias_vacacion', models.IntegerField(default=15, help_text='Días de vacación correspondientes según antigüedad')),
                ('horas_feriados_gestion', models.IntegerField(default=128, help_text='Total de horas de feriados en la gestión académica')),
                ('fecha_creacion', models.DateTimeField(auto_now_add=True)),
                ('fecha_modificacion', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Datos Laborales',
                'verbose_name_plural': 'Datos Laborales',
                'ordering': ['-fecha_creacion'],
            },
        ),

        # 2. Agregar campo datos_laborales en Docente (nullable inicialmente)
        migrations.AddField(
            model_name='docente',
            name='datos_laborales',
            field=models.OneToOneField(
                blank=True,
                null=True,
                help_text='Datos de empleo compartidos (CI, vacaciones, feriados, antigüedad)',
                on_delete=django.db.models.deletion.CASCADE,
                related_name='docente',
                to='fondos.datoslaborales',
            ),
        ),

        # 3. Ejecutar data migration para mover datos de Docente a DatosLaborales
        migrations.RunPython(
            crear_datos_laborales_para_docentes_existentes,
            reverse_code=migrations.RunPython.noop,
        ),

        # 4. Hacer datos_laborales obligatorio en Docente después de la migración
        migrations.AlterField(
            model_name='docente',
            name='datos_laborales',
            field=models.OneToOneField(
                help_text='Datos de empleo compartidos (CI, vacaciones, feriados, antigüedad)',
                on_delete=django.db.models.deletion.CASCADE,
                related_name='docente',
                to='fondos.datoslaborales',
            ),
        ),

        # 5. Eliminar campos redundantes de Docente (ahora son properties)
        migrations.RemoveField(
            model_name='docente',
            name='ci',
        ),
        migrations.RemoveField(
            model_name='docente',
            name='fecha_ingreso',
        ),
        migrations.RemoveField(
            model_name='docente',
            name='dias_vacacion',
        ),
        migrations.RemoveField(
            model_name='docente',
            name='horas_feriados_gestion',
        ),

        # 6. Agregar datos_laborales en PerfilUsuario
        migrations.AddField(
            model_name='perfilusuario',
            name='datos_laborales',
            field=models.ForeignKey(
                blank=True,
                help_text='Datos de empleo para usuarios administrativos. Si es null y tiene docente, se usan los del docente.',
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='perfiles',
                to='fondos.datoslaborales',
            ),
        ),

        # 7. Poblar datos_laborales en perfiles administrativos sin docente
        migrations.RunPython(
            poblar_datos_laborales_en_perfiles_administrativos,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
