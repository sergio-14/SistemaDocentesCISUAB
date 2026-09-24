FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Todas las dependencias (incluido psycopg2-binary) tienen ruedas precompiladas
# para Python 3.12, por eso no hace falta instalar gcc ni libpq-dev.
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Usuario sin privilegios (regla 8 de la guía IIISyP). UID/GID fijos (10001): el
# servicio "media-permisos" de docker-compose.prod.yml los usa para dar al
# volumen de archivos subidos el dueño correcto.
RUN groupadd --system --gid 10001 app \
    && useradd --system --uid 10001 --gid app --create-home --home-dir /home/app app \
    && mkdir -p /app/staticfiles /app/media \
    && chown -R app:app /app

COPY --chown=app:app . .

# El entrypoint vive fuera de /app para que el bind mount de desarrollo
# (./backend:/app) no lo oculte. Se normalizan saltos de linea por si el
# archivo llega con CRLF desde Windows.
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod 755 /entrypoint.sh

USER app

EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
