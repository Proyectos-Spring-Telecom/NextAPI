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
1. Crea la base `Next` con **el esquema real de producción** (`esquema/next-produccion.sql`, `mysqldump --no-data --routines --triggers` sin `DEFINER`) más los `deploy/sql/OrdenesServicio*.sql`, y comprueba que las tablas de órdenes coincidan con las entidades (columnas, tipos, nulos e índices; la prueba "Esquema" falla si falta un SQL de despliegue). Crea `CRM` con `crmAPI/sql/NNN_*.sql` y siembra lo mínimo (roles, usuarios, catálogos, inventario). La zona horaria es la de producción (MySQL `-06:00`, NextAPI `DB_TZ=-00:00`).

   Para regenerar el esquema cuando cambie producción:
   ```bash
   mysqldump -u root -p --no-data --routines --triggers Next > ~/next-esquema.sql
   ```
   y reemplazar `esquema/next-produccion.sql` quitando las cláusulas `DEFINER`.
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

## Otras suites

| Suite | Qué valida |
|-------|------------|
| `robustez.e2e-spec.ts` | Un caso por hallazgo de la revisión (concurrencia, Next caído, lento, respuesta perdida o 401 con el proxy de fallas, repeticiones de firma, permisos); numerados como en `docs/remediacion-ordenes-servicio.md` |
| `reglas-flujo.e2e-spec.ts` | Reglas del flujo contra MySQL real y la comparación del esquema |
| `acceso.e2e-spec.ts` | Quién ve qué: fugas F1–F5 del diagnóstico y CRUD C1–C7 |
| `activos.e2e-spec.ts` | Motor de activos, fase A: transiciones de estatus, historial de vida, baja archivada, reactivación, concurrencia y origen de la orden |
| `vigencia.e2e-spec.ts` | Motor de activos, fase D: fecha real de instalación (solo hacia atrás, traslapes, roles, evidencia) y posiciones recortadas a la vigencia en histórico, distancia, monitoreo, consola e incidentes |
| `ingesta.e2e-spec.ts` | Motor de activos, fase E: ingesta por estatus del equipo (sin instalación se guarda y no abre incidentes al cliente; inservible abre uno para monitoreo; huérfanos), equipos sin instalación y caché de la búsqueda del equipo |
| `vigilancia.e2e-spec.ts` | Motor de activos, fase E: vigilancia de transmisión (umbral por tipo, sin primera transmisión, una evaluación por día, agrupación por compañía, taller, cierre al transmitir o con la baja, permisos) |
