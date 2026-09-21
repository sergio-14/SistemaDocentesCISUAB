# -*- coding: utf-8 -*-
from django.db import migrations


MOJIBAKE_MARKERS = ("Ã", "Â", "â", "ð")

CANONICAL_TITLES = {
    "preparacion_temas": "Preparaci\u00f3n de temas",
    "elaboracion_trabajos_practicos": "Elaboraci\u00f3n de Trabajos Pr\u00e1cticos",
    "revision_calificacion_trabajos_practicos": "Revisi\u00f3n y Calificaci\u00f3n de Trabajos Pr\u00e1cticos",
    "elaboracion_examenes": "Elaboraci\u00f3n de Ex\u00e1menes",
    "revision_calificacion_examenes": "Revisi\u00f3n y Calificaci\u00f3n de Ex\u00e1menes",
    "practica_laboratorios_centro_computo": "Pr\u00e1ctica de Laboratorios (Centro de C\u00f3mputo)",
    "practicas_campo": "Pr\u00e1cticas de Campo",
    "produccion_docente_textos_guias": "Producci\u00f3n docente (textos gu\u00edas)",
    "consultas_reclamos_calificaciones": "Consultas y Reclamos de Calificaciones",
    "clases_aula": "Clases en aula",
    "elaboracion_planillas_introduccion_notas_moxos": "Elaboraci\u00f3n de planillas e Introducci\u00f3n de notas al sistema moxos",
    "planificacion_gestion_practica_extra_aula": "Planificaci\u00f3n y gesti\u00f3n de pr\u00e1ctica extra aula",
    "ejecucion_practica_extra_aula": "Ejecuci\u00f3n de pr\u00e1ctica extra aula",
    "informe_descargo_viaje_practicas_extra_aula": "Informe de descargo de viaje en las pr\u00e1cticas extra aula",
    "participacion_iic_cis": "Participaci\u00f3n IIC-CIS",
    "organizacion_eventos_cientificos": "Organizaci\u00f3n eventos cient\u00edficos",
    "elaboracion_trabajos_investigacion": "Elaboraci\u00f3n trabajos investigaci\u00f3n",
    "proyectos_extension": "Proyectos de extensi\u00f3n",
    "tareas_proyectos_extension_interaccion": "Tareas en proyectos de extensi\u00f3n e interacci\u00f3n",
    "proyectos_interaccion": "Proyectos de interacci\u00f3n",
    "participacion_ferias_campanas_jornadas": "Participaci\u00f3n en ferias, campa\u00f1as, jornadas",
    "proyectos_sociales": "Proyectos sociales",
    "modalidad_graduacion": "Modalidad de Graduaci\u00f3n",
    "auxiliares_docencia": "Auxiliares de docencia",
    "examenes_mesa": "Ex\u00e1menes de mesa",
    "otras_comisiones_academicas": "Otras comisiones acad\u00e9micas",
    "acto_academico_facultativo": "Acto acad\u00e9mico facultativo",
    "acto_academico_universitario": "Acto acad\u00e9mico universitario",
    "entrada_folclorica": "Entrada folcl\u00f3rica",
    "claustros_universitarios": "Claustros universitarios",
    "asociacion_docente": "Asociaci\u00f3n Docente",
    "capacitacion_complementaria": "Capacitaci\u00f3n complementaria",
    "orientacion_vocacional": "Orientaci\u00f3n Vocacional",
}

CANONICAL_EVIDENCIAS = {
    "preparacion_temas": "Planificaci\u00f3n acad\u00e9mica, material docente y registros de seguimiento",
    "elaboracion_trabajos_practicos": "Planificaci\u00f3n acad\u00e9mica, material docente y registros de seguimiento",
    "revision_calificacion_trabajos_practicos": "Planificaci\u00f3n acad\u00e9mica, material docente y registros de seguimiento",
    "elaboracion_examenes": "Planificaci\u00f3n acad\u00e9mica, material docente y registros de seguimiento",
    "revision_calificacion_examenes": "Planificaci\u00f3n acad\u00e9mica, material docente y registros de seguimiento",
    "practica_laboratorios_centro_computo": "Planificaci\u00f3n acad\u00e9mica, material docente y registros de seguimiento",
    "practicas_campo": "Planificaci\u00f3n acad\u00e9mica, material docente y registros de seguimiento",
    "produccion_docente_textos_guias": "Planificaci\u00f3n acad\u00e9mica, material docente y registros de seguimiento",
    "planificacion_gestion_practica_extra_aula": "Planificaci\u00f3n acad\u00e9mica, material docente y registros de seguimiento",
    "ejecucion_practica_extra_aula": "Planificaci\u00f3n acad\u00e9mica, material docente y registros de seguimiento",
}


def fix_mojibake(value):
    if not isinstance(value, str) or not value:
        return value

    fixed = value
    for _ in range(4):
        if not any(marker in fixed for marker in MOJIBAKE_MARKERS):
            break
        try:
            candidate = fixed.encode("latin-1").decode("utf-8")
        except UnicodeError:
            break
        if candidate == fixed or "\ufffd" in candidate:
            break
        fixed = candidate
    return fixed


def forwards(apps, schema_editor):
    CargaHoraria = apps.get_model("fondos", "CargaHoraria")
    campos = ("tipo_actividad", "titulo_actividad", "evidencias", "documento_respaldo")

    for carga in CargaHoraria.objects.all().iterator():
        update_fields = []

        for campo in campos:
            original = getattr(carga, campo, "")
            corregido = fix_mojibake(original)
            if corregido != original:
                setattr(carga, campo, corregido)
                update_fields.append(campo)

        titulo_canonico = CANONICAL_TITLES.get(carga.tipo_actividad)
        if titulo_canonico and not carga.materia_id and carga.titulo_actividad != titulo_canonico:
            carga.titulo_actividad = titulo_canonico
            update_fields.append("titulo_actividad")

        evidencia_canonica = CANONICAL_EVIDENCIAS.get(carga.tipo_actividad)
        if evidencia_canonica and carga.evidencias and carga.evidencias != evidencia_canonica:
            carga.evidencias = evidencia_canonica
            update_fields.append("evidencias")

        if update_fields:
            carga.save(update_fields=sorted(set(update_fields)))


class Migration(migrations.Migration):
    dependencies = [
        ("fondos", "0080_fix_cargahoraria_utf8_mojibake"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
