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
| `docker-compose.dev.yml` | Desarrollo local: recarga en caliente de Django y Vite |
| `docker-compose.yml` | Servidor (Dokploy): gunicorn, nginx, un solo dominio, sin puertos publicados |

En desarrollo, todos los comandos llevan `-f docker-compose.dev.yml`: sin esa opcion
Docker Compose usa `docker-compose.yml`, que es el de produccion.

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
docker compose -f docker-compose.dev.yml up -d --build
```

Comprobar el estado:

```bash
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml logs --tail 100 backend
```

La primera ejecucion crea la base de datos y aplica las migraciones de Django.

## Direcciones locales

- Aplicacion: <http://localhost:5173>
- API: <http://localhost:8000/api/>
- Administracion Django: <http://localhost:8000/django-admin/> (solo en desarrollo)
- PostgreSQL: `localhost:5432` (solo desde este equipo)

> El admin de Django esta en `/django-admin/` porque `/admin` es el panel de
> administracion de la app React. En produccion esta **apagado**: solo existe si
> se define `DJANGO_ADMIN_ENABLED=True` y ademas se agrega la ruta en
> `frontend/nginx.conf`.

## Crear el primer administrador

```bash
docker compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser
```

## Comandos frecuentes

```bash
# Ver registros en tiempo real
docker compose -f docker-compose.dev.yml logs -f

# Detener los servicios sin eliminarlos
docker compose -f docker-compose.dev.yml stop

# Volver a iniciarlos
docker compose -f docker-compose.dev.yml start

# Retirar contenedores conservando la base de datos
docker compose -f docker-compose.dev.yml down
```

No uses `docker compose -f docker-compose.dev.yml down -v` salvo que quieras eliminar definitivamente la
base de datos local.

## Actualizar una instalacion existente

```bash
git pull --ff-only
docker compose -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.dev.yml exec backend python manage.py migrate --noinput
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
  docker compose -f docker-compose.dev.yml exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > dev.dump
  # despues de actualizar
  docker compose -f docker-compose.dev.yml up -d db
  docker compose -f docker-compose.dev.yml exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner' < dev.dump
  ```

  El volumen antiguo (`<proyecto>_postgres_data`) se puede borrar despues con
  `docker volume rm`.
- **Permisos:** el backend ya no corre como root. Si una subida falla con
  `Permission denied` en `media/`, borra las subcarpetas de `media/` creadas por
  la version anterior (o cambia sus permisos) para que se vuelvan a crear.

## Despliegue en produccion (Dokploy)

`docker-compose.yml` cumple la guia IIISyP:

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
                                                      └─▶ /api, /media, /static
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
BACKUP_PASSPHRASE=<contrasena larga y aleatoria para cifrar los backups>
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
| Compose Path | `./docker-compose.yml` |
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
- `https://midominio.com/django-admin/` **no** existe (el admin de Django esta
  apagado en produccion).
- Los datos siguen tras un redeploy.

### 6. Crear el administrador (a mano)

Desde la pestana *Terminal* del servicio `backend`:

```bash
python manage.py createsuperuser
```

Se hace a mano a proposito: la contrasena de administrador no queda guardada
en variables de entorno y la cuenta la crea una persona identificable.

### 7. Antes de cargar datos reales: backups fuera del servidor

**Requisito obligatorio antes de cargar datos reales.** El servicio `backup`
guarda las copias en el mismo VPS: si el servidor se pierde, se pierden tambien
las copias. Sin otro servidor ni nube, la version simple es:

1. **Cifrado:** definir `BACKUP_PASSPHRASE` en Dokploy (los backups ya se
   generan cifrados) y guardar esa contrasena en un gestor de contrasenas,
   **fuera** del servidor. Sin ella los backups no se pueden abrir. Si no esta
   definida, el sistema despliega igual, pero el servicio `backup` no genera
   copias y lo avisa en sus logs ("BACKUP_PASSPHRASE no configurada: backups
   desactivados").
2. **Descargarlos a otra maquina:** con `scripts/descargar-backup.ps1` desde la
   PC (ver [Backups](#backups)). Se descargan base de datos **y** `media`.
3. **Dos copias:** una en la PC y otra en un disco externo.
4. **Prueba de restauracion:** restaurar una copia en local (ver
   [Backups](#backups)) y comprobar que el sistema funciona con esos datos.
   Repetirla periodicamente.

### 8. HTTPS y HSTS

1. Comprobar que `https://midominio.com` carga con certificado valido.
2. Comprobar que `http://midominio.com` redirige a `https://` (opcion del
   dominio en Dokploy: la redireccion la hace el proxy, no Django).
3. Recien entonces activar HSTS en Dokploy (*Environment*):
   `SECURE_HSTS_SECONDS=3600` para probar y luego `31536000` (1 ano), y
   redesplegar. Una vez activo, los navegadores exigen HTTPS durante ese
   tiempo: no se deshace al instante.

### Probar la configuracion de produccion en local

```bash
docker network create dokploy-network   # solo la primera vez
docker compose -f docker-compose.yml --env-file .env.production.local up -d --build
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

### Que se guarda

El servicio `backup` de `docker-compose.yml` genera en el volumen
`backups`, cada `BACKUP_INTERVAL_HOURS` (24 h por defecto; el primero 10 min
despues de arrancar), dos archivos **cifrados**:

- `db_AAAAMMDD_HHMMSS.dump.gpg`: base de datos (`pg_dump`, formato custom).
- `media_AAAAMMDD_HHMMSS.tar.gz.gpg`: archivos subidos (evidencias, actas,
  resoluciones, fotos).

Se cifran con GPG (AES-256) usando `BACKUP_PASSPHRASE`, al vuelo: la copia sin
cifrar nunca se escribe en el disco del servidor. Se conservan
`BACKUP_KEEP_DAYS` dias (14 por defecto).

> **Sin `BACKUP_PASSPHRASE` los backups no se pueden abrir.** Guardala en un
> gestor de contrasenas, fuera del servidor. Si se cambia, los backups
> anteriores se siguen abriendo solo con la contrasena anterior.

Los backups quedan **en el mismo servidor**: "un backup que solo existe en el
mismo VPS no es un backup" (guia IIISyP). Hay que descargarlos a otra maquina
(requisito antes de cargar datos reales: paso 7 del despliegue).

Backup inmediato (en el servidor):

```bash
docker compose -f docker-compose.yml exec backup /backup.sh once
```

### Descargar a la PC (Windows)

Requisitos: Cliente OpenSSH de Windows (`ssh` y `scp`; viene con Windows 10/11,
si no: *Configuracion > Aplicaciones > Caracteristicas opcionales*) y un
usuario SSH del servidor que pueda usar Docker (root o del grupo `docker`).

Desde la carpeta del repositorio, en PowerShell:

```powershell
.\scripts\descargar-backup.ps1 -Servidor usuario@IP_DEL_SERVIDOR
```

Descarga el backup mas reciente (base de datos y media, **cifrados**) a
`Documentos\Backups-SistemaDocentes`. Opciones: `-Puerto` (SSH, 22 por
defecto), `-Destino` (otra carpeta) y `-Volumen` (si hay mas de un volumen
`..._backups`; se ven con `docker volume ls`). El script no acepta un destino
dentro del repositorio.

**Guarda 2 copias:** la de la PC y otra en un **disco externo** (copia los
`.gpg` tal cual, cifrados). Asi sobreviven a la perdida del servidor y a la de
la PC.

### Descifrar

Con Docker (no hace falta instalar GPG). En PowerShell, dentro de la carpeta de
los backups; pide la contrasena (`BACKUP_PASSPHRASE`):

```powershell
cd $HOME\Documents\Backups-SistemaDocentes
docker run --rm -it -v "${PWD}:/b" -w /b alpine sh -c "apk add -q gnupg && gpg --pinentry-mode loopback -o db.dump -d db_AAAAMMDD_HHMMSS.dump.gpg && gpg --pinentry-mode loopback -o media.tar.gz -d media_AAAAMMDD_HHMMSS.tar.gz.gpg"
```

Quedan `db.dump` y `media.tar.gz` **sin cifrar**: tienen datos personales.
Borralos cuando termines de restaurar y guarda solo los `.gpg`.

(Alternativa sin Docker: instalar Gpg4win y usar `gpg -o db.dump -d archivo.gpg`.)

### Restaurar en local (prueba de restauracion)

Reemplaza los datos de **desarrollo** por los del backup. Desde la carpeta del
repositorio, con el entorno de desarrollo (`docker-compose.dev.yml`):

1. Levantar solo la base y detener el backend:

   ```powershell
   docker compose -f docker-compose.dev.yml up -d db
   docker compose -f docker-compose.dev.yml stop backend
   ```

2. Restaurar la base de datos (ajusta la ruta de `db.dump`):

   ```powershell
   docker compose -f docker-compose.dev.yml cp $HOME\Documents\Backups-SistemaDocentes\db.dump db:/tmp/restore.dump
   docker compose -f docker-compose.dev.yml exec db sh -c 'pg_restore --clean --if-exists --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/restore.dump; rm /tmp/restore.dump'
   ```

3. Restaurar los archivos subidos en la carpeta `media` del repositorio (esta
   en `.gitignore`; conviene vaciarla antes):

   ```powershell
   tar -xzf $HOME\Documents\Backups-SistemaDocentes\media.tar.gz -C media
   ```

4. Arrancar todo y comprobar en <http://localhost:5173> que se puede entrar
   (los usuarios y contrasenas son los de produccion) y que se ven los datos
   y los archivos:

   ```powershell
   docker compose -f docker-compose.dev.yml up -d
   ```

5. Borrar `db.dump` y `media.tar.gz` (sin cifrar). Para volver a los datos de
   desarrollo, restaurar un backup de desarrollo o recrear la base.

### Restaurar en el servidor

Reemplazar la fecha por la del backup elegido. Base de datos (el backup se
descifra dentro del contenedor `backup`, que ya tiene la contrasena):

```bash
docker compose -f docker-compose.yml stop backend
docker compose -f docker-compose.yml exec backup sh -c \
  'export GNUPGHOME=/tmp/gnupg; mkdir -p -m 700 $GNUPGHOME; gpg --batch --quiet --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" -d /backups/db_AAAAMMDD_HHMMSS.dump.gpg | pg_restore --clean --if-exists --no-owner --dbname="$PGDATABASE"'
docker compose -f docker-compose.yml start backend
```

Archivos subidos (el volumen `media` esta montado de solo lectura en `backup`;
se restaura con un contenedor aparte. El nombre real de los volumenes lleva el
prefijo del proyecto: `docker volume ls`):

```bash
docker compose -f docker-compose.yml exec backup sh -c \
  'export GNUPGHOME=/tmp/gnupg; mkdir -p -m 700 $GNUPGHOME; gpg --batch --quiet --pinentry-mode loopback --passphrase "$BACKUP_PASSPHRASE" -o /backups/media_restaurar.tar.gz -d /backups/media_AAAAMMDD_HHMMSS.tar.gz.gpg'
docker run --rm -v <proyecto>_media_data:/media -v <proyecto>_backups:/backups \
  alpine sh -c 'tar -xzf /backups/media_restaurar.tar.gz -C /media && chown -R 10001:10001 /media && rm /backups/media_restaurar.tar.gz'
```

## Despues del despliegue

- HSTS: ver el paso 8 del despliegue (primero verificar HTTPS y la redireccion).
- Opcional: los informes PDF usan Verdana si se copian `verdana.ttf`,
  `verdanab.ttf` y `trebucit.ttf` en `backend/fondos/fonts/` (son fuentes con
  licencia de Microsoft y no se versionan). Sin ellas se usa Helvetica.
