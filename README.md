# app_ai_dashboard

Dashboard web personal para gestionar herramientas, fuentes, notas y enlaces de IA.

## Despliegue en NAS con Docker

Este repositorio ya incluye una arquitectura lista para contenedor:

- `web` (Nginx): sirve los HTML estáticos
- `api` (Node + Express): persistencia remota del estado
- `db` (PostgreSQL): base de datos centralizada
- `db_backup` (PostgreSQL client): copias automáticas de la base de datos

### 1) Configura contraseña de base de datos

Duplica `.env.example` como `.env` y cambia los valores de contraseña por
secretos reales:

- `POSTGRES_PASSWORD`
- `DATABASE_URL`

### 2) Configura usuario y contraseña iniciales

También debes cambiar estos valores en `.env`:

- `APP_BASIC_USER`: usuario admin inicial
- `APP_BASIC_PASSWORD`: contraseña admin inicial

Ese usuario se crea automáticamente en la base de datos al primer arranque.
Después podrás gestionar más usuarios desde la propia aplicación.

No subas `.env` a GitHub. El repositorio incluye `.env.example` como plantilla
segura sin secretos reales.

### 3) Levanta la aplicación

```bash
docker compose up -d --build
```

El servicio `db_backup` crea un backup al arrancar y después repite la copia cada
24 horas. Los archivos se guardan dentro del despliegue en:

```text
./backups/db/
```

Por defecto conserva 30 días de backups. Puedes cambiarlo en `.env`:

```env
BACKUP_INTERVAL_SECONDS=86400
BACKUP_RETENTION_DAYS=30
TZ=Europe/Madrid
```

Los backups son volcados PostgreSQL en formato custom (`.dump`) y cada archivo
lleva un `.sha256` al lado para comprobar integridad.

### 4) Accede

Abre:

```text
http://TU_NAS:8080
```

El navegador pedirá usuario y contraseña antes de cargar la aplicación.

## Gestión de usuarios (desde la app)

En `index.html` tienes el botón `👥 Usuarios` en la barra superior.  
Desde ahí puedes:

- añadir nuevos usuarios
- marcar usuarios como admin al crearlos
- cambiar contraseñas

## Persistencia remota

La app sincroniza automáticamente las claves de estado entre `localStorage` y la API (`/api/state/...`) mediante `remote-storage.js`.

Eso permite usar la misma información desde varios dispositivos apuntando al mismo NAS.

## Copias de seguridad

Para lanzar una copia manual sin esperar al siguiente ciclo:

```bash
docker compose run --rm db_backup sh /usr/local/bin/backup-postgres.sh once
```

Si necesitas restaurar un backup, para primero la API y restaura el dump elegido:

```bash
docker compose stop api
docker compose exec -T db pg_restore -U ai_dashboard -d ai_dashboard --clean --if-exists < backups/db/ai_dashboard_YYYYMMDD-HHMMSS.dump
docker compose start api
```

Antes de restaurar, conserva una copia del estado actual.
