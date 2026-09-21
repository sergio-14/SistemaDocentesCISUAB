# -*- coding: utf-8 -*-
from django.db import migrations


HORAS_POR_TIPO_DOS_MATERIAS = {
    "preparacion_temas": (83, 83),
    "elaboracion_trabajos_practicos": (9, 9),
    "revision_calificacion_trabajos_practicos": (19, 18),
    "elaboracion_examenes": (3, 3),
    "revision_calificacion_examenes": (14, 14),
    "practica_laboratorios_centro_computo": (4, 3),
    "practicas_campo": (2, 2),
    "produccion_docente_textos_guias": (3, 4),
    "consultas_reclamos_calificaciones": (18, 19),
    "planificacion_gestion_practica_extra_aula": (19, 18),
    "ejecucion_practica_extra_aula": (18, 19),
    "cursos_verano": (14, 14),
}


def forwards(apps, schema_editor):
    CargaHoraria = apps.get_model("fondos", "CargaHoraria")

    grupos = (
        CargaHoraria.objects.filter(categoria="academica", tipo_actividad="clases_aula", materia__isnull=False)
        .values_list("docente_id", "calendario_id")
        .distinct()
    )

    for docente_id, calendario_id in grupos:
        materias_aula = list(
            CargaHoraria.objects.filter(
                docente_id=docente_id,
                calendario_id=calendario_id,
                categoria="academica",
                tipo_actividad="clases_aula",
                materia__isnull=False,
            ).order_by("id")
        )
        if len(materias_aula) != 2:
            continue

        for tipo_actividad, horas_por_materia in HORAS_POR_TIPO_DOS_MATERIAS.items():
            for materia_aula, horas in zip(materias_aula, horas_por_materia):
                cargas = CargaHoraria.objects.filter(
                    docente_id=docente_id,
                    calendario_id=calendario_id,
                    categoria="academica",
                    tipo_actividad=tipo_actividad,
                    materia_id=materia_aula.materia_id,
                ).order_by("id")
                carga = cargas.first()
                if carga and carga.horas != horas:
                    carga.horas = horas
                    carga.paralelo = materia_aula.paralelo
                    carga.save(update_fields=["horas", "paralelo"])


class Migration(migrations.Migration):
    dependencies = [
        ("fondos", "0083_link_academic_subactivities_to_subjects"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
