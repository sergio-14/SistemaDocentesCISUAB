#!/bin/sh
set -e

echo "Esperando a que la base de datos esté disponible..."
# Las credenciales se leen desde el entorno dentro de Python: una contraseña con
# comillas u otros caracteres especiales no rompe el script.
python - <<'EOF'
import os
import sys
import time

import psycopg2

def env(nombre, anterior, defecto=None):
    """Nombre estándar de la guía IIISyP (POSTGRES_*) o, si falta, el anterior (DB_*)."""
    valor = os.environ.get(nombre) or os.environ.get(anterior) or defecto
    if valor is None:
        print(f"Falta la variable {nombre}.", file=sys.stderr)
        sys.exit(1)
    return valor


intentos = int(os.environ.get("DB_WAIT_ATTEMPTS", "30"))
for intento in range(1, intentos + 1):
    try:
        psycopg2.connect(
            host=env("POSTGRES_HOST", "DB_HOST", "db"),
            port=env("POSTGRES_PORT", "DB_PORT", "5432"),
            user=env("POSTGRES_USER", "DB_USER"),
            password=env("POSTGRES_PASSWORD", "DB_PASSWORD"),
            dbname=env("POSTGRES_DB", "DB_NAME"),
            connect_timeout=5,
        ).close()
        print("Base de datos disponible.")
        sys.exit(0)
    except psycopg2.OperationalError as exc:
        print(f"Base de datos no disponible ({intento}/{intentos}): {str(exc).strip()}")
        time.sleep(2)

print("La base de datos no respondió a tiempo.", file=sys.stderr)
sys.exit(1)
EOF

echo "Ejecutando migraciones..."
python manage.py migrate --noinput

case "$(echo "${DJANGO_DEBUG:-${DEBUG:-False}}" | tr '[:upper:]' '[:lower:]')" in
    true|1|yes|on)
        echo "DEBUG activo: arrancando servidor de desarrollo de Django..."
        exec python manage.py runserver 0.0.0.0:8000
        ;;
esac

echo "Recolectando archivos estáticos..."
python manage.py collectstatic --noinput

# --timeout 120: el reporte general del POA (pandas + reportlab) puede tardar
# más que los 30 s por defecto de gunicorn.
echo "Arrancando gunicorn..."
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}" \
    --timeout "${GUNICORN_TIMEOUT:-120}" \
    --forwarded-allow-ips "*" \
    --access-logfile - \
    --error-logfile -
