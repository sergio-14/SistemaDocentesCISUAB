# -*- coding: utf-8 -*-
from django.db import migrations


MOJIBAKE_MARKERS = ("Ã", "Â", "â", "ð")


def fix_mojibake(value):
    if not isinstance(value, str) or not value:
        return value

    fixed = value
    for _ in range(3):
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
        if update_fields:
            carga.save(update_fields=update_fields)


class Migration(migrations.Migration):
    dependencies = [
        ("fondos", "0079_cargahoraria_tipo_actividad_evidencias"),
    ]

    operations = [
        migrations.RunPython(forwards, migrations.RunPython.noop),
    ]
