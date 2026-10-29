# Documentación NextAPI

| Documento | Contenido |
|-----------|-----------|
| [contexto.md](./contexto.md) | **Documento único de contexto:** visión, colas AMQP, sockets, alarmas, webhooks, telemetría |
| [contratos.md](./contratos.md) | **Documento único de contratos:** alcance, API, monitoreo, AMQP, sockets, alarmas, webhooks |
| [catalogo-eventos.md](./catalogo-eventos.md) | **Catálogo de eventos por equipo:** IdEvento, Estado, qué abre incidente y tratamiento en el front |
| [ordenes-servicio.md](./ordenes-servicio.md) | Especificación de órdenes de servicio ligadas a Instalaciones (modelo, endpoints, cierre, despliegue) |
| [posicion-valida-gateway.md](./posicion-valida-gateway.md) | Análisis R1 (posición válida) para Gateway — fuera de NextAPI |
| [front-imei-string.md](./front-imei-string.md) | **Front:** IMEI como `string` — endpoints afectados y checklist |
| [webhook-trackcam-springtrackcam.md](./webhook-trackcam-springtrackcam.md) | Receptor HMAC Trackcam (SpringTrackCam) |
| [webhook-shiftcontrol.md](./webhook-shiftcontrol.md) | Webhooks salientes hacia ShiftControl |

Swagger runtime: `/docs` (fuera del prefijo `/api`; ver `main.ts`).  
README general de la solución: [`../README.md`](../README.md).
