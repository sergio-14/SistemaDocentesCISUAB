from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("fondos", "0032_alter_fondotiempo_calendario_academico_protect"),
        ("fondos", "0054_docente_carrera_obligatoria"),
    ]

    operations = [
        # No-op: 0001_initial already handles this.
    ]
