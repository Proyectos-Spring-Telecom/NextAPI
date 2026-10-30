# Documentación NextAPI

**Para los equipos que consumen el API:**

| Documento | Para quién |
|-----------|-----------|
| [front-next.md](./front-next.md) | **Equipo del frontend de Next (Angular):** todo lo que el front debe cambiar o agregar (gateway de cámaras, equipos sin alta, órdenes de servicio, relojes, catálogo de eventos, incidentes) |
| [app-instaladores.md](./app-instaladores.md) | **Equipo de la App de instaladores (Flutter, técnico rol 8):** contrato de órdenes de servicio en campo, de punta a punta |

**Referencia:**

| Documento | Contenido |
|-----------|-----------|
| [contexto.md](./contexto.md) | **Documento único de contexto:** visión, colas AMQP, sockets, alarmas, webhooks, telemetría |
| [contratos.md](./contratos.md) | **Documento único de contratos:** alcance, API, monitoreo, AMQP, sockets, alarmas, webhooks |
| [BACKEND-CONTEXT.md](./BACKEND-CONTEXT.md) | Arquitectura del backend: módulos, auth, filtro por cliente, catálogos |
| [catalogo-eventos.md](./catalogo-eventos.md) | **Catálogo de eventos por equipo:** IdEvento, Estado, qué abre incidente y tratamiento en el front |
| [ordenes-servicio.md](./ordenes-servicio.md) | Órdenes de servicio: modelo, flujo con el CRM, código, autorizaciones, pruebas, PDF, despliegue |
| [remediacion-ordenes-servicio.md](./remediacion-ordenes-servicio.md) | Hallazgos de las revisiones independientes de órdenes de servicio y la prueba que demuestra cada corrección |
| [consumo-instalaciones-paginado-angular.md](./consumo-instalaciones-paginado-angular.md) | Front: listado paginado de instalaciones |
| [consumo-vehiculo-por-placa.md](./consumo-vehiculo-por-placa.md) | Consulta de vehículo por placa |
| [consumo-socket-alarmas-paneles.md](./consumo-socket-alarmas-paneles.md) | Socket de alarmas de paneles AX PRO |
| [webhook-shiftcontrol.md](./webhook-shiftcontrol.md) | Webhooks salientes hacia ShiftControl |

Swagger runtime: `/docs` (fuera del prefijo `/api`; ver `main.ts`).
README general de la solución: [`../README.md`](../README.md).
Batería de punta a punta de órdenes de servicio: [`../test/e2e-ordenes/README.md`](../test/e2e-ordenes/README.md) (`npm run test:e2e-ordenes`).
