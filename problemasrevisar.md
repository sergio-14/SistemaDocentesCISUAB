# Guía de despliegue en Dokploy: Django REST + React (Vite) + PostgreSQL

Revisión completa de `docker-compose.yml`, `Dockerfile`, `entrypoint.sh`, `settings.py`, `urls.py` y `requirements.txt`, con todos los cambios necesarios para producción.

---

## 1. Resumen de problemas encontrados

| Archivo | Problema | Gravedad |
|---|---|---|
| `docker-compose.yml` | Puerto de PostgreSQL expuesto (`5432:5432`) | Crítico |
| `docker-compose.yml` | `DEBUG=True` por defecto | Crítico |
| `docker-compose.yml` | Bind mounts de código (`./backend:/app`, `./frontend:/app`) | Alto |
| `docker-compose.yml` | Frontend con servidor de desarrollo de Vite (5173) | Crítico |
| `docker-compose.yml` | `network: host` en el build | Medio |
| `entrypoint.sh` | Usa `runserver` (servidor de desarrollo) | Crítico |
| `settings.py` | `DEBUG` por defecto en `True` | Crítico |
| `settings.py` | No hay `STATIC_ROOT`: `collectstatic` falla y el admin sale sin estilos | Alto |
| `settings.py` | Falta `CSRF_TRUSTED_ORIGINS` y `SECURE_PROXY_SSL_HEADER`: el login del admin dará 403 detrás de Traefik | Alto |
| `urls.py` | `/media/` solo se sirve con `DEBUG=True`: en producción los archivos subidos darán 404 | Alto |
| `requirements.txt` | Faltan `gunicorn`, `whitenoise` y `psycopg2-binary` | Alto |
| `entrypoint.sh` | La contraseña de la BD se interpola dentro de `python -c` y se rompe si tiene comillas | Medio |
| `Dockerfile` | `gcc`/`libpq-dev` innecesarios; `psycopg2-binary` fuera de requirements | Bajo |

---

## 2. Backend

### 2.1 `requirements.txt`

Agrega al final:

```txt
gunicorn==23.0.0
whitenoise==6.9.0
psycopg2-binary==2.9.10
```

> Opcional pero recomendable: `djangorestframework==3.14.0` es anterior a Django 5.2 y puede dar advertencias. Puedes subirlo a `3.16.x` y probarlo en local antes de desplegar.

### 2.2 `Dockerfile`

Con `psycopg2-binary` y las ruedas precompiladas de pandas, numpy, pillow y reportlab ya no necesitas `gcc` ni `apt-get`. Esto elimina el hack del `sed` y acelera el build.

```dockerfile
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

COPY . .

# Elimina saltos de línea de Windows (CRLF) que rompen el script
RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/app/entrypoint.sh"]
```

> Si el build falla por alguna librería que necesite compilar, vuelve a agregar `gcc libpq-dev`. No debería hacer falta.

### 2.3 `entrypoint.sh`

```sh
#!/bin/sh
set -e

echo "Esperando a la base de datos..."
python - <<'EOF'
import os, sys, time, psycopg2

for _ in range(30):
    try:
        psycopg2.connect(
            host=os.environ["DB_HOST"],
            port=os.environ.get("DB_PORT", "5432"),
            user=os.environ["DB_USER"],
            password=os.environ["DB_PASSWORD"],
            dbname=os.environ["DB_NAME"],
        ).close()
        sys.exit(0)
    except psycopg2.OperationalError:
        time.sleep(2)
print("La base de datos no respondió a tiempo")
sys.exit(1)
EOF

echo "Ejecutando migraciones..."
python manage.py migrate --noinput

echo "Recolectando archivos estáticos..."
python manage.py collectstatic --noinput

echo "Arrancando gunicorn..."
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 3 \
    --timeout 120 \
    --access-logfile -
```

El `--timeout` está en 120 s porque el endpoint `generar-reporte-general` usa pandas y reportlab. Con el valor por defecto (30 s), gunicorn mataría el proceso si el reporte tarda.

### 2.4 `settings.py`

**a) DEBUG seguro por defecto**

```python
DEBUG = config('DEBUG', default=False, cast=bool)
```

**b) WhiteNoise en el middleware**, justo después de `SecurityMiddleware`:

```python
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',   # ← nuevo
    'django.contrib.sessions.middleware.SessionMiddleware',
    # ... el resto igual
]
```

**c) Archivos estáticos**

```python
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}
```

**d) Detrás de Traefik / HTTPS**

```python
CSRF_TRUSTED_ORIGINS = config('CSRF_TRUSTED_ORIGINS', default='', cast=Csv())
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

if not DEBUG:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
```

> No actives `SECURE_SSL_REDIRECT`: Traefik ya maneja la redirección y podrías crear un bucle.

### 2.5 `urls.py`

Reemplaza el bloque `if settings.DEBUG:` por:

```python
from django.urls import path, include, re_path
from django.views.static import serve

urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
```

Esto funciona bien para un sistema interno con poco tráfico. Ten en cuenta que los archivos de `/media/` quedan **públicos para quien tenga la URL**. Si son documentos sensibles, lo correcto es servirlos desde una vista que verifique autenticación.

### 2.6 `backend/.dockerignore`

Sin esto, `COPY . .` mete basura y hasta tu `media/` local o `.env` dentro de la imagen.

```
__pycache__/
*.pyc
.env
media/
staticfiles/
.git
venv/
```

---

## 3. Frontend

### 3.1 `Dockerfile` (multi-stage con nginx)

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 3.2 `nginx.conf` (soporte para SPA)

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    location / {
        try_files $uri /index.html;
    }
}
```

> `VITE_API_URL` se incrusta en tiempo de **build**, no de ejecución. Por eso va como `args` y debe ser la URL pública del backend (ej. `https://api.tudominio.com`).

### 3.3 `frontend/.dockerignore`

```
node_modules
dist
.env
.git
```

---

## 4. `docker-compose.yml` final

Sin el puerto de PostgreSQL expuesto, sin bind mounts de código, sin `network: host`, y con `restart` y valores seguros por defecto. WhiteNoise sirve los estáticos, por lo que solo hace falta el volumen `media_data`.

```yaml
services:
  db:
    image: postgres:15-alpine
    restart: unless-stopped
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=${DB_NAME}
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./backend
    restart: unless-stopped
    volumes:
      - media_data:/app/media
    expose:
      - "8000"
    environment:
      - SECRET_KEY=${SECRET_KEY}
      - DEBUG=${DJANGO_DEBUG:-False}
      - ALLOWED_HOSTS=${ALLOWED_HOSTS}
      - DB_NAME=${DB_NAME}
      - DB_USER=${DB_USER}
      - DB_PASSWORD=${DB_PASSWORD}
      - DB_HOST=db
      - DB_PORT=5432
      - CORS_ALLOWED_ORIGINS=${CORS_ALLOWED_ORIGINS}
      - CSRF_TRUSTED_ORIGINS=${CSRF_TRUSTED_ORIGINS}
    depends_on:
      db:
        condition: service_healthy

  frontend:
    build:
      context: ./frontend
      args:
        VITE_API_URL: ${VITE_API_URL}
    restart: unless-stopped
    expose:
      - "80"
    depends_on:
      - backend

volumes:
  postgres_data:
  media_data:
```

---

## 5. Configuración en Dokploy

### 5.1 Variables de entorno (pestaña *Environment*)

```env
DB_NAME=nombre_bd
DB_USER=usuario_bd
DB_PASSWORD=<contraseña larga y aleatoria>
SECRET_KEY=<clave larga y aleatoria>
DJANGO_DEBUG=False
ALLOWED_HOSTS=api.tudominio.com
CORS_ALLOWED_ORIGINS=https://tudominio.com
CSRF_TRUSTED_ORIGINS=https://tudominio.com,https://api.tudominio.com
VITE_API_URL=https://api.tudominio.com
```

Genera la `SECRET_KEY` con:

```bash
python -c "from django.core.management.utils import get_random_secret_key as g; print(g())"
```

### 5.2 Dominios (pestaña *Domains*)

| Servicio | Puerto | Dominio de ejemplo |
|---|---|---|
| `frontend` | 80 | `tudominio.com` |
| `backend` | 8000 | `api.tudominio.com` |

Dokploy con Traefik gestiona el certificado SSL automáticamente. Asegúrate de que los registros DNS (tipo A) de ambos dominios apunten a la IP de tu VPS.

---

## 6. Después del primer despliegue

1. **Crear el superusuario:** abre la terminal del contenedor `backend` en Dokploy y ejecuta:
   ```bash
   python manage.py createsuperuser
   ```
2. **Verificar dominios:** `frontend` → puerto 80, `backend` → puerto 8000.
3. **Prueba rápida:** visita `https://api.tudominio.com/admin/`. Si carga con estilos y el login funciona, los estáticos, CSRF y HTTPS están bien.
4. **Prueba del frontend:** abre `https://tudominio.com`, inicia sesión y revisa en la consola del navegador que no haya errores de CORS.

---

## 7. Detalles a confirmar

- **`VITE_API_URL`:** si tu código React llama a `${VITE_API_URL}/api/...`, entonces `https://api.tudominio.com` (sin `/api`) es correcto. Si ya espera la ruta completa, ajústalo.
- **Backups:** el volumen `postgres_data` es tu única copia de los datos. Configura los backups de base de datos de Dokploy (pueden ir a S3 o similar) **antes** de meter datos reales.
- **Archivos en `media/`:** el volumen `media_data` persiste entre despliegues, pero también debería entrar en tu estrategia de respaldo.
- **Si el build del frontend falla:** confirma que existe `package-lock.json` (requerido por `npm ci`) y que `npm run build` funciona en local.

---

## 8. Checklist final

- [ ] `gunicorn`, `whitenoise` y `psycopg2-binary` agregados a `requirements.txt`
- [ ] `Dockerfile` y `entrypoint.sh` del backend actualizados
- [ ] `settings.py`: `DEBUG=False` por defecto, WhiteNoise, `STATIC_ROOT`, `CSRF_TRUSTED_ORIGINS`, `SECURE_PROXY_SSL_HEADER`
- [ ] `urls.py`: ruta `/media/` sin depender de `DEBUG`
- [ ] `Dockerfile` y `nginx.conf` del frontend creados
- [ ] `.dockerignore` en `backend/` y `frontend/`
- [ ] `docker-compose.yml` sin puerto 5432 ni bind mounts
- [ ] Variables de entorno cargadas en Dokploy
- [ ] Dominios asignados y DNS apuntando al VPS
- [ ] Superusuario creado
- [ ] Backups de base de datos configurados