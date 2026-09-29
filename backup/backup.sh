#!/bin/sh
# Backup periódico de PostgreSQL y de los archivos subidos (media), CIFRADO.
#
# Cada BACKUP_INTERVAL_HOURS genera en /backups:
#   db_AAAAMMDD_HHMMSS.dump.gpg        pg_dump (formato custom) cifrado
#   media_AAAAMMDD_HHMMSS.tar.gz.gpg   copia del volumen media_data cifrada
# y borra los que tengan más de BACKUP_KEEP_DAYS días.
#
# Cifrado simétrico GPG (AES-256) con la contraseña BACKUP_PASSPHRASE. Se cifra
# al vuelo: la copia sin cifrar nunca se escribe en disco. Sin esa contraseña los
# backups no se pueden abrir: guardarla fuera del servidor.
#
# Ejecutar un backup inmediato:  docker compose -f docker-compose.prod.yml exec backup /backup.sh once
set -eu

INTERVAL_HOURS="${BACKUP_INTERVAL_HOURS:-24}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
DEST=/backups
export GNUPGHOME=/tmp/gnupg

if [ -z "${BACKUP_PASSPHRASE:-}" ]; then
    echo "ERROR: falta BACKUP_PASSPHRASE (contraseña para cifrar los backups)." >&2
    exit 1
fi
mkdir -p "$GNUPGHOME" && chmod 700 "$GNUPGHOME"

# Cifra la entrada estándar en el archivo $1. La contraseña va por el descriptor 3
# (no aparece en la línea de comandos ni en la lista de procesos).
cifrar() {
    gpg --batch --yes --quiet --pinentry-mode loopback --passphrase-fd 3 \
        --symmetric --cipher-algo AES256 --output "$1" 3<<EOF
$BACKUP_PASSPHRASE
EOF
}

hacer_backup() {
    fecha="$(date +%Y%m%d_%H%M%S)"
    echo "[$(date -Iseconds)] Iniciando backup $fecha"

    # set -o pipefail no existe en sh: se comprueba el resultado de pg_dump aparte.
    ( pg_dump --format=custom --no-owner || echo "pg_dump falló" > "$DEST/.error_$fecha" ) \
        | cifrar "$DEST/db_$fecha.dump.gpg.tmp"
    tar -czf - -C /media . | cifrar "$DEST/media_$fecha.tar.gz.gpg.tmp"
    if [ -e "$DEST/.error_$fecha" ]; then
        rm -f "$DEST/.error_$fecha" "$DEST/db_$fecha.dump.gpg.tmp" "$DEST/media_$fecha.tar.gz.gpg.tmp"
        echo "[$(date -Iseconds)] ERROR: pg_dump falló, no se guarda el backup $fecha" >&2
        return 1
    fi
    mv "$DEST/db_$fecha.dump.gpg.tmp" "$DEST/db_$fecha.dump.gpg"
    mv "$DEST/media_$fecha.tar.gz.gpg.tmp" "$DEST/media_$fecha.tar.gz.gpg"

    # Retención: también limpia los backups antiguos sin cifrar (antes de este cambio).
    find "$DEST" -maxdepth 1 -type f \( -name 'db_*.dump*' -o -name 'media_*.tar.gz*' \) -mtime +"$KEEP_DAYS" -delete
    find "$DEST" -maxdepth 1 -type f -name '*.tmp' -delete

    echo "[$(date -Iseconds)] Backup $fecha completado:"
    ls -lh "$DEST/db_$fecha.dump.gpg" "$DEST/media_$fecha.tar.gz.gpg"
}

if [ "${1:-}" = "once" ]; then
    hacer_backup
    exit 0
fi

FIRST_DELAY_MINUTES="${BACKUP_FIRST_DELAY_MINUTES:-10}"
echo "Servicio de backup cifrado: cada ${INTERVAL_HOURS} h, conservando ${KEEP_DAYS} días."
# Espera inicial: tras un despliegue, deja que el backend termine las migraciones.
echo "Primer backup en ${FIRST_DELAY_MINUTES} min."
sleep "$((FIRST_DELAY_MINUTES * 60))"
while true; do
    hacer_backup || echo "[$(date -Iseconds)] ERROR: el backup falló" >&2
    sleep "$((INTERVAL_HOURS * 3600))"
done
