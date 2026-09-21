from django.db import migrations
from django.db.utils import OperationalError


def repair_legacy_schema(apps, schema_editor):
    connection = schema_editor.connection

    def get_tables():
        with connection.cursor() as cursor:
            return set(connection.introspection.table_names(cursor))

    def get_columns(table_name):
        with connection.cursor() as cursor:
            return {
                col.name
                for col in connection.introspection.get_table_description(
                    cursor, table_name
                )
            }

    # 1) Tabla historica faltante en bases legacy.
    HistoricalCarrera = apps.get_model("fondos", "HistoricalCarrera")
    tables = get_tables()
    if HistoricalCarrera._meta.db_table not in tables:
        schema_editor.create_model(HistoricalCarrera)
        tables = get_tables()

    def add_column_if_missing(table_name, column_name, sql_type_definition):
        columns = get_columns(table_name)
        if column_name in columns:
            return
        try:
            schema_editor.execute(
                f'ALTER TABLE "{table_name}" ADD COLUMN "{column_name}" {sql_type_definition}'
            )
        except OperationalError as exc:
            # SQLite puede reportar columna duplicada por condiciones de carrera
            # durante reconstrucciones internas. Si ya existe, se ignora.
            if "duplicate column name" not in str(exc).lower():
                raise

    # 2) Columnas faltantes detectadas en bases legacy (SQLite).
    if "fondos_carrera" in tables:
        add_column_if_missing("fondos_carrera", "mision", "TEXT NOT NULL DEFAULT ''")
        add_column_if_missing("fondos_carrera", "vision", "TEXT NOT NULL DEFAULT ''")
        add_column_if_missing("fondos_carrera", "perfil_profesional", "TEXT NOT NULL DEFAULT ''")
        add_column_if_missing("fondos_carrera", "objetivo_carrera", "TEXT NOT NULL DEFAULT ''")
        add_column_if_missing("fondos_carrera", "responsable", "varchar(200) NOT NULL DEFAULT ''")
        add_column_if_missing("fondos_carrera", "resolucion_ministerial", "varchar(255) NOT NULL DEFAULT ''")
        add_column_if_missing("fondos_carrera", "fecha_resolucion", "date NULL")
        add_column_if_missing("fondos_carrera", "logo_carrera", "varchar(100) NULL")
        add_column_if_missing("fondos_carrera", "logo_carrera_cifrada", "BLOB NULL")
        add_column_if_missing("fondos_carrera", "logo_carrera_mime", "varchar(64) NOT NULL DEFAULT ''")
        add_column_if_missing(
            "fondos_carrera",
            "fecha_actualizacion",
            "datetime NULL",
        )

    if "fondos_cargahoraria" in tables:
        add_column_if_missing("fondos_cargahoraria", "materia_id", "bigint NULL")
        add_column_if_missing("fondos_cargahoraria", "paralelo", "varchar(1) NOT NULL DEFAULT 'A'")
        add_column_if_missing("fondos_cargahoraria", "dia_semana", "varchar(10) NULL")
        add_column_if_missing("fondos_cargahoraria", "hora_inicio", "time NULL")
        add_column_if_missing("fondos_cargahoraria", "hora_fin", "time NULL")
        add_column_if_missing("fondos_cargahoraria", "aula", "varchar(100) NULL")


class Migration(migrations.Migration):
    dependencies = [
        ("fondos", "0034_ensure_asignacioncarrera_table"),
    ]

    operations = [
        # No-op: 0001_initial already handles this.
    ]
