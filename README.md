# Sistema de Planificacion y Gestion Institucional UAB-JB
- Construnstruya su arquitectura para saber donde apuntan las carpetas.
Aplicacion web compuesta por:

- Backend Django REST Framework.
- Frontend React con Vite.
- Base de datos PostgreSQL 16.

El despliegue sigue la guia del VPS de IIISyP:
<https://github.com/sergio-14/Documentacion_IIISyP>.

## Requisitos

- Git.
- Docker Desktop, o Docker Engine con Docker Compose v2.
- Puertos `5173`, `8000` y `5432` disponibles (solo desarrollo).

Hay dos configuraciones de Docker Compose:

| Archivo | Uso |
|---|---|
| `docker-compose.yml` | Desarrollo local: recarga en caliente de Django y Vite |
| `docker-compose.prod.yml` | Servidor (Dokploy): gunicorn, nginx, un solo dominio, sin puertos publicados |

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
- Administracion Django: <http://localhost:8000/django-admin/>
- PostgreSQL: `localhost:5432` (solo desde este equipo)

> El admin de Django esta en `/django-admin/` porque `/admin` es el panel de
> administracion de la app React.

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
PostgreSQL en el volumen Docker `postgres16_data`.

### Notas para instalaciones de desarrollo anteriores

- **Variables:** ahora se usan los nombres de la guia IIISyP (`DJANGO_SECRET_KEY`,
  `DJANGO_ALLOWED_HOSTS`, `POSTGRES_DB`, `POSTGRES_USER`, ...). Los nombres
  antiguos (`SECRET_KEY`, `DB_NAME`, ...) se siguen aceptando, pero conviene
  renombrarlos en tu `.env` segun `.env.example`.
- **PostgreSQL 15 → 16:** la version 16 no abre datos de la 15, por eso el
  volumen cambio a `postgres16_data`. Para conservar tus datos locales:

  ```bash
  # antes de actualizar (con la version anterior en marcha)
  docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > dev.dump
  # despues de actualizar
  docker compose up -d db
  docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' < dev.dump
  ```

  El volumen antiguo (`<proyecto>_postgres_data`) se puede borrar despues con
  `docker volume rm`.
- **Permisos:** el backend ya no corre como root. Si una subida falla con
  `Permission denied` en `media/`, borra las subcarpetas de `media/` creadas por
  la version anterior (o cambia sus permisos) para que se vuelvan a crear.

## Despliegue en produccion (Dokploy)

`docker-compose.prod.yml` cumple la guia IIISyP:

| Regla de la guia | Como se cumple |
|---|---|
| PostgreSQL 16, volumen con nombre, sin puerto 5432 | Servicio `db` con `postgres:16-alpine` y `postgres_data` |
| Sin `ports:` ni `container_name` | Solo `expose:` |
| Red `dokploy-network` en el servicio que recibe trafico | Servicio `frontend` |
| Datos en volumenes con nombre | `postgres_data`, `media_data`, `backups` |
| Usuario no-root | Backend con usuario `app` (UID 10001) |
| El entrypoint espera a la BD y migra | `backend/entrypoint.sh` (tambien `collectstatic` y gunicorn) |
| `restart` + healthcheck | En todos los servicios |
| Variables estandar y obligatorias con `:?` | `DJANGO_*`, `POSTGRES_*` |

Arquitectura (un solo dominio):

```
Usuario ──HTTPS──▶ Traefik ──▶ frontend (nginx :80) ──┬─▶ SPA React
                                                      └─▶ /api, /django-admin, /media, /static
                                                           ──▶ backend (gunicorn :8000) ──▶ db
```

Diferencias intencionadas con las plantillas de la guia:

- `/media/` no se sirve publico desde nginx: el backend lo entrega solo con
  **URLs firmadas que caducan** (evidencias, actas y respaldos son privados).
- El superusuario **no** se crea desde variables de entorno: se crea a mano
  (ver paso 6), para no guardar la contrasena de administrador en Dokploy.
- Los archivos Docker estan dentro de `backend/` y `frontend/` (el proyecto
  tiene dos aplicaciones) en lugar de una carpeta `docker/`.

### 1. Variables de entorno

En Dokploy (pestana *Environment*):

```env
DJANGO_SECRET_KEY=<clave larga y aleatoria>
DJANGO_ALLOWED_HOSTS=midominio.com
DJANGO_CSRF_TRUSTED_ORIGINS=https://midominio.com
POSTGRES_DB=sistema_docentes
POSTGRES_USER=sistema_docentes
POSTGRES_PASSWORD=<contrasena larga y aleatoria>
VITE_API_URL=https://midominio.com
PROFILE_IMAGE_ENCRYPTION_KEY=<clave Fernet>
```

Generar las claves (usa solo `A-Z a-z 0-9 - _`: un `$` o `#` en un valor
puede romper la lectura de variables de Docker Compose y Dokploy):

```bash
python -c "import secrets; print(secrets.token_urlsafe(50))"
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Si falta alguna variable obligatoria, el despliegue se detiene indicando
cual. `VITE_API_URL` se incrusta al compilar el frontend: si cambia, hay que
hacer *Rebuild*.

> **Importante:** guarda `DJANGO_SECRET_KEY` en un lugar seguro: firma las
> sesiones y los enlaces a archivos. `PROFILE_IMAGE_ENCRYPTION_KEY` solo hace
> falta para leer fotos y logos de instalaciones anteriores (guardados cifrados
> en la BD) antes de pasarlos a `media/` con `organizar_media`.

### 2. Crear el servicio

Dokploy → *Projects* → *Create Service* → **Compose**:

| Campo | Valor |
|---|---|
| Repository / Branch | este repositorio y la rama a desplegar |
| Compose Path | `./docker-compose.prod.yml` |
| Trigger Type | *On Push* |

### 3. Dominio (uno solo)

Pestana *Domains* → *Add Domain*:

| Campo | Valor |
|---|---|
| Service Name | `frontend` |
| Port | `80` |
| Host | `midominio.com` |
| HTTPS | activado, Let's Encrypt |

El registro DNS tipo A del dominio debe apuntar a la IP del VPS.

### 4. Desplegar

*Deploy* y revisar *Deployments* / *Logs*. En el backend deben verse
`Base de datos disponible.`, las migraciones y `Starting gunicorn`.

### 5. Verificar

- `https://midominio.com` carga con candado.
- El login funciona.
- `https://midominio.com/django-admin/` carga con estilos.
- Los datos siguen tras un redeploy.

### 6. Crear el administrador (a mano)

Desde la pestana *Terminal* del servicio `backend`:

```bash
python manage.py createsuperuser
```

Se hace a mano a proposito: la contrasena de administrador no queda guardada
en variables de entorno y la cuenta la crea una persona identificable.

### Probar la configuracion de produccion en local

```bash
docker network create dokploy-network   # solo la primera vez
docker compose -f docker-compose.prod.yml --env-file .env.production.local up -d --build
```

## Archivos subidos (carpeta media)

Todos los archivos que suben los usuarios, incluidas las fotos de perfil y
los logos de carrera, se guardan en `media/` (en produccion, volumen
`media_data`) con esta organizacion:

```
media/
├── carreras/carrera_<id>/logo.<ext>
├── usuarios/usuario_<id>/foto_perfil.<ext>
├── fondos/
│   ├── evidencias_actividades/docente_<id>/gestion_<año>/<categoria>/
│   ├── evidencias_carga/docente_<id>/gestion_<año>/<categoria>/actividad_<id>/
│   └── informes/docente_<id>/gestion_<año>/{adjuntos,evidencias,imagenes}/
└── poa/
    ├── compras/<año>/<mes>/
    ├── recepciones/<año>/<mes>/
    ├── entregas/<año>/<mes>/
    └── evidencias/<año>/<mes>/
```

- Al reemplazar o quitar un logo o una foto, el archivo anterior se borra.
- Las imagenes que se insertan en el editor de informes se guardan en
  `informes/.../imagenes/` (no dentro de la base de datos). Una imagen repetida
  no se duplica y, si se quita del informe, su archivo se borra.
- Los archivos no son publicos: se entregan solo con URLs firmadas que caducan
  (y las fotos y logos, como data URI dentro de la API).

**Instalaciones anteriores:** las versiones previas guardaban fotos y logos
cifrados dentro de la base de datos y usaban otras carpetas (`uploads/`,
`evidencias_carga/`, `informes_evidencia/`, `evidencias/`) y las imagenes de
los informes en base64 dentro de la BD. Se siguen leyendo,
pero para pasarlos a la estructura nueva hay que ejecutar una vez (con un
backup hecho antes):

```bash
python manage.py organizar_media --dry-run   # muestra lo que haria
python manage.py organizar_media             # lo aplica (se puede repetir)
```

## Backups

El servicio `backup` de `docker-compose.prod.yml` guarda en el volumen
`backups`, cada `BACKUP_INTERVAL_HOURS` (24 h por defecto; el primero 10 min
despues de arrancar):

- `db_AAAAMMDD_HHMMSS.dump`: base de datos (`pg_dump`, formato custom).
- `media_AAAAMMDD_HHMMSS.tar.gz`: archivos subidos.

Se conservan `BACKUP_KEEP_DAYS` dias (14 por defecto).

> Los backups quedan **en el mismo servidor**: "un backup que solo existe en
> el mismo VPS no es un backup" (guia IIISyP). Copialos periodicamente fuera
> (otra maquina, S3, Backblaze...).

Backup inmediato:

```bash
docker compose -f docker-compose.prod.yml exec backup /backup.sh once
```

Restaurar la base de datos (reemplazar la fecha por la del backup elegido):

```bash
docker compose -f docker-compose.prod.yml stop backend
docker compose -f docker-compose.prod.yml exec backup sh -c \
  'pg_restore --clean --if-exists --no-owner --dbname="$PGDATABASE" /backups/db_AAAAMMDD_HHMMSS.dump'
docker compose -f docker-compose.prod.yml start backend
```

Restaurar los archivos subidos (el nombre real de los volumenes lleva el
prefijo del proyecto; se ve con `docker volume ls`):

```bash
docker run --rm -v <proyecto>_media_data:/media -v <proyecto>_backups:/backups \
  alpine tar -xzf /backups/media_AAAAMMDD_HHMMSS.tar.gz -C /media
```

## Despues del despliegue

- Cuando HTTPS funcione de forma estable, se puede activar HSTS con
  `SECURE_HSTS_SECONDS=31536000`.
- Opcional: los informes PDF usan Verdana si se copian `verdana.ttf`,
  `verdanab.ttf` y `trebucit.ttf` en `backend/fondos/fonts/` (son fuentes con
  licencia de Microsoft y no se versionan). Sin ellas se usa Helvetica.
