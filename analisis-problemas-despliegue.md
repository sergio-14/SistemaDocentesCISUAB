# Análisis y corrección de las observaciones de despliegue

**Documento revisado:** `problemasrevisar.md` (repositorio `sergio-14/SistemaDocentesCISUAB`, commit `866e0a1`)
**Fecha:** 23/09/2026
**Alcance:** despliegue en producción con Dokploy (Traefik + HTTPS)
**Estado:** ✅ todas las observaciones corregidas y verificadas; 8 problemas adicionales encontrados y corregidos

---

## 1. Resumen

| | Cantidad |
|---|---|
| Observaciones del informe | 13 |
| Confirmadas | 11 |
| Confirmadas con matices (menos graves de lo que dice el informe) | 2 |
| Falsas | 0 |
| **Problemas adicionales encontrados en esta revisión** | **8** (2 de seguridad, 1 que impedía usar el sistema) |
| **Corregidos** | **Todos** |

Las observaciones del informe eran correctas. La configuración original estaba hecha para desarrollo local y no servía para producción. Tal como estaba, el sistema **se podía subir pero no usar**: el frontend respondía `403 Blocked request` en cualquier dominio real (ver 4.1).

Tras las correcciones se levantó el stack de producción completo en local y se probó simulando el tráfico de Traefik. **Todas las pruebas pasan** (sección 6).

---

## 2. Cómo se verificó

1. Se leyó el código y se reprodujo cada fallo en contenedores con `DEBUG=False`.
2. Se aplicaron las correcciones.
3. Se levantó `docker-compose.prod.yml` con valores de producción (en la primera versión con dos dominios; tras la adaptación a la guía IIISyP, con uno solo, ver sección 9) y se probó desde la red interna de Docker con las cabeceras que envía Traefik (`Host`, `X-Forwarded-Proto: https`).
4. Se ejecutó la suite de tests del backend: **13/13 pasan** (antes: 12/13).

---

## 3. Observaciones del informe

| # | Observación | Veredicto | Prueba del fallo (antes) | Corrección | Verificación (después) |
|---|---|---|---|---|---|
| 1 | PostgreSQL expuesto en 5432 | ✅ Cierto (crítico) | `ports: "5432:5432"`. Docker se salta UFW | `docker-compose.prod.yml` no publica puertos de la BD. En desarrollo solo se publica en `127.0.0.1` | Contenedor `db`: `5432/tcp` sin publicar al host |
| 2 | `DEBUG=True` por defecto | ✅ Cierto (crítico) | `settings.py`: `default=True` | `default=False`. El compose de producción fuerza `DEBUG=False` | Un 404 no muestra traza ni configuración |
| 3 | Bind mounts de código | ✅ Cierto (alto) | `./backend:/app`, `./frontend:/app`, `./media:/app/media` | Sin bind mounts en producción. Archivos subidos en el volumen `media_data` | Un archivo subido persiste tras `down` + `up` |
| 4 | Frontend con el servidor de desarrollo de Vite | ✅ Cierto (crítico) | `npm run dev`. Además bloquea dominios (ver 4.1) | `frontend/Dockerfile.prod`: `vite build` + nginx con fallback de SPA, gzip y caché | `/` → 200, rutas profundas de React Router → 200, JS con gzip y caché de 1 año |
| 5 | `network: host` en el build | ✅ Cierto (bajo) | Innecesario | Eliminado en ambos compose | Builds correctos |
| 6 | `runserver` | ✅ Cierto (crítico) | `exec python manage.py runserver` | Si `DEBUG=False`: gunicorn (3 workers, timeout 120 s). En desarrollo sigue `runserver` | Log: `Starting gunicorn 26.2.0`, 3 workers |
| 7 | Sin `STATIC_ROOT` | ✅ Cierto (alto) | `collectstatic` → `ImproperlyConfigured`. CSS del admin → 404 | `STATIC_ROOT` + WhiteNoise con nombres versionados | `163 static files copied`. CSS del admin → 200 |
| 8 | Sin `CSRF_TRUSTED_ORIGINS` ni `SECURE_PROXY_SSL_HEADER` | ✅ Cierto (alto) | Login del admin por HTTPS → **403 CSRF** | Ambas añadidas, más cookies `Secure` en producción | Login del admin por HTTPS → **302 /admin/**. Cookie `csrftoken` con `Secure` |
| 9 | `/media/` solo con `DEBUG=True` | ✅ Cierto (alto) | Con `DEBUG=False` → 404 | Ruta de media activa siempre, **con URL firmada** (ver 5.1) | Con firma → 200. Sin firma → 404 |
| 10 | Faltan `gunicorn`, `whitenoise` y `psycopg2-binary` | ⚠️ Parcial | `psycopg2-binary` sí se instalaba, pero fuera de `requirements.txt` y sin versión | Las tres añadidas con versión fija | Build correcto |
| 11 | La contraseña de la BD se interpola en `python -c` | ✅ Cierto (medio) | Contraseña `abc'def` → `SyntaxError` y bucle infinito silencioso | Lectura desde el entorno dentro de Python, 30 intentos máximo y error visible | Arranque con la contraseña `Pa'ss"w0rd…` → OK |
| 12 | CRLF en `entrypoint.sh` | ❌ No aplicaba | `.gitattributes` fuerza LF y el archivo está en LF | Se añadió igualmente el `sed` como protección | — |
| 13 | `.dockerignore` | ⚠️ Ya existían | Ya excluían `.env`. Solo faltaban `media/` y `staticfiles/` | Añadidos | — |
| — | `gcc`/`libpq-dev` en el Dockerfile | ✅ Cierto (bajo) | Innecesarios | Eliminados (imagen más pequeña, build más rápido) | Build correcto |

**Sobre las precisiones al informe:**
- El punto 12 **no era un problema** en este repositorio.
- En el punto 13, la afirmación de que el `.env` acababa dentro de la imagen era **incorrecta**.
- En el punto 10, `psycopg2-binary` sí se instalaba.

---

## 4. Problemas adicionales encontrados en esta revisión

### 4.1 El frontend no abría en ningún dominio real: 🔴 bloqueante

El servidor de desarrollo de Vite 7 solo acepta `localhost`. Con un dominio:

```
Host: sistema.midominio.com → 403
Blocked request. This host ("sistema.midominio.com") is not allowed.
```

El sistema se desplegaba pero los usuarios solo verían ese error. **Corregido** con el build de producción servido por nginx (punto 4).

### 4.2 Catálogo de indicadores modificable sin autenticación: 🔴 seguridad

`IndicadorCatalogoViewSet` (un `ModelViewSet`) tenía `permission_classes = [AllowAny]`: cualquiera en Internet podía **crear, editar, borrar e importar** indicadores del POA. Prueba: un POST anónimo llegaba a la validación (400) en lugar de ser rechazado (401).

**Corrección:**
- `IndicadorCatalogoViewSet`, `IndicadorCatalogoReadOnlyViewSet` y `PartidaPresupuestariaViewSet` ahora exigen usuario autenticado.
- Se añadió `DEFAULT_PERMISSION_CLASSES = IsAuthenticated`, para que ninguna vista futura quede pública por olvido.
- Verificado: anónimo → 401. Autenticado → 200. Todas las demás vistas ya tenían permisos explícitos (revisado de forma automática sobre todas las URLs).

> Decisión pendiente del equipo: el catálogo de *items* limita la escritura al rol elaborador, pero la pantalla de indicadores del frontend permite editar a cualquier usuario del POA. Se mantuvo ese comportamiento (solo se bloqueó el acceso anónimo). Si se quiere restringir al elaborador, basta con usar `IsElaboradorOrReadOnly`.

### 4.3 Riesgo de perder todas las fotos de perfil y logos: 🔴 datos

Las fotos y los logos se guardan cifrados con Fernet. El código busca `PROFILE_IMAGE_ENCRYPTION_KEY`, pero **esa variable nunca se definía en `settings.py`**, así que la clave siempre se derivaba de `SECRET_KEY`. Cambiar `SECRET_KEY` (algo normal al pasar a producción) dejaba **todas las imágenes ilegibles sin ningún aviso**.

**Corrección:** `PROFILE_IMAGE_ENCRYPTION_KEY` ahora se lee del entorno y se usa `MultiFernet`: cifra con la clave nueva y sigue descifrando con la antigua. Verificado: una imagen cifrada con la clave antigua se lee con la nueva configuración.

### 4.4 Los reportes Excel salían sin el logo de la UAB en Docker: 🟠 funcional

`reportes/excel/seguimiento.py` leía el logo de `../frontend/public/images/`, una carpeta que no existe en el contenedor del backend. Es la causa del test que fallaba (`test_excel_seguimiento_copia_la_matriz_institucional`). **Corrección:** el logo se copió a `backend/poa_document/reportes/assets/`. El test ahora pasa.

### 4.5 La carpeta `media/` de la raíz no estaba en `.gitignore`: 🟠 datos

El compose guarda ahí los archivos subidos (evidencias, actas…). Un `git add .` los habría subido al repositorio. **Corregido.**

### 4.6 Faltaba `.env.example`: 🟡

El README decía `cp .env.example .env`, pero el archivo no existía: la instalación documentada fallaba en el primer paso. **Creado** con todas las variables comentadas.

### 4.7 `djangorestframework==3.14.0` con Django 5.2: 🟡

No tenía soporte oficial. **Actualizado a 3.16.1**, y los 13 tests pasan.

### 4.8 Variables obligatorias sin validar: 🟡

Si faltaba una variable en Dokploy, el sistema arrancaba mal configurado. **Corrección:** `docker-compose.prod.yml` se detiene indicando qué variable falta (`${VAR:?Falta VAR}`), y el build del frontend falla si no hay `VITE_API_URL`.

---

## 5. Cambios sobre las soluciones que proponía el informe

### 5.1 `/media/` con URLs firmadas, no públicas

El informe proponía servir `/media/` sin control: evidencias, actas de entrega y respaldos de compras quedarían accesibles para cualquiera con la URL, **sin caducidad**.

Tampoco servía exigir el JWT, porque el frontend muestra los archivos con `<img src>` y `<a href>`, que no pueden enviar esa cabecera.

**Solución aplicada** (`backend/config/media.py`):
- Cada URL de archivo generada por la API lleva una firma con marca de tiempo (`?t=…`), válida 12 h (configurable).
- Sin firma, con la firma alterada o con la firma de otro archivo → 404. Los intentos de salir de la carpeta (`../`) también se bloquean.
- No hizo falta cambiar el frontend: las URLs las genera el propio almacenamiento de Django.

### 5.2 Desarrollo y producción separados

En lugar de reemplazar `docker-compose.yml`, se creó `docker-compose.prod.yml`. El entorno de desarrollo mantiene la recarga en caliente.

---

## 6. Verificación del stack de producción

Resultado de las pruebas contra `docker-compose.prod.yml`, simulando Traefik:

| Prueba | Resultado |
|---|---|
| Frontend `/` | 200 |
| Ruta profunda de la SPA (`/poa/catalogos/indicadores`) | 200 |
| Bundle JS: gzip + `Cache-Control` de 1 año | ✅ |
| URL de la API de producción incrustada en el JS | ✅ |
| `/admin/login/` | 200 |
| CSS del admin (WhiteNoise, nombre versionado) | 200 |
| API sin autenticar | 401 |
| Login JWT | 200 |
| API con JWT + cabecera CORS correcta | 200, `https://midominio.com` |
| Host no permitido (`evil.com`) | 400 |
| Error 404 sin trazas de depuración | ✅ |
| Cookie CSRF con `Secure` | ✅ |
| Login del admin por HTTPS (antes 403) | 302 → `/admin/` |
| Archivo de media con firma / sin firma | 200 / 404 |
| Persistencia de archivos y BD tras reiniciar | ✅ |
| Contraseña de BD con `'` `"` | Arranca correctamente |
| `manage.py check --deploy` | Solo 2 avisos, intencionados (abajo) |

Los dos avisos restantes de `check --deploy` son decisiones conscientes:
- `SECURE_SSL_REDIRECT`: la redirección a HTTPS la hace Traefik. Activarla en Django puede crear bucles.
- `SECURE_HSTS_SECONDS`: configurable por variable. Se recomienda activarlo cuando HTTPS esté estable, porque HSTS es difícil de revertir.

---

## 7. Archivos modificados

| Archivo | Cambio |
|---|---|
| `docker-compose.yml` | Solo desarrollo: sin `network: host`, BD solo en `127.0.0.1` |
| `docker-compose.prod.yml` | **Nuevo:** stack de producción |
| `.env.example` | **Nuevo:** todas las variables documentadas |
| `.gitignore` | Excluye `/media/` y `backend/staticfiles/` |
| `README.md` | Guía de despliegue en Dokploy |
| `backend/Dockerfile` | Sin apt/gcc; normaliza CRLF |
| `backend/entrypoint.sh` | Espera segura de la BD; gunicorn o runserver según `DEBUG` |
| `backend/requirements.txt` | DRF 3.16.1; gunicorn, whitenoise, psycopg2-binary |
| `backend/.dockerignore` | Excluye `media/` y `staticfiles/` |
| `backend/config/settings.py` | DEBUG seguro, WhiteNoise, `STATIC_ROOT`, CSRF/proxy, cookies seguras, permisos por defecto, clave de cifrado, logging |
| `backend/config/urls.py` | Ruta de media firmada |
| `backend/config/media.py` | **Nuevo:** almacenamiento y vista de URLs firmadas |
| `backend/fondos/models.py` | Cifrado con `MultiFernet` (compatible con los datos existentes) |
| `backend/poa_document/api/views.py` | Catálogos sin acceso anónimo |
| `backend/poa_document/reportes/excel/seguimiento.py` | Logo dentro del backend |
| `backend/poa_document/reportes/assets/LOGOUAB.png` | **Nuevo** |
| `frontend/Dockerfile.prod` | **Nuevo:** build + nginx |
| `frontend/nginx.conf` | **Nuevo:** SPA, gzip, caché, cabeceras de seguridad |

No se modificaron modelos de datos ni migraciones.

---

## 8. Pendientes de despliegue resueltos

| Pendiente | Solución | Verificación |
|---|---|---|
| Backups de la BD y de `media_data` | Servicio `backup` en `docker-compose.prod.yml`: `pg_dump` + `tar` de media cada 24 h, conservando 14 días, en el volumen `backups`. El primero 10 min después de arrancar | Backup generado (BD 232 KB + media). **Restauración probada:** se borraron un usuario y un archivo, y se recuperaron los dos |
| Variables de entorno | Valores con caracteres seguros para Docker/Dokploy, documentados en `.env.example` y el README | Stack de producción levantado con esas variables |

## 9. Adaptación a la guía del VPS IIISyP

Guía: <https://github.com/sergio-14/Documentacion_IIISyP>. Estado después de los cambios:

| Regla de la guía | Antes | Ahora | Verificación |
|---|---|---|---|
| Red `dokploy-network` en el servicio que recibe tráfico | ❌ No existía (Traefik daría 502/404) | ✅ Servicio `frontend` | Tráfico simulado de Traefik por `dokploy-network` → 200 |
| PostgreSQL 16 | ❌ 15 | ✅ 16 en producción y desarrollo; backup con `pg_dump` 16 | `PostgreSQL 16.15`; datos de desarrollo migrados sin pérdida |
| Usuario no-root | ❌ root | ✅ `app` (UID 10001) | `id` → `uid=10001(app)` |
| Variables estándar (`DJANGO_*`, `POSTGRES_*`) | ❌ `SECRET_KEY`, `DB_NAME`... | ✅ Nombres estándar; los antiguos se siguen aceptando | Desarrollo y producción arrancan |
| Un dominio por proyecto, entrando por nginx :80 | ❌ Dos dominios | ✅ nginx reenvía `/api`, `/django-admin`, `/media`, `/static` | SPA, API, admin y media por el mismo dominio |
| Healthcheck en cada servicio | ⚠️ Solo `db` | ✅ `db`, `backend` (`/health/`), `frontend`, `backup` | Todos `healthy` |
| Sin `ports:`/`container_name`, volúmenes con nombre, `restart`, `:?` | ✅ | ✅ | `docker compose config` válido |

**Problemas encontrados y resueltos durante la adaptación:**

1. **Choque de rutas `/admin`:** la app React tiene su panel en `/admin`, así que con un solo dominio chocaba con el admin de Django. Se movió el de Django a `/django-admin/`, y los dos enlaces escritos a mano en `fondos/admin.py` pasaron a `reverse()`. Además, `/admin/` es la primera ruta que prueban los bots.
2. **Volumen de archivos subidos creado como root:** si el servicio `backup` arrancaba antes que el backend, el volumen `media_data` quedaba con dueño root y el backend no-root **no podía guardar ninguna evidencia** (`PermissionError`). Se añadió el servicio de un solo uso `media-permisos`, que ajusta el dueño antes de arrancar el backend y el backup. Verificado desde cero con volúmenes nuevos.
3. **Límite de subida de nginx (1 MB por defecto):** habría rechazado evidencias y Excel grandes. Ahora es de 50 MB. Verificado: una subida multipart de 1,8 MB pasa, y una de 60 MB se rechaza con 413.
4. **nginx y el redeploy del backend:** si el backend cambia de IP, un nginx sin resolver dinámico seguiría apuntando a la IP vieja (502). Se añadió `resolver 127.0.0.11`. Verificado forzando un cambio de IP (`172.21.0.3 → 172.21.0.6`) sin reiniciar nginx.

**Diferencias intencionadas con las plantillas de la guía:**
- `/media/` con URLs firmadas en lugar de público.
- Superusuario creado a mano en lugar de desde variables de entorno.
- Archivos Docker dentro de `backend/` y `frontend/` en lugar de `docker/`, porque el proyecto tiene dos aplicaciones.

## 10. Pendiente (solo en el servidor, fuera del código)

- [ ] Cargar las variables de entorno en Dokploy. Guardar `DJANGO_SECRET_KEY` y `PROFILE_IMAGE_ENCRYPTION_KEY` en un lugar seguro.
- [ ] Dokploy: *Compose Path* `./docker-compose.prod.yml`. Dominio: servicio `frontend`, puerto 80, HTTPS. Un registro DNS tipo A hacia el VPS.
- [ ] Crear el superusuario **a mano** (`python manage.py createsuperuser` en el contenedor `backend`). No se automatiza a propósito: guardaría la contraseña de administrador en variables de entorno y recrearía la cuenta si se elimina.
- [ ] Copiar periódicamente los backups **fuera** del servidor (S3, otra máquina).
- [ ] (Opcional) Copiar las fuentes Verdana/Trebuchet a `backend/fondos/fonts/`.
- [ ] (Opcional) Activar HSTS cuando HTTPS esté estable.
