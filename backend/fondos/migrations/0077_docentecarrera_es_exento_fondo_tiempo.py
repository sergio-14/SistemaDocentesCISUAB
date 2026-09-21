from django.db import migrations, models


def normalizar_dedicacion_exentos_existentes(apps, schema_editor):
    DocenteCarrera = apps.get_model('fondos', 'DocenteCarrera')
    Docente = apps.get_model('fondos', 'Docente')
    PerfilUsuario = apps.get_model('fondos', 'PerfilUsuario')
    AsignacionCarrera = apps.get_model('fondos', 'AsignacionCarrera')

    for vinculo in DocenteCarrera.objects.all():
        user_ids = set()

        docente = Docente.objects.filter(pk=vinculo.docente_id).first()
        if docente and docente.user_id:
            user_ids.add(docente.user_id)

        user_ids.update(
            PerfilUsuario.objects.filter(
                docente_id=vinculo.docente_id,
                user__isnull=False,
                activo=True,
            ).values_list('user_id', flat=True)
        )

        roles = set()
        if user_ids:
            roles.update(
                AsignacionCarrera.objects.filter(
                    user_id__in=user_ids,
                    activo=True,
                ).values_list('rol', flat=True)
            )
            roles.update(
                PerfilUsuario.objects.filter(
                    user_id__in=user_ids,
                    activo=True,
                ).values_list('rol', flat=True)
            )

        tiene_docencia = 'docente' in roles
        solo_director = 'director' in roles and not tiene_docencia and 'jefe_estudios' not in roles and 'iiisyp' not in roles
        solo_jefe_o_instituto = not tiene_docencia and 'director' not in roles and bool(roles & {'jefe_estudios', 'iiisyp'})

        if solo_director:
            vinculo.dedicacion = 'dedicacion_exclusiva'
            vinculo.es_exento_fondo_tiempo = True
        elif solo_jefe_o_instituto:
            vinculo.dedicacion = 'tiempo_completo'
            vinculo.es_exento_fondo_tiempo = False
        elif tiene_docencia and vinculo.dedicacion == 'dedicacion_exclusiva':
            vinculo.dedicacion = 'horario_40'
            vinculo.es_exento_fondo_tiempo = False
        else:
            vinculo.es_exento_fondo_tiempo = vinculo.dedicacion == 'dedicacion_exclusiva'

        vinculo.save(update_fields=['dedicacion', 'es_exento_fondo_tiempo'])


class Migration(migrations.Migration):

    dependencies = [
        ('fondos', '0076_recalcular_horas_gestion_tc'),
    ]

    operations = [
        migrations.AddField(
            model_name='docentecarrera',
            name='es_exento_fondo_tiempo',
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(normalizar_dedicacion_exentos_existentes, migrations.RunPython.noop),
    ]
