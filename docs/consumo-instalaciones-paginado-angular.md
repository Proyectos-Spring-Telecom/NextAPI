# Prompt Angular: consumir `POST /api/instalaciones/paginado`

Úsalo como instrucción para un agente o desarrollador Angular que deba integrar el listado paginado de instalaciones de NextAPI.

---

## Prompt (copiar y pegar)

```text
Implementa en Angular el consumo del endpoint NextAPI:

POST {BASE_URL}/api/instalaciones/paginado
Header: Authorization: Bearer {accessToken}
Header: Content-Type: application/json

Body:
{
  "page": number (>= 1),
  "limit": number (1–200),
  "idTipoProducto"?: 1 | 2 | 3 | 4   // OPCIONAL
}

Reglas:
- Si NO envías idTipoProducto → lista instalaciones de TODOS los tipos.
- Si envías idTipoProducto:
  1 = Vehículo, 2 = Activo, 3 = Inmueble, 4 = Persona.
- Requiere JWT (access). El alcance de datos depende del rol del token (tenant).
- Respuesta: { data: InstalacionPaginada[], paginated: { total, page, limit, totalPages } }.
- Cada ítem es JSON PLANO (sin anidar). Orden de bloques:
  instalación → cliente → producto+detalle → dispositivo(+panel si idTipoDispositivo=2) → SIM.
- El detalle de producto cambia según idTipoProducto (campos …Vehiculo | …Activo | …Inmueble | …Persona).
- Dispositivo tipo 2 (PANEL) incluye campos …Panel (cuentaSiaPanel, nombrePanel, etc.). Nunca aesKey.
- SIM: solo idSim, imeiSim, numeroTelefonoSim, nombreTelefoniaSim (pueden ser null).
- Errores HTTP suelen venir como texto plano (no JSON { message }).

Crea:
1) interfaces TypeScript discriminadas por idTipoProducto (o un tipo unión),
2) un service HttpClient con método listarPaginado(page, limit, idTipoProducto?),
3) interceptor JWT si el proyecto aún no lo tiene,
4) ejemplo de componente que pagina y filtra por tipo.

Bases:
- Local: http://localhost:3004
- Productivo: https://springtelecom.mx/nextAPI
```

---

## Contrato rápido

| Campo | Valor |
|-------|--------|
| Método | `POST` |
| Ruta | `/api/instalaciones/paginado` |
| Auth | `Authorization: Bearer <accessToken>` |
| Body | `page`, `limit`, `idTipoProducto?` |

### Body ejemplos

Todos los tipos:

```json
{ "page": 1, "limit": 20 }
```

Solo vehículos:

```json
{ "page": 1, "limit": 20, "idTipoProducto": 1 }
```

Solo inmuebles:

```json
{ "page": 1, "limit": 20, "idTipoProducto": 3 }
```

Solo personas:

```json
{ "page": 1, "limit": 20, "idTipoProducto": 4 }
```

---

## Ejemplo Angular (service)

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export type IdTipoProducto = 1 | 2 | 3 | 4;

export interface PaginatedMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InstalacionesPaginadoResponse {
  data: Record<string, unknown>[];
  paginated: PaginatedMeta;
}

export interface FilterInstalacionesPaginado {
  page: number;
  limit: number;
  idTipoProducto?: IdTipoProducto;
}

@Injectable({ providedIn: 'root' })
export class InstalacionesApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'https://springtelecom.mx/nextAPI'; // o environment.apiUrl

  listarPaginado(
    filter: FilterInstalacionesPaginado,
  ): Observable<InstalacionesPaginadoResponse> {
    return this.http.post<InstalacionesPaginadoResponse>(
      `${this.baseUrl}/api/instalaciones/paginado`,
      filter,
    );
  }
}
```

Uso en componente:

```ts
this.instalacionesApi
  .listarPaginado({ page: 1, limit: 20 }) // todos
  .subscribe(({ data, paginated }) => {
    console.log(data, paginated);
  });

this.instalacionesApi
  .listarPaginado({ page: 1, limit: 20, idTipoProducto: 3 }) // inmuebles
  .subscribe(...);
```

El `HttpInterceptor` debe adjuntar el Bearer del login (`POST /api/login`).

---

## Respuestas reales (capturas)

### 1) Sin filtro / todos los tipos (mezcla inmueble + vehículo + persona)

Request típico: `{ "page": 1, "limit": 20 }` (sin `idTipoProducto`).

```json
{
  "data": [
    {
      "id": 1000001,
      "estatusInstalacion": 1,
      "codigoEstatusInstalacion": "ACTIVA",
      "nombreEstatusInstalacion": "Instalación activa",
      "estatus": 1,
      "vigenteDesde": "2026-08-20T12:27:18.000Z",
      "idUsuario": null,
      "fechaCreacion": "2026-06-01T17:16:26.000Z",
      "fechaActualizacion": "2026-08-20T13:36:47.000Z",
      "idCliente": 13,
      "nombreCliente": "Empresa inmuebles y desarrollos HAC S.A de C.V. S.A de C.V. México",
      "idProducto": 1000002,
      "nombreProducto": "Corporativo Pirámide",
      "estatusProducto": 1,
      "idTipoProducto": 3,
      "nombreTipoProducto": "Inmueble",
      "codigoTipoProducto": "INMUEBLE",
      "inmueble": "Corporativo Pirámide",
      "direccionFiscalInmueble": "Corporativo Pirámide",
      "nombreRepresentanteInmueble": "Eduardo",
      "telefonoRepresentanteInmueble": "7771612959",
      "correoRepresentanteInmueble": "admin@correo.mx",
      "latInmueble": 18.9309696,
      "lngInmueble": -99.2208496,
      "idDispositivo": 1000001,
      "numeroSerieDispositivo": "PANEL-1",
      "imeiDispositivo": null,
      "ecoDispositivo": null,
      "idTipoDispositivo": 2,
      "nombreTipoDispositivo": "Panel de alarma",
      "codigoTipoDispositivo": "PANEL",
      "idMarcaDispositivo": 7,
      "nombreMarcaDispositivo": "Hikvision",
      "idModeloDispositivo": 13,
      "nombreModeloDispositivo": "DS-PWA48-M-WB",
      "cuentaSiaPanel": "1001",
      "nombrePanel": "DS-PWA48-M-WB(Q40839861)PIRAMIDE-Pa",
      "ipPanel": null,
      "cifradoActivoPanel": 0,
      "aesBitsPanel": 128,
      "ultimoHeartbeatPanel": "2026-08-26T10:55:32.000Z",
      "estatusPanel": 1,
      "idSim": null,
      "imeiSim": null,
      "numeroTelefonoSim": null,
      "nombreTelefoniaSim": null
    },
    {
      "id": 1000008,
      "estatusInstalacion": 0,
      "codigoEstatusInstalacion": "INACTIVO",
      "nombreEstatusInstalacion": "Instalacion Inactiva",
      "estatus": 0,
      "vigenteDesde": "2026-08-20T15:48:22.000Z",
      "idUsuario": 17,
      "fechaCreacion": "2026-08-20T15:48:21.000Z",
      "fechaActualizacion": "2026-08-20T15:51:59.000Z",
      "idCliente": 1,
      "nombreCliente": "Next",
      "idProducto": 1000008,
      "nombreProducto": "PYW-298-AA",
      "estatusProducto": 1,
      "idTipoProducto": 1,
      "nombreTipoProducto": "Vehículo",
      "codigoTipoProducto": "VEHICULO",
      "placaVehiculo": "PYW-298-AA",
      "ecoVehiculo": "VH-001",
      "idMarcaVehiculo": 4,
      "nombreMarcaVehiculo": "Volkswagen",
      "idModeloVehiculo": 4,
      "nombreModeloVehiculo": "Amarok Pick Up",
      "anioVehiculo": 2019,
      "colorVehiculo": "Rojo",
      "numeroSerieVehiculo": "1HGBH41JXMN109186",
      "fotoVehiculo": "https://nextspring.s3.us-east-1.amazonaws.com/vehiculos/0d8affad-d179-4e6d-af1b-eb15ef601cef.png",
      "fotoFrenteVehiculo": "https://nextspring.s3.us-east-1.amazonaws.com/vehiculos/fe865720-d270-4f82-b0fc-c744598e1f77.png",
      "tarjetaCirculacionVehiculo": "https://nextspring.s3.us-east-1.amazonaws.com/vehiculos/78a9ae63-7f4b-4a5b-b954-99f5ad50fe68.jpeg",
      "polizaSeguroVehiculo": "https://nextspring.s3.us-east-1.amazonaws.com/vehiculos/772c33d0-48d8-47dc-bf20-01189d6e3a81.pdf",
      "permisoCargaVehiculo": "https://nextspring.s3.us-east-1.amazonaws.com/vehiculos/6739e220-736c-431a-a41a-45563a202141.pdf",
      "idCombustibleVehiculo": 2,
      "nombreCombustibleVehiculo": "Gasolina Premium",
      "kmVehiculo": 120000,
      "capacidadLitrosVehiculo": 42,
      "idDispositivo": 1000008,
      "numeroSerieDispositivo": "3000 - 01",
      "imeiDispositivo": 984642897987953,
      "ecoDispositivo": "GD3000 01",
      "idTipoDispositivo": 3,
      "nombreTipoDispositivo": "AVL",
      "codigoTipoDispositivo": "AVL",
      "idMarcaDispositivo": 12,
      "nombreMarcaDispositivo": "Audis",
      "idModeloDispositivo": 15,
      "nombreModeloDispositivo": "A3",
      "idSim": 3,
      "imeiSim": "895202002719777",
      "numeroTelefonoSim": "7776549879",
      "nombreTelefoniaSim": "Telcel"
    },
    {
      "id": 1000009,
      "estatusInstalacion": 1,
      "codigoEstatusInstalacion": "ACTIVA",
      "nombreEstatusInstalacion": "Instalación activa",
      "estatus": 1,
      "vigenteDesde": "2026-08-26T10:59:08.000Z",
      "idUsuario": 17,
      "fechaCreacion": "2026-08-26T10:59:05.000Z",
      "fechaActualizacion": "2026-08-26T10:59:05.000Z",
      "idCliente": 1,
      "nombreCliente": "Next",
      "idProducto": 1000009,
      "nombreProducto": "Osmar Sahid Martinez Garcia",
      "estatusProducto": 2,
      "idTipoProducto": 4,
      "nombreTipoProducto": "Persona",
      "codigoTipoProducto": "PERSONA",
      "nombrePersona": "Osmar Sahid Martinez Garcia",
      "telefonoPersona": "7773896248",
      "idDispositivo": 1000005,
      "numeroSerieDispositivo": "334020411786638",
      "imeiDispositivo": 354962118473621,
      "ecoDispositivo": "10",
      "idTipoDispositivo": 1,
      "nombreTipoDispositivo": "Rastreador GPS",
      "codigoTipoDispositivo": "RASTREADOR",
      "idMarcaDispositivo": 6,
      "nombreMarcaDispositivo": "Sonny",
      "idModeloDispositivo": 11,
      "nombreModeloDispositivo": "Xperia 10 V",
      "idSim": null,
      "imeiSim": null,
      "numeroTelefonoSim": null,
      "nombreTelefoniaSim": null
    }
  ],
  "paginated": {
    "total": 5,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

(En captura completa también aparecen otros inmuebles/panel; el patrón es el mismo.)

### 2) Filtro vehículo — `idTipoProducto: 1`

```bash
curl -X POST 'http://localhost:3004/api/instalaciones/paginado' \
  -H 'Authorization: Bearer <accessToken>' \
  -H 'Content-Type: application/json' \
  -d '{ "page": 1, "limit": 20, "idTipoProducto": 1 }'
```

```json
{
  "data": [
    {
      "id": 1000008,
      "estatusInstalacion": 0,
      "codigoEstatusInstalacion": "INACTIVO",
      "nombreEstatusInstalacion": "Instalacion Inactiva",
      "estatus": 0,
      "vigenteDesde": "2026-08-20T15:48:22.000Z",
      "idUsuario": 17,
      "fechaCreacion": "2026-08-20T15:48:21.000Z",
      "fechaActualizacion": "2026-08-20T15:51:59.000Z",
      "idCliente": 1,
      "nombreCliente": "Next",
      "idProducto": 1000008,
      "nombreProducto": "PYW-298-AA",
      "estatusProducto": 1,
      "idTipoProducto": 1,
      "nombreTipoProducto": "Vehículo",
      "codigoTipoProducto": "VEHICULO",
      "placaVehiculo": "PYW-298-AA",
      "ecoVehiculo": "VH-001",
      "idMarcaVehiculo": 4,
      "nombreMarcaVehiculo": "Volkswagen",
      "idModeloVehiculo": 4,
      "nombreModeloVehiculo": "Amarok Pick Up",
      "anioVehiculo": 2019,
      "colorVehiculo": "Rojo",
      "numeroSerieVehiculo": "1HGBH41JXMN109186",
      "fotoVehiculo": "https://nextspring.s3.us-east-1.amazonaws.com/vehiculos/0d8affad-d179-4e6d-af1b-eb15ef601cef.png",
      "fotoFrenteVehiculo": "https://nextspring.s3.us-east-1.amazonaws.com/vehiculos/fe865720-d270-4f82-b0fc-c744598e1f77.png",
      "tarjetaCirculacionVehiculo": "https://nextspring.s3.us-east-1.amazonaws.com/vehiculos/78a9ae63-7f4b-4a5b-b954-99f5ad50fe68.jpeg",
      "polizaSeguroVehiculo": "https://nextspring.s3.us-east-1.amazonaws.com/vehiculos/772c33d0-48d8-47dc-bf20-01189d6e3a81.pdf",
      "permisoCargaVehiculo": "https://nextspring.s3.us-east-1.amazonaws.com/vehiculos/6739e220-736c-431a-a41a-45563a202141.pdf",
      "idCombustibleVehiculo": 2,
      "nombreCombustibleVehiculo": "Gasolina Premium",
      "kmVehiculo": 120000,
      "capacidadLitrosVehiculo": 42,
      "idDispositivo": 1000008,
      "numeroSerieDispositivo": "3000 - 01",
      "imeiDispositivo": 984642897987953,
      "ecoDispositivo": "GD3000 01",
      "idTipoDispositivo": 3,
      "nombreTipoDispositivo": "AVL",
      "codigoTipoDispositivo": "AVL",
      "idMarcaDispositivo": 12,
      "nombreMarcaDispositivo": "Audis",
      "idModeloDispositivo": 15,
      "nombreModeloDispositivo": "A3",
      "idSim": 3,
      "imeiSim": "895202002719777",
      "numeroTelefonoSim": "7776549879",
      "nombreTelefoniaSim": "Telcel"
    }
  ],
  "paginated": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### 3) Filtro inmueble — `idTipoProducto: 3`

```bash
curl -X POST 'http://localhost:3004/api/instalaciones/paginado' \
  -H 'Authorization: Bearer <accessToken>' \
  -H 'Content-Type: application/json' \
  -d '{ "page": 1, "limit": 20, "idTipoProducto": 3 }'
```

```json
{
  "data": [
    {
      "id": 1000001,
      "estatusInstalacion": 1,
      "codigoEstatusInstalacion": "ACTIVA",
      "nombreEstatusInstalacion": "Instalación activa",
      "estatus": 1,
      "vigenteDesde": "2026-08-20T12:27:18.000Z",
      "idUsuario": null,
      "fechaCreacion": "2026-06-01T17:16:26.000Z",
      "fechaActualizacion": "2026-08-20T13:36:47.000Z",
      "idCliente": 13,
      "nombreCliente": "Empresa inmuebles y desarrollos HAC S.A de C.V. S.A de C.V. México",
      "idProducto": 1000002,
      "nombreProducto": "Corporativo Pirámide",
      "estatusProducto": 1,
      "idTipoProducto": 3,
      "nombreTipoProducto": "Inmueble",
      "codigoTipoProducto": "INMUEBLE",
      "inmueble": "Corporativo Pirámide",
      "direccionFiscalInmueble": "Corporativo Pirámide",
      "nombreRepresentanteInmueble": "Eduardo",
      "telefonoRepresentanteInmueble": "7771612959",
      "correoRepresentanteInmueble": "admin@correo.mx",
      "latInmueble": 18.9309696,
      "lngInmueble": -99.2208496,
      "idDispositivo": 1000001,
      "numeroSerieDispositivo": "PANEL-1",
      "imeiDispositivo": null,
      "ecoDispositivo": null,
      "idTipoDispositivo": 2,
      "nombreTipoDispositivo": "Panel de alarma",
      "codigoTipoDispositivo": "PANEL",
      "idMarcaDispositivo": 7,
      "nombreMarcaDispositivo": "Hikvision",
      "idModeloDispositivo": 13,
      "nombreModeloDispositivo": "DS-PWA48-M-WB",
      "cuentaSiaPanel": "1001",
      "nombrePanel": "DS-PWA48-M-WB(Q40839861)PIRAMIDE-Pa",
      "ipPanel": null,
      "cifradoActivoPanel": 0,
      "aesBitsPanel": 128,
      "ultimoHeartbeatPanel": "2026-08-26T11:05:31.000Z",
      "estatusPanel": 1,
      "idSim": null,
      "imeiSim": null,
      "numeroTelefonoSim": null,
      "nombreTelefoniaSim": null
    },
    {
      "id": 1000002,
      "estatusInstalacion": 1,
      "codigoEstatusInstalacion": "ACTIVA",
      "nombreEstatusInstalacion": "Instalación activa",
      "estatus": 1,
      "vigenteDesde": "2026-08-20T12:27:18.000Z",
      "idUsuario": null,
      "fechaCreacion": "2026-06-03T16:56:14.000Z",
      "fechaActualizacion": "2026-08-20T13:36:47.000Z",
      "idCliente": 13,
      "nombreCliente": "Empresa inmuebles y desarrollos HAC S.A de C.V. S.A de C.V. México",
      "idProducto": 1000001,
      "nombreProducto": "Corporativo DD1000",
      "estatusProducto": 1,
      "idTipoProducto": 3,
      "nombreTipoProducto": "Inmueble",
      "codigoTipoProducto": "INMUEBLE",
      "inmueble": "Corporativo DD1000",
      "direccionFiscalInmueble": "Av. Domingo Diez 1003",
      "nombreRepresentanteInmueble": "Aurora Martinez",
      "telefonoRepresentanteInmueble": "5534687984",
      "correoRepresentanteInmueble": "auroram@gmail.comm",
      "latInmueble": 18.952392692197662,
      "lngInmueble": -99.23688742682721,
      "idDispositivo": 1000002,
      "numeroSerieDispositivo": "PANEL-2",
      "imeiDispositivo": null,
      "ecoDispositivo": null,
      "idTipoDispositivo": 2,
      "nombreTipoDispositivo": "Panel de alarma",
      "codigoTipoDispositivo": "PANEL",
      "idMarcaDispositivo": 7,
      "nombreMarcaDispositivo": "Hikvision",
      "idModeloDispositivo": 13,
      "nombreModeloDispositivo": "DS-PWA48-M-WB",
      "cuentaSiaPanel": "1002",
      "nombrePanel": "DS-PWA48-M-WB(Q40839880)DD1003-Pa",
      "ipPanel": "Q40839880",
      "cifradoActivoPanel": 0,
      "aesBitsPanel": 128,
      "ultimoHeartbeatPanel": "2026-08-26T11:04:06.000Z",
      "estatusPanel": 1,
      "idSim": null,
      "imeiSim": null,
      "numeroTelefonoSim": null,
      "nombreTelefoniaSim": null
    },
    {
      "id": 1000007,
      "estatusInstalacion": 1,
      "codigoEstatusInstalacion": "ACTIVA",
      "nombreEstatusInstalacion": "Instalación activa",
      "estatus": 1,
      "vigenteDesde": "2026-08-20T15:06:09.000Z",
      "idUsuario": 17,
      "fechaCreacion": "2026-08-20T15:06:08.000Z",
      "fechaActualizacion": "2026-08-20T15:50:33.000Z",
      "idCliente": 1,
      "nombreCliente": "Next",
      "idProducto": 1000016,
      "nombreProducto": "Cibeles",
      "estatusProducto": 2,
      "idTipoProducto": 3,
      "nombreTipoProducto": "Inmueble",
      "codigoTipoProducto": "INMUEBLE",
      "inmueble": "Cibeles",
      "direccionFiscalInmueble": "Blvd. Paseo Cuauhnáhuac 1932, Lomas de Tlahuapan, 62553 Jiutepec, Mor., México",
      "nombreRepresentanteInmueble": "Daniela Robles Olivas",
      "telefonoRepresentanteInmueble": "7773215648",
      "correoRepresentanteInmueble": "danielar@gmail.com",
      "latInmueble": 18.903989,
      "lngInmueble": -99.176127,
      "idDispositivo": 1000006,
      "numeroSerieDispositivo": "Q40839880",
      "imeiDispositivo": 868020035827244,
      "ecoDispositivo": "A",
      "idTipoDispositivo": 2,
      "nombreTipoDispositivo": "Panel de alarma",
      "codigoTipoDispositivo": "PANEL",
      "idMarcaDispositivo": 7,
      "nombreMarcaDispositivo": "Hikvision",
      "idModeloDispositivo": 13,
      "nombreModeloDispositivo": "DS-PWA48-M-WB",
      "cuentaSiaPanel": "1102",
      "nombrePanel": "SPAXPRO_DD1003",
      "ipPanel": null,
      "cifradoActivoPanel": 0,
      "aesBitsPanel": 128,
      "ultimoHeartbeatPanel": null,
      "estatusPanel": 1,
      "idSim": null,
      "imeiSim": null,
      "numeroTelefonoSim": null,
      "nombreTelefoniaSim": null
    }
  ],
  "paginated": {
    "total": 3,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### 4) Filtro persona — `idTipoProducto: 4`

```bash
curl -X POST 'http://localhost:3004/api/instalaciones/paginado' \
  -H 'Authorization: Bearer <accessToken>' \
  -H 'Content-Type: application/json' \
  -d '{ "page": 1, "limit": 20, "idTipoProducto": 4 }'
```

```json
{
  "data": [
    {
      "id": 1000009,
      "estatusInstalacion": 1,
      "codigoEstatusInstalacion": "ACTIVA",
      "nombreEstatusInstalacion": "Instalación activa",
      "estatus": 1,
      "vigenteDesde": "2026-08-26T10:59:08.000Z",
      "idUsuario": 17,
      "fechaCreacion": "2026-08-26T10:59:05.000Z",
      "fechaActualizacion": "2026-08-26T10:59:05.000Z",
      "idCliente": 1,
      "nombreCliente": "Next",
      "idProducto": 1000009,
      "nombreProducto": "Osmar Sahid Martinez Garcia",
      "estatusProducto": 2,
      "idTipoProducto": 4,
      "nombreTipoProducto": "Persona",
      "codigoTipoProducto": "PERSONA",
      "nombrePersona": "Osmar Sahid Martinez Garcia",
      "telefonoPersona": "7773896248",
      "idDispositivo": 1000005,
      "numeroSerieDispositivo": "334020411786638",
      "imeiDispositivo": 354962118473621,
      "ecoDispositivo": "10",
      "idTipoDispositivo": 1,
      "nombreTipoDispositivo": "Rastreador GPS",
      "codigoTipoDispositivo": "RASTREADOR",
      "idMarcaDispositivo": 6,
      "nombreMarcaDispositivo": "Sonny",
      "idModeloDispositivo": 11,
      "nombreModeloDispositivo": "Xperia 10 V",
      "idSim": null,
      "imeiSim": null,
      "numeroTelefonoSim": null,
      "nombreTelefoniaSim": null
    }
  ],
  "paginated": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

---

## Cómo tipar en Angular según `idTipoProducto`

| `idTipoProducto` | Campos extra de producto |
|------------------|---------------------------|
| 1 | `placaVehiculo`, `ecoVehiculo`, marca/modelo, fotos, combustible, km… |
| 2 | `nombreActivo`, `descripcionActivo` |
| 3 | `inmueble`, `direccionFiscalInmueble`, representante, `latInmueble`, `lngInmueble` |
| 4 | `nombrePersona`, `telefonoPersona` |

Si `idTipoDispositivo === 2`, además: `cuentaSiaPanel`, `nombrePanel`, `ipPanel`, `cifradoActivoPanel`, `aesBitsPanel`, `ultimoHeartbeatPanel`, `estatusPanel`.

Helper útil:

```ts
function esPanel(row: { idTipoDispositivo?: number | null }): boolean {
  return row.idTipoDispositivo === 2;
}
```

---

## Errores

| HTTP | Cuándo |
|------|--------|
| 401 | Token ausente/inválido |
| 400 | `page`/`limit` inválidos o `idTipoProducto` fuera de 1–4 |
| 200 + `data: []` | Sin filas en el tenant (no es error) |

---

## Seguridad

No commits de JWT reales. Obtén el token con `POST /api/login` y guárdalo en memoria / storage según política del front.
