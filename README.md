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

Hay dos configuraciones de Docker Compose:

| Archivo | Uso |
|---|---|
| `docker-compose.yml` | Desarrollo local: recarga en caliente de Django y Vite |
| `docker-compose.prod.yml` | Servidor: gunicorn, nginx, sin puertos de BD, volumenes persistentes |

## Instalacion con Docker (desarrollo)

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
- PostgreSQL: `localhost:5432` (solo desde este equipo)

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

## Despliegue en produccion (Dokploy u otro servidor)

Usar `docker-compose.prod.yml`. Resumen de lo que hace:

- **Backend:** gunicorn (3 workers, timeout 120 s), `DEBUG=False`, estaticos
  servidos con WhiteNoise, migraciones y `collectstatic` automaticos al arrancar.
- **Frontend:** compilado con `vite build` y servido con nginx (puerto 80).
- **PostgreSQL:** sin puertos publicados; solo accesible desde el backend.
- **Archivos subidos:** volumen `media_data`. Se sirven solo con URLs firmadas
  que caducan (`MEDIA_URL_MAX_AGE`, 12 h por defecto).

### 1. Variables de entorno

En Dokploy (pestana *Environment*), o en un `.env` en el servidor:

```env
SECRET_KEY=<clave larga y aleatoria>
ALLOWED_HOSTS=api.midominio.com
DB_NAME=sistema_docentes
DB_USER=postgres
DB_PASSWORD=<contrasena larga y aleatoria>
CORS_ALLOWED_ORIGINS=https://midominio.com
CSRF_TRUSTED_ORIGINS=https://midominio.com,https://api.midominio.com
VITE_API_URL=https://api.midominio.com
PROFILE_IMAGE_ENCRYPTION_KEY=<clave Fernet>
```

Generar las claves:

```bash
python -c "from django.core.management.utils import get_random_secret_key as g; print(g())"
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Si falta alguna variable obligatoria, `docker compose` se detiene indicando
cual. `VITE_API_URL` se incrusta al compilar el frontend: si cambia, hay que
reconstruirlo.

> **Importante:** guarda `SECRET_KEY` y `PROFILE_IMAGE_ENCRYPTION_KEY` en un
> lugar seguro. Las fotos de perfil y los logos se guardan cifrados: si se
> pierden ambas claves, esas imagenes no se pueden recuperar.

### 2. Dokploy

1. Crear un servicio de tipo **Docker Compose** apuntando a este repositorio y
   con la ruta del compose en `docker-compose.prod.yml`.
2. Cargar las variables del paso anterior.
3. En *Domains* asignar:

   | Servicio | Puerto | Dominio |
   |---|---|---|
   | `frontend` | 80 | `midominio.com` |
   | `backend` | 8000 | `api.midominio.com` |

4. Los registros DNS (tipo A) de ambos dominios deben apuntar a la IP del VPS.
5. Desplegar y crear el administrador desde la terminal del contenedor
   `backend`: `python manage.py createsuperuser`.

### 3. Sin Dokploy

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Los servicios solo exponen puertos a la red interna de Docker: hace falta un
proxy inverso con HTTPS (Traefik, Caddy, nginx) que envie la cabecera
`X-Forwarded-Proto` y publique `frontend:80` y `backend:8000`.

### 4. Despues del despliegue

- Configurar backups de la base de datos y del volumen `media_data`.
- Cuando HTTPS funcione de forma estable, se puede activar HSTS con
  `SECURE_HSTS_SECONDS=31536000`.
- Opcional: los informes PDF usan Verdana si se copian `verdana.ttf`,
  `verdanab.ttf` y `trebucit.ttf` en `backend/fondos/fonts/` (son fuentes con
  licencia de Microsoft y no se versionan). Sin ellas se usa Helvetica.
