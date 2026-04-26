# app_ai_dashboard

Dashboard web personal para gestionar herramientas, fuentes, notas y enlaces de IA.

## Despliegue en NAS con Docker

Este repositorio ya incluye una arquitectura lista para contenedor:

- `web` (Nginx): sirve los HTML estáticos
- `api` (Node + Express): persistencia remota del estado
- `db` (PostgreSQL): base de datos centralizada

### 1) Configura contraseña de base de datos

Edita `docker-compose.yml` y cambia `change_this_password` por una contraseña real
en:

- `db.environment.POSTGRES_PASSWORD`
- `api.environment.DATABASE_URL`

### 2) Configura usuario y contraseña iniciales

También debes cambiar estos valores en `api.environment`:

- `APP_BASIC_USER` (usuario admin inicial)
- `APP_BASIC_PASSWORD` (contraseña admin inicial)

Ese usuario se crea automáticamente en la base de datos al primer arranque.
Después podrás gestionar más usuarios desde la propia aplicación.

### 3) Levanta la aplicación

```bash
docker compose up -d --build
```

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
