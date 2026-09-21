from django.db import migrations


def ensure_perfilusuario_ci_column(apps, schema_editor):
    table_name = "fondos_perfilusuario"
    column_name = "ci"

    with schema_editor.connection.cursor() as cursor:
        columns = {
            col.name
            for col in schema_editor.connection.introspection.get_table_description(
                cursor, table_name
            )
        }

        if column_name not in columns:
            # Solo agrega la columna cuando falta (BD legacy). Se deja nullable
            # para no romper filas existentes.
            schema_editor.execute(
                "ALTER TABLE fondos_perfilusuario ADD COLUMN ci varchar(20) NULL"
            )


class Migration(migrations.Migration):
    dependencies = [
        ("fondos", "0001_initial"),
    ]

    operations = [
        # No-op: 0001_initial already handles this.
    ]
