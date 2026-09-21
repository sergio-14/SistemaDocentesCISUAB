# -*- coding: utf-8 -*-
from django.db import migrations


def split_integer_hours(total, count):
    base = int(total) // count
    remainder = int(total) % count
    return [base + (1 if index < remainder else 0) for index in range(count)]


def forwards(apps, schema_editor):
    CargaHoraria = apps.get_model("fondos", "CargaHoraria")

    subactividades = CargaHoraria.objects.filter(
        categoria="academica",
        materia__isnull=True,
    ).exclude(tipo_actividad="clases_aula").order_by("docente_id", "calendario_id", "id")

    for subactividad in subactividades.iterator():
        materias_aula = list(
            CargaHoraria.objects.filter(
                docente_id=subactividad.docente_id,
                calendario_id=subactividad.calendario_id,
                categoria="academica",
                tipo_actividad="clases_aula",
                materia__isnull=False,
            ).order_by("id")
        )

        if not materias_aula:
            continue

        horas_por_materia = split_integer_hours(subactividad.horas, len(materias_aula))
        primera_materia = materias_aula[0]

        subactividad.materia_id = primera_materia.materia_id
        subactividad.paralelo = primera_materia.paralelo
        subactividad.horas = horas_por_materia[0]
        subactividad.save(update_fields=["materia", "paralelo", "horas"])

        for materia_aula, horas in zip(materias_aula[1:], horas_por_materia[1:]):
            if CargaHoraria.objects.filter(
                docente_id=subactividad.docente_id,
                calendario_id=subactividad.calendario_id,
                categoria="academica",
                tipo_actividad=subactividad.tipo_actividad,
                materia_id=materia_aula.materia_id,
            ).exists():
                continue

            CargaHoraria.objects.create(
                docente_id=subactividad.docente_id,
                calendario_id=subactividad.calendario_id,
                categoria=subactividad.categoria,
                materia_id=materia_aula.materia_id,
                paralelo=materia_aula.paralelo,
                dia_semana=subactividad.dia_semana,
                hora_inicio=subactividad.hora_inicio,
                hora_fin=subactividad.hora_fin,
                aula=subactividad.aula,
                titulo_actividad=subactividad.titulo_actividad,
                tipo_actividad=subactividad.tipo_actividad,
                horas=horas,
                evidencias=subactividad.evidencias,
                documento_respaldo=subactividad.documento_respaldo,
                creado_por_id=subactividad.creado_por_id,
            )


class Migration(migrations.Migration):
    dependencies = [
        ("fondos", "0082_update_academic_subactivity_evidences"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
