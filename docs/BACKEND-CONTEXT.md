# NextAPI — Contexto del backend

Documento de referencia sobre la arquitectura, convenciones y capacidades del backend **NextAPI** (ecosistema NEXT / ShiftControl / SpringPanel).

| Campo              | Valor                                  |
| ------------------ | -------------------------------------- |
| Proyecto           | `nextapi` v1.0.5                       |
| Framework          | NestJS 11 + TypeScript                 |
| Base de datos      | MySQL (`Next`)                         |
| Prefijo HTTP       | `/api`                                 |
| Swagger            | `/docs`                                |
| Puerto por defecto | `3004`                                 |
| Zona horaria       | `America/Mexico_City` (MySQL `-06:00`) |

---

## 1. Propósito

NextAPI es la capa REST que centraliza:

- **IAM**: usuarios, roles, permisos, clientes jerárquicos.
- **Flota y telemetría**: vehículos, operadores, dispositivos GPS, SIMs, instalaciones.
- **Alarmas (SpringPanel)**: inmuebles, paneles AX PRO, eventos SIA (entidades preparadas).
- **Autenticación**: login por contraseña, PIN operador, reconocimiento facial (BehaviorIQ BFF).
- **Infraestructura transversal**: S3, correo, bitácora, catálogos.

Los clientes (Shift, SpringPanel, otros backends) consumen esta API con JWT Bearer.

---

## 2. Stack tecnológico

| Capa         | Tecnología                                                  |
| ------------ | ----------------------------------------------------------- |
| Runtime      | Node.js                                                     |
| API          | NestJS + Express                                            |
| ORM          | TypeORM 0.3                                                 |
| Validación   | `class-validator` + `ValidationPipe` global                 |
| Auth         | Passport JWT, bcrypt                                        |
| Docs         | Swagger (`@nestjs/swagger`)                                 |
| Rate limit   | `@nestjs/throttler` (guard global)                          |
| Config       | `@nestjs/config` + Joi (variables obligatorias al arranque) |
| Archivos     | AWS S3 (`@aws-sdk/client-s3`, multer-s3)                    |
| Correo       | Nodemailer (SMTP Zoho)                                      |
| HTTP externo | Axios (BehaviorIQ)                                          |

---

## 3. Estructura del repositorio

```
NextAPI/
├── src/
│   ├── app.module.ts          # Módulo raíz, TypeORM, throttling
│   ├── main.ts                # Bootstrap, CORS, Swagger, pipes
│   ├── auth/                  # Login, refresh, facial (BehaviorIQ)
│   ├── usuarios/              # CRUD usuarios, NIP, face-auth
│   ├── clientes/              # CRUD clientes + multipart S3
│   ├── roles/ permisos/ modulos/
│   ├── vehiculos/ operadores/ dispositivos/ sims/ instalaciones/
│   ├── inmuebles/ panel-alarma/   # Módulo alarmas SpringPanel
│   ├── catalogos/             # Catálogos CRUD + registry dinámico
│   ├── bitacora/ s3/ mail/
│   ├── common/                # TenantFilter, enums, validators, ApiResponse
│   ├── entities/              # Entidades TypeORM (glob autocarga)
│   ├── guard/                 # JwtAuthGuard, RolesGuard
│   └── utils/
├── docs/                      # Documentación del proyecto
└── .env                       # Variables de entorno (no versionar secretos)
```

---

## 4. Arranque y entorno

### Comandos

```bash
npm install
npm run start:dev    # desarrollo con watch
npm run build        # compilar a dist/
npm run start:prod   # node dist/main
```

### Variables principales (`.env`)

| Grupo           | Variables                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------------- |
| App             | `PORT`, `TZ`, `NODE_ENV`                                                                       |
| MySQL           | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_DATABASE`                                  |
| JWT             | `JWT_SECRET`, `JWT_EXPIRES_IN`, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES_IN`                 |
| Throttling auth | `THROTTLE_*_LIMIT`, `THROTTLE_*_TTL_MS`                                                        |
| AWS S3          | `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `UPLOAD_MAX_SIZE` |
| SMTP            | `HOST`, `SMTP`, `E_MAIL`, `MAIL_PASSWORD`, `MAIL_FRONTEND_URL` (opcional)                      |
| BehaviorIQ      | `BEHAVIORIQ_BASE_URL`, `BEHAVIORIQ_USER_NAME`, `BEHAVIORIQ_PASSWORD` (login facial BFF)        |

Joi valida la mayoría al iniciar; BehaviorIQ se usa en runtime si falta configuración en login facial.

---

## 5. Capa HTTP

- **Prefijo global**: todas las rutas bajo `/api`.
- **Swagger UI**: `{BASE}/docs` (ej. `http://localhost:3004/docs`).
- **CORS**: `origin: '*'` con `credentials: true`.
- **ValidationPipe**: `whitelist`, `forbidNonWhitelisted`, `transform`.
- **Filtro**: `HttpStringResponseFilter` normaliza respuestas string a JSON.

### Formato de respuesta habitual

```typescript
// Listados
{ data: [...], paginated?: { total, page, limit, totalPages } }

// CRUD
{ status: 'success' | 'error', message: string, data?: { id, nombre }, estatus?: { estatus } }
```

---

## 6. Autenticación y sesión

### Endpoints públicos (sin JWT)

| Ruta                                   | Descripción                                                    |
| -------------------------------------- | -------------------------------------------------------------- |
| `POST /api/login`                      | Login usuario/contraseña (+ query `Nombres` = código solución) |
| `POST /api/login/operador/accesso/nip` | Login operador por PIN                                         |
| `POST /api/auth/validateFace`          | Login biométrico (BFF BehaviorIQ)                              |
| `POST /api/login/refresh`              | Renovar access token                                           |
| `PATCH /api/login/verify`              | Verificación de correo                                         |
| Rutas de recuperación de contraseña    | Bajo `/api/login/...`                                          |

### Endpoints protegidos

Header obligatorio:

```http
Authorization: Bearer <access_token>
```

Guards típicos: `JwtAuthGuard` + `RolesGuard` + `@Roles(...)`.

### JWT access token (claims)

| Claim       | Descripción                                   |
| ----------- | --------------------------------------------- |
| `id`        | ID usuario                                    |
| `idCliente` | Tenant                                        |
| `rol`       | `IdRol`                                       |
| `face`      | Opcional: `IdFaceAuth` / id rostro BehaviorIQ |

`req.user` expone: `userId`, `idCliente`, `rol`, `face` (si aplica).

### Refresh token

- Firmado con `JWT_REFRESH_SECRET`.
- Hash SHA-256 guardado en `Usuarios.TokenHash`.
- Expiración en `TokenExpira`; revocación en `TokenRevocado`.
- Al cambiar contraseña se marca `tokenRevocado = 1` (sesión invalidada).

### Soluciones (`AsignacionSoluciones`)

Login y validateFace validan que el usuario tenga asignación activa a la solución (query `Nombres` o `idSolucion` fijo en facial).

### BehaviorIQ (login facial)

Patrón **BFF**: el cliente no envía credenciales BehaviorIQ.

1. Servidor hace login a BehaviorIQ con variables de entorno.
2. `POST .../auth/validateFace/{idCliente}` con embeddings.
3. Correlación `idRostro` ↔ `Usuarios.IdFaceAuth`.
4. Emisión de JWT propio (`token`, `refreshToken`, `expiresIn`).

Tenant facial fijo: `IdCliente = 2` (en código). `idSolucion = 2` hacia BehaviorIQ.

---

## 7. Multitenancy (`TenantFilterService`)

Filtrado por **`IdRol`** del JWT:

| Roles     | Comportamiento                                      |
| --------- | --------------------------------------------------- |
| **1, 2**  | Sin filtro de cliente (admin global)                |
| **3, 4**  | Cliente del token + hijos (`CALL spGetClientes(?)`) |
| **Resto** | Solo `IdCliente` del token                          |

API del servicio:

- `build()` / `buildWhere()` — fragmentos SQL para queries raw.
- `forTypeOrmIdCliente()` — condición para `find` / `findAndCount`.
- `getClienteHijosIds()` — IDs desde stored procedure.

Módulos que lo usan: clientes, usuarios, vehículos, operadores, dispositivos, SIMs, instalaciones, bitácora, inmuebles, panel-alarma.

### Reglas de listado

- **`GET .../list`**: solo registros con `estatus = 1`.
- **`GET .../:page/:limit`**: activos e inactivos, paginado.

---

## 8. Módulos de negocio

### IAM y administración

| Módulo   | Ruta base       | Notas                                                                                         |
| -------- | --------------- | --------------------------------------------------------------------------------------------- |
| Clientes | `/api/clientes` | Multipart S3; jerarquía `IdPadre`; `GET /jerarquia` (SP); si `idPadre` es null al crear → `1` |
| Usuarios | `/api/usuarios` | NIP, contraseña, face-auth; listados sanitizados (sin hashes/tokens)                          |
| Roles    | `/api/roles`    |                                                                                               |
| Permisos | `/api/permisos` |                                                                                               |
| Módulos  | `/api/modulos`  | Catálogo de módulos del sistema                                                               |

### Flota / telemetría

| Módulo        | Ruta base            |
| ------------- | -------------------- |
| Vehículos     | `/api/vehiculos`     |
| Operadores    | `/api/operadores`    |
| Dispositivos  | `/api/dispositivos`  |
| SIMs          | `/api/sims`          |
| Instalaciones | `/api/instalaciones` |

Patrón CRUD: `POST`, `GET list`, `GET :page/:limit`, `GET :id`, `PATCH :id`, `PATCH estatus/:id`.

### Alarmas (SpringPanel)

| Módulo       | Ruta base           | Entidad       |
| ------------ | ------------------- | ------------- |
| Inmuebles    | `/api/inmuebles`    | `Inmuebles`   |
| Panel Alarma | `/api/panel-alarma` | `PanelAlarma` |

Entidades relacionadas (sin CRUD expuesto aún en este repo): `EventoAlarma`, `UltimoEventoAlarma`.

Panel: cuenta SIA única, cifrado AES opcional, `ultimoHeartbeat` (no editable vía CRUD).

### Catálogos

- Módulos individuales: `cat-marca-vehiculo`, `cat-modelo-dispositivo`, etc.
- Punto dinámico: **`GET /api/catalogos/:nombre`** vía `CatalogosRegistry`.

### Transversal

| Módulo   | Ruta            | Función                           |
| -------- | --------------- | --------------------------------- |
| Bitácora | `/api/bitacora` | Auditoría (`EnumModulos`)         |
| S3       | `/api/s3`       | Upload / update / delete archivos |
| Mail     | `/api/mail`     | Envío de correos                  |

---

## 9. Capa de datos

### TypeORM

- Entidades en `src/entities/*.ts`.
- Carga automática: `entities: [__dirname + '/entities/*{.ts,.js}']`.
- **`synchronize: false`** — el esquema lo gobierna MySQL/migraciones manuales.
- Decorador **`@applySchema`**: schema = `DB_DATABASE` (default `Next`).

### Convenciones de entidades

- Tablas/columnas en **PascalCase** (`name: 'IdCliente'`).
- Propiedades en **camelCase** (`idCliente`).
- PK: `@PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })`.
- Fechas: `@CreateDateColumn` / `@UpdateDateColumn` cuando aplica.

### SQL y stored procedures

- Queries raw donde el join/filtro es complejo.
- **`spGetClientes`**: jerarquía recursiva de clientes (tenant roles 3–4 y endpoint jerarquía).

---

## 10. Seguridad

| Medida             | Implementación                                            |
| ------------------ | --------------------------------------------------------- |
| Autenticación      | JWT Bearer                                                |
| Autorización       | `RolesGuard` + `@Roles(id...)`                            |
| Rate limiting      | Throttler global + límites por ruta en auth               |
| Contraseñas / PIN  | bcrypt; columnas sensibles con `select: false` en entidad |
| Refresh revocable  | Hash en BD + `tokenRevocado`                              |
| Bitácora           | Acciones CREATE/UPDATE/ERROR en operaciones críticas      |
| Validación entrada | DTOs + ValidationPipe                                     |

**Buenas prácticas al integrar:**

- No exponer `passwordHash`, `pinHash`, `tokenHash`, etc. en listados (ya sanitizado en varios endpoints).
- Tras cambio de contraseña, forzar nuevo login.
- Credenciales BehaviorIQ solo en servidor.

---

## 11. Integraciones externas

| Servicio        | Uso                                               |
| --------------- | ------------------------------------------------- |
| **AWS S3**      | Documentos de clientes, fotos, archivos generales |
| **SMTP (Zoho)** | Verificación, recuperación de contraseña          |
| **BehaviorIQ**  | Embeddings / validateFace para login facial       |

---

## 12. Entidades destacadas (Usuarios)

| Columna                                       | Uso                                                      |
| --------------------------------------------- | -------------------------------------------------------- |
| `IdRol`                                       | Rol operativo (JWT `rol`)                                |
| `NivelAcceso`                                 | Columna en BD; **no** usada en JWT ni lógica auth actual |
| `IdFaceAuth`                                  | Vínculo con rostro BehaviorIQ; claim JWT `face`          |
| `TokenHash` / `TokenExpira` / `TokenRevocado` | Sesión refresh                                           |
| `TokenHashAdmin`                              | Columna en BD; **sin uso** en código NextAPI actual      |

---

## 13. Convenciones de código

- Un módulo Nest por dominio: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`.
- Controllers: Swagger `@ApiTags`, `@ApiBearerAuth`, guards a nivel clase o método.
- Services: bitácora en try/catch; `TenantFilterService` en listados.
- Errores: `HttpException` tipadas (`BadRequestException`, `NotFoundException`, etc.).
- Soft delete: `estatus` 0/1, no DELETE físico en la mayoría de módulos.

---

## 14. Servidores documentados en Swagger

| Entorno    | URL base                           |
| ---------- | ---------------------------------- |
| Local      | `http://localhost:3004`            |
| Producción | `https://springtelecom.mx/nextAPI` |

Rutas completas: `{URL_BASE}/api/...` y documentación en `{URL_BASE}/docs`.

---

## 15. Alcance y deuda conocida

**Incluido en este repo:** IAM, clientes, flota, catálogos, auth (incl. facial), alarmas (inmuebles/panel CRUD), S3, mail, bitácora.

**Parcial / pendiente:** CRUD de `EventoAlarma` / recepción DC-09, módulos del enum `EnumModulos` sin API (viajes, rutas, etc.).

**Mejoras sugeridas:** tests automatizados, validar BehaviorIQ en schema Joi, homogeneizar `token` vs `accessToken` en respuestas de login, revisar `findOne` admin vs tenant en algunos módulos.

---

## 16. Referencias rápidas para otros backends

| Acción                 | Método | Ruta                                  |
| ---------------------- | ------ | ------------------------------------- |
| Login                  | POST   | `/api/login?Nombres=SIT`              |
| Refresh                | POST   | `/api/login/refresh`                  |
| Cambiar contraseña     | PATCH  | `/api/usuarios/actualizar/contrasena` |
| Configurar NIP         | PATCH  | `/api/usuarios/mi-nip`                |
| Login facial           | POST   | `/api/auth/validateFace`              |
| Registrar rostro local | POST   | `/api/usuarios/face-auth`             |
| Jerarquía clientes     | GET    | `/api/clientes/jerarquia`             |

Todos los endpoints protegidos requieren `Authorization: Bearer <JWT>` salvo los indicados como públicos.

---

_Última actualización: contexto del repositorio NextAPI v1.0.5._

CatTipoVerificaciones:

1 Verificación Mecánica
2 Verificación Ambiental

CatEstatusSim:

1 Disponible SIM adquirido pero sin asignar a ningún dispositivo
2 (Asignado) SIM operativo con servicio activo
3 (Baja) SIM dado de baja
4 (BajaCambio) SIM dado de baja definitivamente

CatEstatusDispositivo:

1 (Disponible) Dispositivo en inventario sin asignar a ningún vehículo
2 (Asignado) Dispositivo instalado y transmitiendo correctamente
3 (Baja) Dispositivo dado de baja
4 (Mantenimiento) Dispositivo retirado temporalmente para revisión o reparación

CatReferenciaServicio:

1 Por Kilometraje
2 Por Tiempo
