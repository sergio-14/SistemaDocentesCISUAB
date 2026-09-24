#!/bin/sh
# Backup periódico de PostgreSQL y de los archivos subidos (media).
#
# Cada BACKUP_INTERVAL_HOURS genera en /backups:
#   db_AAAAMMDD_HHMMSS.dump        pg_dump en formato custom (pg_restore)
#   media_AAAAMMDD_HHMMSS.tar.gz   copia del volumen media_data
# y borra los que tengan más de BACKUP_KEEP_DAYS días.
#
# Ejecutar un backup inmediato:  docker compose -f docker-compose.prod.yml exec backup /backup.sh once
set -eu

INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
DEST=/backups

hacer_backup() {
    fecha="$(date +%Y%m%d_%H%M%S)"
    echo "[$(date -Iseconds)] Iniciando backup $fecha"

    pg_dump --format=custom --no-owner --file="$DEST/db_$fecha.dump.tmp"
    mv "$DEST/db_$fecha.dump.tmp" "$DEST/db_$fecha.dump"

    tar -czf "$DEST/media_$fecha.tar.gz.tmp" -C /media .
    mv "$DEST/media_$fecha.tar.gz.tmp" "$DEST/media_$fecha.tar.gz"

    find "$DEST" -maxdepth 1 -type f \( -name 'db_*.dump' -o -name 'media_*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
    find "$DEST" -maxdepth 1 -type f -name '*.tmp' -delete

    echo "[$(date -Iseconds)] Backup $fecha completado:"
    ls -lh "$DEST/db_$fecha.dump" "$DEST/media_$fecha.tar.gz"
}

if [ "${1:-}" = "once" ]; then
    hacer_backup
    exit 0
fi

FIRST_DELAY_MINUTES="${BACKUP_FIRST_DELAY_MINUTES:-10}"
echo "Servicio de backup: cada ${INTERVAL_HOURS} h, conservando ${KEEP_DAYS} días."
# Espera inicial: tras un despliegue, deja que el backend termine las migraciones.
echo "Primer backup en ${FIRST_DELAY_MINUTES} min."
sleep "$((FIRST_DELAY_MINUTES * 60))"
while true; do
    hacer_backup || echo "[$(date -Iseconds)] ERROR: el backup falló" >&2
    sleep "$((INTERVAL_HOURS * 3600))"
done
