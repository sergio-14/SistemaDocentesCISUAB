# Misma versión mayor que la base de datos: pg_dump debe ser >= al servidor.
FROM postgres:16-alpine
COPY backup.sh /backup.sh
RUN sed -i 's/\r$//' /backup.sh && chmod +x /backup.sh
ENTRYPOINT ["/backup.sh"]
