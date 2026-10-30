# Batería de punta a punta: órdenes de servicio

Recorre el flujo completo entre **CRM**, **NextAPI**, la **App del técnico** y **monitoreo**, con los dos sistemas reales sobre bases desechables. Sirve para probar cambios, experimentar y explicar el modelo a los usuarios: cada corrida deja un reporte narrado en `reportes/` (no se versiona).

## Cómo correrla

```bash
npm run test:e2e-ordenes
```

Requisitos:
- `mysqld`, `mysql` y `mysqladmin` (MySQL 8) en el sistema. La batería levanta su propio servidor en un directorio temporal, solo en 127.0.0.1 y con un puerto libre; nunca toca una base real.
- crmAPI compilado (`npm run build`) en `../crmAPI` (como en springfieldDev) o donde indique `CRM_API_DIR`.

Qué hace:
1. Crea las bases `Next` (esquema desde `src/entities` + `deploy/sql/OrdenesServicio*.sql`) y `CRM` (`crmAPI/sql/NNN_*.sql`), y siembra lo mínimo (roles, usuarios, catálogos, inventario).
2. Arranca NextAPI dentro de la prueba y crmAPI como proceso, **desde un directorio sin `.env`**, con secretos de prueba, RabbitMQ apagado y S3 y correo simulados.
3. Los actores usan solo sus endpoints reales: el CRM con su sesión, la App con la del técnico (rol 8), monitoreo (rol 5) y operación (rol 3).

## Escenarios

| # | Escenario | Qué valida |
|---|-----------|------------|
| 1 | Instalación de 2 unidades, de la venta al pago | Alta del cliente en Next desde el CRM; agendar = una orden por unidad en la App; pruebas que solo valida el operador (incluye paro de motor); cierre; PDF por WhatsApp y correo; no cumplida → por agendar; reagendar solo lo que falta; orden instalada y servicio activo; fecha real desde la orden; pago con tarifa normal y de visita en falso |
| 2 | Revisión que termina en cambio de equipo | Mantenimiento desde el CRM; corrección del tipo en campo; código de verificación dictado por el operador (intento fallido y correcto); histórico de la instalación; mantenimiento realizado en el CRM; se paga lo que se hizo |
| 3 | Vehículo con equipo existente | Autorización pendiente bloquea el cierre; rechazo → no cumplida cobrable; autorización con sobreprecio y cobro en fecha negociada → cargo único en cobranza; cierre con baja de la instalación anterior y alta en la misma transacción |
| 4 | Cancelaciones | El técnico no cancela; cancelar en el CRM una programada la cancela en la App; si ya inició, queda anotado y operación la cancela en Next con motivo |

Para agregar un escenario: un `describe` nuevo en `flujo-ordenes.e2e-spec.ts` usando `Actores` (llamadas de cada actor) y `Narrador` (pasos del reporte). Los escenarios corren en orden y comparten el cliente del escenario 1.
