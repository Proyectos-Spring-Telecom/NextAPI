# Corregir el número de serie de un dispositivo ya instalado

> Propuesta (front + API), 25/11/2026. **Decidida el 26/11/2026: opción A, implementada en la API.**
> Alcance: **solo el número de serie** (`Dispositivos.NumeroSerie`). El **IMEI no se toca**.

## 1. Problema

Hoy no se puede cambiar el número de serie de un dispositivo que está o estuvo en una instalación
(`src/dispositivos/dispositivos.service.ts`, regla de `IMEI y número de serie amarran posiciones e historial`):

- En instalación activa → 400: *"El dispositivo está en la instalación N. Retíralo de la instalación antes de cambiar IMEI o número de serie."*
- Con historial de instalaciones → 400: *"El dispositivo ya tiene historial de instalaciones; no se puede cambiar IMEI ni número de serie."*

Caso real: un **teléfono** se dio de alta con el número de serie mal capturado y ya está instalado. La única salida
hoy es crear otro dispositivo y hacer una orden de cambio de equipo, aunque físicamente es el mismo teléfono.

## 2. Qué identifica a cada equipo (por qué el número de serie es de bajo riesgo)

| Dato | Para qué se usa |
|---|---|
| `Id` del dispositivo | Llave de posiciones, instalaciones, comandos e historial. **No cambia.** |
| `IMEI` | Llave con la que llegan las posiciones (sockets) y con la que el teléfono está registrado en la app de rastreo (TrackPhone: `telefono.alta`, `telefono.codigo`, `telefono.consultar`, `telefono.baja`). |
| `NumeroSerie` | Dato de identificación para personas. En teléfonos solo se usa como **etiqueta** al dar de alta en la app (`telefonos-app.service.ts`: `etiqueta = eco \|\| numeroSerie`). |

Por eso la propuesta abre **solo** el número de serie y deja el IMEI bloqueado como está.

## 3. Propuesta

Una acción **aparte** del editar normal, igual que las correcciones que ya existen (`PATCH /instalaciones/:id/vigente-desde`, `PATCH /instalaciones/:id/corregir-cliente`):

```
PATCH /dispositivos/:id/corregir-numero-serie
Body: { "numeroSerie": "863269078504617", "motivo": "Se capturó mal en el alta" }
```

Reglas:

1. **Roles 1–4** (mismos que las otras correcciones).
2. `motivo` **obligatorio** (texto, mínimo 10 caracteres).
3. El número nuevo **no puede existir** en otro dispositivo (mismo índice/validación del alta) → 409 si ya existe.
4. Se permite **aunque el dispositivo esté instalado o tenga historial**: no cambia el equipo, solo corrige el dato.
5. Queda en **bitácora**: usuario, fecha, valor anterior, valor nuevo y motivo.
6. El `PATCH /dispositivos/:id` normal **sigue igual** (no deja cambiar número de serie ni IMEI con historial).
7. El IMEI **no** se puede cambiar por esta vía.

Front: botón **"Corregir Número De Serie"** (roles 1–4) en Gestión de la instalación o en el detalle del dispositivo,
con campo nuevo, motivo y una confirmación que muestre las consecuencias del punto 4.

## 4. Consecuencias (para decidir)

| Tema | Qué pasa al corregir el número de serie |
|---|---|
| Posiciones e historial | **No se afectan.** Están ligados al `Id` del dispositivo y de la instalación. |
| Telemetría / sockets | **No se afecta.** Las posiciones llegan por IMEI, que no cambia. |
| App de rastreo (teléfonos) | **No se afecta** el registro (es por IMEI). La etiqueta que ve la app es la del alta; si no tiene económico y se quiere ver el número nuevo, se regenera el código del teléfono. |
| Reportes y pantallas | Muestran el **número nuevo** desde ese momento (leen el dato actual). |
| Bitácora y órdenes ya creadas | Las que guardaron el número como **texto** siguen mostrando el **anterior**. Es correcto: es el historial de lo que pasó. |
| Búsquedas | Buscar por el número viejo ya no encuentra el equipo (salvo en la bitácora de la corrección). |
| Duplicados | Si el número nuevo ya existe en otro dispositivo se rechaza; si había un registro duplicado, primero hay que darlo de baja. |
| Riesgo de abuso | Se usa para "renombrar" un equipo por otro. Se mitiga con roles 1–4, motivo obligatorio y bitácora. |

**Si se corrigiera también el IMEI** (no recomendado, fuera de esta propuesta): el equipo dejaría de verse si sigue
reportando con el IMEI viejo, habría que darlo de baja y alta en la app de rastreo y los sockets podrían tener el IMEI
anterior en memoria.

## 5. Opciones

| Opción | Cómo | A favor | En contra |
|---|---|---|---|
| **A. Corregir el número de serie** (esta propuesta) | Endpoint nuevo `corregir-numero-serie` | Mismo registro, sin duplicados ni órdenes ficticias; historial intacto. | Desarrollo nuevo en API y front; el número viejo solo queda en bitácora. |
| **B. Crear un nuevo dispositivo** (como hoy) | Alta del dispositivo con el número correcto + orden de **cambio de equipo** en la instalación | No requiere desarrollo; no toca la regla actual. | Queda un dispositivo duplicado de un equipo que es el mismo; una orden de cambio de equipo que no pasó; el historial se parte en dos dispositivos. |

## 6. Decisión

- [x] **A.** Se acepta la corrección del número de serie con las reglas del punto 3.
- [ ] **B.** No se acepta; los errores de captura se resuelven creando un nuevo dispositivo y haciendo cambio de equipo.

Decide: Israel Negrete. Fecha: 26/11/2026.

## 7. Implementación (API)

- `PATCH /dispositivos/:id/corregir-numero-serie` (`dispositivos.controller.ts` / `dispositivos.service.ts`, `corregirNumeroSerie`).
- Respuesta 200: `{ status, message, data: { id, nombre: <número nuevo>, numeroSerieAnterior } }`.
- Errores: 400 sin número, igual al actual o motivo < 10 caracteres; 403 rol 5+; 404 inexistente o fuera del alcance; 409 número ya registrado en otro dispositivo (el mensaje trae su id) o el dispositivo cambió mientras se procesaba.
- Bitácora (`Dispositivos`, UPDATE) con `campo`, `valorAnterior`, `valorNuevo` y `motivo`.
- **TrackCam:** su número de serie es el ID JT808 con el que el gateway la reconoce. Al corregirlo se emite `trackcam.updated` y el gateway actualiza su registro (llave = id del dispositivo): con el número correcto la cámara vuelve a autenticarse.
- Pruebas: `src/dispositivos/corregir-numero-serie.spec.ts` (instalado/historial sin bloqueo, duplicado 409, carrera 409, sin motivo 400, otro cliente 404, rol 5 403).

Front (Lalo): botón **"Corregir Número De Serie"** (roles 1–4) con número nuevo, motivo y la confirmación de las consecuencias del punto 4.
