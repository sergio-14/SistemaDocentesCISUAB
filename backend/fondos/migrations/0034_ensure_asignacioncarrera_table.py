from django.db import migrations


def ensure_asignacioncarrera_table(apps, schema_editor):
    AsignacionCarrera = apps.get_model("fondos", "AsignacionCarrera")
    table_name = AsignacionCarrera._meta.db_table

    existing_tables = set(schema_editor.connection.introspection.table_names())
    if table_name not in existing_tables:
        # Repara BD legacy donde la migracion inicial quedo marcada como aplicada
        # pero la tabla no existe fisicamente.
        schema_editor.create_model(AsignacionCarrera)


class Migration(migrations.Migration):
    dependencies = [
        ("fondos", "0033_ensure_perfilusuario_ci_column"),
    ]

    operations = [
        # No-op: 0001_initial already handles this.
    ]
