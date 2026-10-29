# NextAPI

Backend de la plataforma **Next**, de monitoreo vehicular y gestión de flotas de Spring Telecom. Es el **Source of Truth** del ecosistema: clientes, usuarios, productos, dispositivos, instalaciones, posiciones GPS, alarmas de panel e incidentes se crean y modifican aquí. Otros sistemas (ShiftControl, springTrackCam, springTrackGas, Server_Socket, SpringPanel, frontend) se integran por REST, Socket.IO, RabbitMQ o webhooks; ninguno escribe directo en la base `Next`.

- **Versión:** 2.2.0
- **Documentación funcional:** [`docs/contexto.md`](./docs/contexto.md) (visión y flujos) y [`docs/contratos.md`](./docs/contratos.md) (contratos HTTP, Socket y AMQP, inventario de endpoints)
- **Swagger:** `http://localhost:3004/docs`

---

## Stack

| Capa | Tecnología |
|------|------------|
| Framework | NestJS 11 + TypeScript |
| Base de datos | MySQL 8 (esquema `Next`) con TypeORM (`synchronize: false`) |
| Autenticación | JWT (Passport) + refresh token, NIP de operador, login facial (BehaviorIQ) |
| Tiempo real | Socket.IO (namespaces `/monitoreo` y `/alarmas`) |
| Mensajería | RabbitMQ (amqplib): colas AVL (JT808 + Jimi) y AX PRO |
| Archivos | AWS S3 |
| Correo | Nodemailer (SMTP) |
| Validación | class-validator (DTOs) + Joi (variables de entorno) |
| Documentación API | Swagger (`@nestjs/swagger`) |
| Pruebas | Jest + ts-jest |

---

## Requisitos

- Node.js 22 y npm 10
- Acceso a MySQL 8 con el esquema `Next` (las tablas, triggers y stored procedures ya existen; la app no crea esquema)
- RabbitMQ (opcional en desarrollo: con `RABBITMQ_ENABLED=false` la API arranca sin consumir colas)
- Credenciales de AWS S3 y de una cuenta SMTP

---

## Instalación y arranque

```bash
npm install
cp .env.example .env      # en Windows: copy .env.example .env
# Completar .env con los valores del entorno
npm run start:dev
```

La API queda en `http://localhost:3004/api` y Swagger en `http://localhost:3004/docs`.

### Scripts

| Script | Uso |
|--------|-----|
| `npm run start:dev` | Desarrollo con recarga automática |
| `npm run start:debug` | Desarrollo con inspector de Node |
| `npm run build` | Compila a `dist/` |
| `npm run start:prod` | Ejecuta la versión compilada (`node dist/main`) |
| `npm test` | Pruebas unitarias (`src/**/*.spec.ts`) |
| `npm run test:cov` | Pruebas con cobertura (`coverage/`) |
| `npm run lint` | ESLint con autocorrección |
| `npm run format` | Prettier sobre `src/` |

> `test:e2e` y `generate:entities` están declarados en `package.json`, pero hoy no funcionan: no existen la carpeta `test/` ni `scripts/generate-entities.ts`.

---

## Variables de entorno

Se validan con Joi al arrancar (`src/app.module.ts`); si falta una obligatoria, la app no levanta. La plantilla completa y comentada está en [`.env.example`](./.env.example) y el detalle por variable en [`docs/contratos.md` §16](./docs/contratos.md).

| Grupo | Variables | Obligatorias |
|-------|-----------|--------------|
| Servidor | `PORT` (3004), `NODE_ENV`, `TZ` (`America/Mexico_City`), `LOG_LEVEL` (`log`) | No |
| MySQL | `DB_HOST`, `DB_USER`, `DB_DATABASE` · `DB_PORT`, `DB_PASSWORD`, `DB_TZ`, `DB_CONNECTION_LIMIT`, `DB_LOGGING` | Las tres primeras |
| JWT | `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` · `JWT_CONFIRMACION` | Las tres primeras |
| Rate limit | `THROTTLE_*_LIMIT` / `THROTTLE_*_TTL_MS` (login, pin, verify, recuperación, confirmación, refresh, logout) · `THROTTLE_VALIDATE_FACE_*` | Sí, salvo `VALIDATE_FACE` |
| S3 | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `UPLOAD_MAX_SIZE` | Sí |
| Correo | `HOST`, `SMTP`, `E_MAIL`, `MAIL_PASSWORD` · `MAIL_FRONTEND_URL`, `MAIL_FRONTEND_URL_NEXT` | Las cuatro primeras |
| Login facial | `BEHAVIORIQ_BASE_URL`, `BEHAVIORIQ_USER_NAME`, `BEHAVIORIQ_PASSWORD`, `BEHAVIORIQ_*_TIMEOUT_MS` | Para usar el login facial |
| Ingest de paneles | `GATEWAY_HMAC_SECRET` (mín. 16) · `GATEWAY_API_KEY`, `SIA_OFFLINE_THRESHOLD_MS` | `GATEWAY_HMAC_SECRET` |
| Webhooks / Trackcam | `WEBHOOK_SUBSCRIBERS`, `WEBHOOK_SECRET`, `TRACKCAM_WEBHOOK_URL`, `TRACKCAM_GATEWAY_URL` | No |
| RabbitMQ | `RABBITMQ_ENABLED`, `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USERNAME`, `RABBITMQ_PASSWORD`, `RABBITMQ_VHOST`, `RABBITMQ_EXCHANGE`, `RABBITMQ_DLX` | No (con default) |
| Colas | `RABBITMQ_QUEUE_AXPRO_*`, `RABBITMQ_QUEUE_AVL_*`, `RABBITMQ_PREFETCH*` | No (con default) |
| Consumidor | `RABBITMQ_MAX_RETRIES`, `RABBITMQ_HEARTBEAT`, `RABBITMQ_RECONNECT_MAX_DELAY`, `RABBITMQ_MAX_CONCURRENT_DB`, `RABBITMQ_DB_RETRY_MAX_DELAY_MS`, `RABBITMQ_DB_HOLD_MAX_MS`, `CONSUMER_WATCHDOG_MINUTES`, `QUEUE_IDLE_WARN_SECONDS`, `DEVICE_LOOKUP_CACHE_TTL_SEC` | No (con default) |

Notas:
- Las consultas SQL solo se registran con `DB_LOGGING=true` (ya no dependen de `NODE_ENV`).
- `LOG_LEVEL` (`fatal|error|warn|log|debug|verbose`, default `log`): lo que se repite por mensaje de la cola (ingesta, caché de equipos, JWT aceptado) va en `debug`.
- Logs en `/var/log/nextAPI*.log`: rotación con [`deploy/logrotate/nextapi`](./deploy/logrotate/nextapi) (60 días).
- `DB_CONNECTION_LIMIT` debe ser mayor que `RABBITMQ_MAX_CONCURRENT_DB` para que el consumidor no deje sin conexiones a la API.
- `.env` y `.env.example` están en `.gitignore`. No subas credenciales al repositorio.

---

## Estructura del proyecto

```text
src/
├── main.ts                 Arranque: prefijo /api, CORS, ValidationPipe, Swagger, Socket.IO
├── app.module.ts           Módulo raíz: validación Joi, TypeORM, throttler, módulos de negocio
├── auth/                   Login, refresh, logout, me, NIP, login facial, recuperación de contraseña
├── usuarios/ roles/ permisos/ modulos/   Usuarios y seguridad
├── clientes/               Clientes (multipart) y jerarquía
├── operadores/             Operadores y licencias (multipart)
├── productos/              Vehículos, activos, inmuebles, personas
├── instalaciones/          Instalaciones con versionado e histórico
├── dispositivos/           Dispositivos genéricos, Trackcam y paneles de alarma
├── sims/                   SIMs
├── monitoreo/              Listado GPS, consola, histórico, socket /monitoreo, proxy foto/video
├── alarmas/                Paneles SIA: consulta, ingest HMAC, socket /alarmas
├── incidentes/             Incidentes y seguimientos
├── geocercas/ puntos-interes/ numeros-emergencia/   Operación de monitoreo
├── reportes/               Paso por POI, velocidad, posiciones, última posición, distancia
├── messaging/              Consumidores RabbitMQ
│   ├── core/               Conexión, reintentos/DLQ, métricas y health
│   ├── avl/                Despacho de colas AVL por protocolo
│   ├── jt808/ jimi/        Ingest por protocolo
│   ├── axpro/              Eventos y heartbeats AX PRO
│   └── shared/             Ingest de posiciones, lookup de dispositivos, geocerca y tiempo detenido
├── webhook-emitter/        Webhooks salientes firmados con HMAC
├── catalogos/              Catálogos (combustible, telefonía, planes, marcas, modelos) + consulta unificada
├── bitacora/ s3/ mail/     Soporte
├── entities/               Entidades TypeORM
├── common/ utils/ guard/   Enums, utilidades y guards compartidos
docs/                       Documentación funcional y guías de consumo
```

---

## API

- Todas las rutas HTTP llevan el prefijo **`/api`**. Swagger (`/docs`) no lo lleva.
- Autenticación: `Authorization: Bearer <token>`. El token se obtiene con `POST /api/login` (body `{ "userName", "password" }`).
- Respuestas: `{ data }`, `{ data, paginated }` o `ApiCrudResponse`. Monitoreo responde sin wrapper `data` (`{ posicion: [...] }`).
- Campos en camelCase; IMEI siempre como string.
- Soft delete con `Estatus` 0/1 (`PATCH /estatus/:id`).
- Rate limit global: 100 peticiones por minuto por usuario, más límites propios en Auth.

```bash
curl -s -X POST http://localhost:3004/api/login \
  -H "Content-Type: application/json" \
  -d '{"userName":"<usuario>","password":"<contraseña>"}'
```

El inventario completo de endpoints por módulo está en [`docs/contratos.md` §10](./docs/contratos.md).

### Tiempo real (Socket.IO)

| Namespace | Eventos principales |
|-----------|---------------------|
| `/monitoreo` | `conexion:lista`, `conexion:consola`, `monitoreo:actualizacion`, `consola:actualizacion` |
| `/alarmas` | `conexion:lista`, `evento:nuevo`, `panel:heartbeat`, `panel:estado` |

El cliente se autentica con el JWT en `auth.token`, en el header `Authorization` o en el query.

---

## Telemetría por RabbitMQ

Exchange `telemetry` (topic) y dead-letter exchange `telemetry.dlx`.

| Cola | Bindings | Origen |
|------|----------|--------|
| `telemetry.avl.events` | `jt808.position`, `jimi.position`, `fa100s.position` | springTrackCam, springTrackGas, Server_Socket, springFA100S |
| `telemetry.avl.alarms` | `jt808.alarm.*`, `jimi.alarm.*`, `fa100s.alarm.*` | springTrackCam, springTrackGas, springFA100S |
| `telemetry.axpro.events` / `telemetry.axpro.heartbeats` | `axpro.event` / `axpro.heartbeat` | AX PRO |
| `telemetry.avl.dlq` / `telemetry.axpro.dlq` | Mensajes con error | — |

Cada mensaje trae un envelope (`eventId`, `protocol`, `kind`, `deviceId`, `receivedAt`, `payload`) y se procesa una sola vez por `eventId`. La posición se guarda en `Posiciones`; un trigger actualiza `UltimaPosicion` y la API emite el cambio por socket. Detalle de reglas, reintentos y formatos en [`docs/contexto.md` §3](./docs/contexto.md).

### Health checks (públicos)

```bash
curl -s http://localhost:3004/api/health/rabbitmq
curl -s http://localhost:3004/api/health/rabbitmq/queues
```

`/health/rabbitmq/queues` muestra por cola los mensajes pendientes y consumidores del broker, los contadores del consumidor (procesados, fallidos, DLQ, duplicados, desglose por protocolo) y un `state` (`ok`, `idle`, `degraded`, `down`). Los contadores viven en memoria y se reinician al reiniciar el servicio.

---

## Integraciones

| Sistema | Dirección | Mecanismo |
|---------|-----------|-----------|
| springTrackCam (JT808) | Entrada / salida | AMQP `jt808.*`; proxy HTTP de foto/video (`TRACKCAM_GATEWAY_URL`); webhook `trackcam.*` |
| springTrackGas (Concox VL802) | Entrada | AMQP `jimi.*` |
| Server_Socket (SionDev) | Entrada | AMQP `jimi.position` |
| SpringPanel / SIA | Entrada | `POST /api/alarmas/ingest` y `/ingest/heartbeat` firmados con HMAC |
| AX PRO | Entrada | AMQP `axpro.*` |
| ShiftControl y otros | Salida | Webhooks HMAC (`vehiculo.*`, `cliente.*`) a `WEBHOOK_SUBSCRIBERS` |
| BehaviorIQ | Salida | Login facial |
| AWS S3 / SMTP | Salida | Archivos y correo |

---

## Pruebas

```bash
npm test
```

Hay 13 suites unitarias: messaging (despacho AVL, métricas, estado de colas, mappers JT808 / Jimi / AX PRO), fecha de pared, geocerca, tiempo detenido, distancia del histórico, recorrido y fechas de México. `monitoreo-historico.helpers.spec.ts` falla porque Jest no resuelve los imports absolutos `src/...` (falta `moduleNameMapper` en la configuración de Jest de `package.json`).

---

## Despliegue

1. `npm ci && npm run build`
2. Configurar el `.env` del servidor (`NODE_ENV=production`, `RABBITMQ_ENABLED=true`).
3. `npm run start:prod` (o el gestor de procesos del servidor apuntando a `dist/main`).
4. Verificar `GET /api/health/rabbitmq/queues`: `status` debe ser `ok` y cada cola de trabajo con `consumers >= 1`.

Servidor publicado en Swagger: `https://springtelecom.mx/nextAPI`.

---

## Documentación

| Documento | Contenido |
|-----------|-----------|
| [`docs/contexto.md`](./docs/contexto.md) | Visión, arquitectura, colas, sockets, alarmas, webhooks, cambios recientes y deuda técnica |
| [`docs/contratos.md`](./docs/contratos.md) | Contratos HTTP / Socket / AMQP, inventario de endpoints y variables |
| [`docs/README.md`](./docs/README.md) | Índice de guías de consumo y webhooks |
