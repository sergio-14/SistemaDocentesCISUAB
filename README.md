# Sistema de Planificacion y Gestion Institucional UAB-JB
- Construnstruya su arquitectura para saber donde apuntan las carpetas.
Aplicacion web compuesta por:

- Backend Django REST Framework.
- Frontend React con Vite.
- Base de datos PostgreSQL 15.

## Requisitos

- Git.
- Docker Desktop, o Docker Engine con Docker Compose v2.
- Puertos `5173`, `8000` y `5432` disponibles.

## Instalacion con Docker

Clonar el repositorio:

```bash
git clone https://github.com/richy1991/SISTEMA-DOCENTES-UABJB.git
cd SISTEMA-DOCENTES-UABJB
```

Crear la configuracion local.

En Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

En Linux o macOS:

```bash
cp .env.example .env
```

Antes de publicar el sistema, cambia `SECRET_KEY` y `DB_PASSWORD` dentro de
`.env`. Este archivo esta excluido de Git.

Construir e iniciar los servicios:

```bash
docker compose up -d --build
```

Comprobar el estado:

```bash
docker compose ps
docker compose logs --tail 100 backend
```

La primera ejecucion crea la base de datos y aplica las migraciones de Django.

## Direcciones locales

- Aplicacion: <http://localhost:5173>
- API: <http://localhost:8000/api/>
- Administracion Django: <http://localhost:8000/admin/>
- PostgreSQL: `localhost:5432`

## Crear el primer administrador

```bash
docker compose exec backend python manage.py createsuperuser
```

## Comandos frecuentes

```bash
# Ver registros en tiempo real
docker compose logs -f

# Detener los servicios sin eliminarlos
docker compose stop

# Volver a iniciarlos
docker compose start

# Retirar contenedores conservando la base de datos
docker compose down
```

No uses `docker compose down -v` salvo que quieras eliminar definitivamente la
base de datos local.

## Actualizar una instalacion existente

```bash
git pull --ff-only
docker compose up -d --build
docker compose exec backend python manage.py migrate --noinput
```

Los archivos cargados por los usuarios se conservan en `media/` y los datos de
PostgreSQL en el volumen Docker `postgres_data`.
