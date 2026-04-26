# 🔌 Convención de Puertos - NAS Unraid

**Objetivo:** Evitar conflictos de puertos al desplegar múltiples aplicaciones.

## Puertos Reservados

### 🎯 Sistema / Infraestructura
| Puerto | Servicio | Notas |
|--------|----------|-------|
| 6080 | Unraid Web UI | Interfaz de administración |
| 9000 | Portainer Web UI | Gestor de contenedores |
| 8443 | Portainer Agent | API de agente |

### 🗂️ Aplicaciones Existentes
| Puerto | Aplicación | Host | URL |
|--------|-----------|------|-----|
| 8000 | paperless-ngx | ZALE.local | http://ZALE.local:8000 |
| 8095 | ai_dashboard (web) | ZALE.local | http://ZALE.local:8095 |

### ✅ Puertos Disponibles para Nuevas Apps
- **8001 - 8094** (94 puertos)
- **8096 - 8999** (904 puertos)
- **9001 - 9999** (999 puertos, evitar 9000)

## Convención de Asignación

### Nuevas apps en esta lista:
1. **Buscar disponibilidad** en rango 8001-8999
2. **Registrar en esta tabla** (arriba)
3. **Documentar en docker-compose.yml** el puerto usado
4. **Evitar puertos del sistema** (6080, 9000, 8443)

## Ejemplo: Nueva App
```yaml
services:
  my_app:
    ports:
      - "8050:80"  # Registrado aquí como "disponible desde 8001"
```

Luego actualizar tabla:
```
| 8050 | my_app | ZALE.local | http://ZALE.local:8050 |
```

---

**Última actualización:** 2026-04-26
