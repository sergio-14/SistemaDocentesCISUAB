# -*- coding: utf-8 -*-
from django.db import migrations


EVIDENCIAS_ACADEMICAS = {
    "preparacion_temas": "Plan de clases, material de apoyo",
    "elaboracion_trabajos_practicos": "Enunciados de trabajos pr\u00e1cticos, r\u00fabricas",
    "revision_calificacion_trabajos_practicos": "Actas de calificaci\u00f3n, retroalimentaci\u00f3n",
    "elaboracion_examenes": "Bancos de preguntas, ex\u00e1menes impresos",
    "revision_calificacion_examenes": "Actas de notas, estad\u00edsticas",
    "practica_laboratorios_centro_computo": "Gu\u00edas de laboratorio, registros de asistencia",
    "practicas_campo": "Informes de campo, fotos, actas",
    "produccion_docente_textos_guias": "Textos gu\u00edas publicados, material did\u00e1ctico",
    "consultas_reclamos_calificaciones": "Registro de consultas, actas de revisi\u00f3n",
    "planificacion_gestion_practica_extra_aula": "Plan de trabajo, cronograma",
    "ejecucion_practica_extra_aula": "Informes de pr\u00e1ctica, evidencias fotogr\u00e1ficas",
    "cursos_verano": "Programa del curso, lista de estudiantes",
}


def forwards(apps, schema_editor):
    CargaHoraria = apps.get_model("fondos", "CargaHoraria")
    cargas = CargaHoraria.objects.filter(categoria="academica").exclude(tipo_actividad="clases_aula")

    for carga in cargas.iterator():
        evidencia = EVIDENCIAS_ACADEMICAS.get(carga.tipo_actividad)
        if evidencia and carga.evidencias != evidencia:
            carga.evidencias = evidencia
            carga.save(update_fields=["evidencias"])


class Migration(migrations.Migration):
    dependencies = [
        ("fondos", "0081_fix_cargahoraria_canonical_utf8"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
