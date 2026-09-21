#!/bin/sh
echo "Esperando a que la base de datos esté disponible..."
while ! python -c "import psycopg2; psycopg2.connect(host='$DB_HOST', port='$DB_PORT', user='$DB_USER', password='$DB_PASSWORD', dbname='$DB_NAME')" 2>/dev/null; do
    echo "Base de datos no disponible, esperando 2 segundos..."
    sleep 2
done
echo "Base de datos disponible. Ejecutando migraciones..."
python manage.py migrate --noinput
echo "Arrancando servidor de desarrollo de Django..."
exec python manage.py runserver 0.0.0.0:8000
