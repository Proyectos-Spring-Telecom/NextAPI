# Guía para el frontend de Next (Angular `/next/`)

**Para:** equipo del frontend de Next
**Fuente:** NextAPI (`dev-isra`) y el gateway SpringTrackCam (dashcams Hikvision AE-DI5052-G40PRO)
**Actualizado:** 30/10/2026

Lista de lo que el front debe cambiar o agregar, en orden de número. La App de instaladores tiene su propia guía: [app-instaladores.md](app-instaladores.md).

- **§1–§9** son del gateway de cámaras (SpringTrackCam, `https://springtelecom.mx/trackcam`), no de NextAPI.
- **§10–§16** son de NextAPI (`/api/...`, mismo JWT de siempre).

El análisis de §1–§9 se hizo sobre el bundle desplegado en `springfieldDev:/var/www/html/next/` (build del 15/10/2026). Los nombres de funciones (`toWsBase`, `toFetchableMediaUrl`, `pollMediaReady`) son los que se ven en el JS minificado.

## Resumen

| # | Cambio | Urgencia | ¿Rompe hoy? |
|---|---|---|---|
| 1 | Nueva URL base del gateway | Media | No: la anterior sigue funcionando |
| 2 | En vivo: no forzar `streamType: 0` | **Alta**: consumo de SIM | No |
| 3 | En vivo: corte a los 60 s y fin de sesión (`ended` / 4410) | **Alta** | Sí: sin esto la pantalla se queda congelada |
| 4 | En vivo: cierre 10 s después de cerrar la pestaña | Media | No |
| 5 | Clips de máximo 15 s | Baja | No |
| 6 | URLs de fotos y videos nuevas | Baja | No |
| 7 | Mostrar el motivo de las fotos (`trigger`) | Opcional | No |
| 8 | Endpoints nuevos (consumo de SIM y parámetros de la cámara) | Opcional | No |
| 10 | Pantalla de equipos que transmiten sin alta | **Alta** | No |
| 11 | Órdenes de servicio en el detalle de la instalación | Media | No |
| 12 | Alta y configuración de relojes (tipo RELOJ) | **Alta**: entrega del 30/10 | No |
| 13 | Catálogo de eventos (1–71): nombres corregidos y cómo tratar cada uno | **Alta** | No: cambia el texto de `nombreEvento` |
| 14 | Finalizar incidentes ("Finalizar reporte") | **Alta**: sin esto las alertas repetidas solo se agregan como seguimiento | Sí: un incidente nunca se cierra |
| 15 | Relojes: ubicación aproximada (sin GPS) | **Alta** | No |
| 17 | Alcance: 404 fuera de alcance, roles 7/9 solo lo asignado, `idPadre` solo administración, sin estatus 2 a mano | **Alta** | Sí: pantallas que esperaban ver de más |
| 16 | Órdenes de servicio etapa 2: códigos por dictar, autorizaciones, programar, motivos; etiqueta ICCID y Reasignar; remediación (409, notas internas, reiniciar códigos, permisos de compartir) | **Alta**: sin la pantalla de códigos no se cierran los mantenimientos programados | No: las órdenes de la app actual siguen igual |

---

## 1. Nueva URL base del gateway

En el environment de producción (`chunk-BOFSYH63.js` en el build actual):

```diff
- springTrackCamGatewayUrl: "https://spcode.ddns.net/api-springtrackcam"
+ springTrackCamGatewayUrl: "https://springtelecom.mx/trackcam"
```

- El WebSocket se ajusta solo, porque `toWsBase()` ya cambia `https` por `wss`:
  `wss://springtelecom.mx/trackcam/gateway/intercom/ws?terminalId=…&token=…`
- Al quedar en el mismo dominio que la app, no hay CORS entre orígenes ni dependencia del DDNS `spcode.ddns.net`.
- `spcode.ddns.net/api-springtrackcam` **sigue funcionando** mientras dura la migración.
- Swagger: `https://springtelecom.mx/trackcam/docs`.

**Ojo:** `springTrackCamDefaultImei: "8664960749891928"` está fijo en el environment de producción. Si es un valor de pruebas, quitarlo.

## 2. En vivo: no forzar `streamType: 0`

Hoy el modal "En Vivo" (`chunk-QTWTVIB7.js`) manda `streamType: e.streamType ?? 0`, y nadie le pasa `streamType`. Resultado: **siempre pide el flujo principal**.

El gateway usa por defecto el **sub-stream** (`streamType: 1`), que gasta de 3 a 5 veces menos datos de la SIM. El front lo anula.

```diff
- if (mode === 'video' || mode === 'av') body.streamType = e.streamType ?? 0;
+ if (e.streamType != null) body.streamType = e.streamType;   // sin valor → el gateway usa sub-stream
```

Si se quiere ofrecer "alta calidad", que sea un botón explícito que mande `streamType: 0`.

## 3. En vivo: corte a los 60 s y fin de sesión

Política de flota: **cada sesión en vivo dura máximo 60 s.**

**Respuesta de `POST /gateway/video/start`** (202): trae `maxDurationSeconds: 60`. Usarlo para una cuenta regresiva.

**Cuando la sesión termina**, por la causa que sea, el WebSocket recibe este mensaje JSON y **se cierra con código 4410**:

```json
{ "type": "ended", "reason": "max_duration", "terminalId": "007775005494", "at": "2026-10-25T23:59:00.000Z" }
```

| `reason` | Causa |
|---|---|
| `stopped` | Se llamó `POST /gateway/video/stop` |
| `max_duration` | Se cumplieron los 60 s |
| `no_viewers` | Pasaron 10 s sin ningún navegador conectado |
| `idle` | La cámara dejó de mandar cuadros 5 min |

**Qué hacer en el front:**
- Al recibir `type: "ended"` o un cierre **4410**: pasar a la fase "Sesión finalizada", soltar el `VideoDecoder` y el micrófono, y mostrar un botón **"Ver de nuevo"** que haga otro `POST /gateway/video/start` y vuelva a abrir el WS.
- Con `reason: "max_duration"` conviene decirlo claro, por ejemplo: "La transmisión se cierra cada 60 s para cuidar el consumo de datos".
- Mantener un watchdog propio de "sin cuadros" como respaldo, por si se pierde la red.

**Códigos de cierre del WS:**

| Código | Causa | Qué hacer |
|---|---|---|
| 4401 | Token inválido o sin `terminalId` | Volver a iniciar sesión |
| 4409 | No hay sesión en vivo | Llamar `video/start` **antes** de abrir el WS |
| **4410** | **Sesión finalizada** (nuevo) | Mostrar "finalizado" y ofrecer "Ver de nuevo" |

## 4. En vivo: cierre al quedarse sin visores

Si el último navegador cierra el WS (pestaña cerrada, recarga, red caída), el gateway **detiene la cámara a los 10 s**. Antes la cámara seguía transmitiendo y consumiendo datos sin que nadie la viera.

- Una **recarga rápida** (menos de 10 s) reconecta sin problema.
- Después de 10 s, el WS recibe **4409**. El front debe hacer `video/start` de nuevo en lugar de solo mostrar un error.

## 5. Clips de máximo 15 s

- El gateway graba **máximo 15 s**. Si llega `durationSeconds` entre 16 y 30, lo recorta a 15; más de 30 da 400.
- La respuesta trae la duración real en `durationSeconds`.
- El front ya usa 15 por defecto. **Quitar del selector cualquier opción mayor a 15.**
- Recordatorio: las capturas se piden a **NextAPI** (`POST /monitoreo/{idInstalacion}/video`), no directo al gateway.

## 6. URLs de fotos y videos

Las nuevas tienen esta forma:

```
https://springtelecom.mx/trackcam/data/trackcam/{AAAAMM}/{terminalId}/{uuid}.jpg|.mp4
```

- Al ser del mismo origen que la app, el `fetch` funciona sin CORS.
- Las históricas (`https://spcode.ddns.net/registros/data/...`) se siguen sirviendo.
- `toFetchableMediaUrl()` hoy solo reconoce `/registros/...` de `spcode`. Conviene que reconozca también `/trackcam/data/`.
- Los MP4 aceptan pedidos por rango (`Range`), así que el reproductor puede adelantar.

## 7. Motivo de las fotos (`trigger`)

Cada foto ahora viaja con su motivo:

| `trigger` | Origen |
|---|---|
| `scheduled` | Foto periódica: cada 10 min con ignición, cada 2 h sin ignición |
| `panic` | Botón de pánico |
| `alarm` | Falla o antena GNSS, colisión, volcadura o sobrecupo de pasajeros |
| `manual` | Pedida desde la plataforma |

Para la galería sirve filtrar o resaltar las de `panic` y `alarm`. **Depende de que NextAPI lo guarde y lo exponga**; hoy solo queda en `TelemetryIngestLog.PayloadJson`.

## 8. Endpoints nuevos del gateway (opcionales)

Todos requieren el mismo JWT.

| Endpoint | Para qué |
|---|---|
| `GET /gateway/sim-usage?terminalId=\|imei=&from=&to=&groupBy=day\|hour` | Consumo de datos de la SIM por cámara: totales, por tipo (fotos, video, en vivo, señalización) y proyección a 30 días. Sin `terminalId`, devuelve toda la flota |
| `GET /gateway/config/params?terminalId=\|imei=[&cached=true]` | Parámetros que tiene programados la cámara (heartbeat, intervalos, servidor…). `cached=true` no consulta a la cámara |

## 9. Video H.264 / H.265

- El modal decodifica con **WebCodecs** y elige el códec según `ready.videoCodec`. Hay cámaras que mandan **H.265**, que solo se decodifica en equipos con aceleración por hardware.
- **Pendiente de prueba:** confirmar en los navegadores del equipo de monitoreo que el sub-stream se ve (Chrome o Edge en Windows con GPU).
- Si sale negro, el problema es el códec, no la conexión. Se corrige poniendo los canales en H.264 en la app HikDashcam.

## 10. Pantalla de equipos que transmiten sin alta

Los sockets de TrackGas, Panel, FA100S y S18 aceptan cualquier equipo; NextAPI decide qué se muestra. Lo que llega de un equipo que no está dado de alta en Next (o sin IMEI) queda en la tabla `TelemetryHuerfanos`, y esta pantalla es el único lugar donde se ve. Suele ser un IMEI o número de serie mal capturado.

**API de NextAPI** (JWT; solo roles 1–3):

| Endpoint | Uso |
|---|---|
| `GET /api/telemetria/huerfanos/:page/:limit?protocolo=jt808\|jimi\|axpro&horas=N` | Lista paginada, más recientes primero. `horas` = solo los vistos en las últimas N horas |
| `DELETE /api/telemetria/huerfanos/:id` | Descartar. Si el equipo sigue transmitiendo sin alta, vuelve a aparecer |

Cada fila trae: `id`, `protocol`, `deviceId`, `motivo` (`no_registrado` \| `sin_imei`), `primeraVez`, `ultimaVez`, `mensajes`, `ultimoRoutingKey`, `ultimaLat`, `ultimaLng`. La respuesta usa el formato habitual `{ data, paginated }`.

**Pantalla sugerida:**
- Tabla con sistema (`jt808` = TrackCam, `jimi` = TrackGas, `axpro` = Panel), identificador, motivo, primera y última vez, mensajes y un enlace al mapa si trae posición.
- Botón **Dar de alta** que abre el alta de dispositivo (o de panel, para `axpro`) con el identificador ya capturado. Al darlo de alta deja de actualizarse (`ultimaVez` se queda fija).
- Botón **Descartar** (`DELETE`).
- Un contador en el menú con los vistos en las últimas 24 h (`horas=24`, `limit=1` y leer `paginated.total`).

Disponible cuando se despliegue la rama `dev-isra` de NextAPI.

## 11. Órdenes de servicio en el detalle de la instalación

NextAPI ya guarda cada visita del técnico como orden de servicio (contrato en [contratos.md](contratos.md) §14.1). La app de campo las captura; en el front web solo se consultan:

- **Historial de la unidad:** `GET /ordenes-servicio/paginado/:page/:limit?idProducto=<vehículo>`. Usar `idProducto` y no `idInstalacion`, porque un cambio de equipo o de SIM crea una instalación con Id nuevo.
- **Detalle:** `GET /ordenes-servicio/:id` trae folio, tipo, técnico, monitorista, fecha y lugar, respuestas sí/no por sección, y fotos y firmas con URL firmada (vence a los 5 min; volver a pedir el detalle para renovarla).
- **Textos de las opciones:** `GET /ordenes-servicio/catalogo` (no escribirlos en el front).
- **Sugerido:** en el histórico de la instalación, junto a cada cambio de equipo, de SIM o baja, un enlace a su orden (`idHistoricoInstalacion` de la orden = Id del histórico).
- Roles que leen: 1–5 y 8.

## 12. Alta y configuración de relojes (tipo RELOJ)

NextAPI `dev-isra` `4881af4`. El reloj FA100S ya no se da de alta como Rastreador: tiene tipo propio (`RELOJ INTELIGENTE`, Id 7, ya en el catálogo), como Trackcam y Panel. Marca y modelo, de la categoría `CatProductos` 6 "Reloj Inteligente".

**Pantalla de alta/edición**, con `POST /dispositivos/relojes` y `PATCH /dispositivos/relojes/:id` (lista: `GET /dispositivos/relojes/:page/:limit`; detalle: `GET /dispositivos/relojes/:id`):

| Campo | Captura |
|---|---|
| Cliente, marca, modelo, económico | Igual que cualquier dispositivo |
| `numeroSerie` | "ID del reloj": 10 dígitos (viene en la caja o en la app del reloj) o el IMEI |
| `imei` | **Obligatorio**, 15 dígitos. Sin él no llega la telemetría |
| `intervaloReporteSegundos` | "Reporte en movimiento", por defecto 5 min, mínimo 1 min |
| `intervaloGpsSegundos` | "Ubicación GPS cada", por defecto 10 min; opción "Solo en alertas" = 0. Avisar en pantalla que un intervalo menor gasta más batería |
| `deteccionCaida` | Interruptor, por defecto activo |
| `llamadaPorCaida` | Interruptor "Llamar al detectar caída", por defecto activo |
| `sensibilidadCaida` | Deslizador 1–6 con leyenda "más sensible ↔ menos sensible" (1 = más sensible), por defecto 3 |

**Otros cambios:**
- El alta genérica `POST /dispositivos` rechaza el tipo RELOJ: el selector de tipo debe llevar a esta pantalla, igual que Trackcam.
- En la instalación, el reloj se asigna a un producto de tipo **Persona**, no a un vehículo.
- Eventos nuevos en el historial y en las alertas: 35 Caída, 36 Pulsera retirada, 37 Ritmo cardiaco anormal (SOS usa el 5 y batería baja el 3). La caída y el SOS abren **cada uno su incidente** (NextAPI `bea60d3`): la descripción dice "Alerta automática: Caída" o "Alerta automática: Help Me", y uno abierto no bloquea al otro. El front debe mostrarlos distintos (icono y texto); conviene rotular el 5 como "Botón de emergencia (SOS)" en relojes. Si llega la misma alerta con su incidente aún abierto, no se abre otro: NextAPI (`6668562`) la agrega como **seguimiento** con `medio = "Alerta automática"` y `idUsuario = null` ("Nueva alerta: Caída · ubicación … · posición …"). El front debe destacar esos seguimientos (no son de un usuario) y avisar al monitorista cuando llegue uno nuevo a un incidente que ya está viendo.
- La ubicación del reloj puede tener minutos de antigüedad (GPS cada 10 min, nada bajo techo). Mostrar la hora de la última posición junto al punto.
- Hoy la configuración se guarda, pero el reloj todavía no la recibe desde Next; usa los valores del servidor (reporte 5 min, GPS 10 min). Se avisará cuando se aplique.

## 13. Catálogo de eventos y cómo tratarlos

**Qué cambió (NextAPI `2ec992b`):** `nombreEvento` (consola de transmisiones e histórico de monitoreo) salía de un catálogo desfasado. Ahora sigue la tabla `CatEventos` de MySQL. Antes una puerta aparecía como "Geocerca" y "sin cinturón" como "Sin conductor". Si el front tenía nombres propios por Id, debe tomarlos de esta tabla.

**Ampliado (28/10/2026, NextAPI `aa0c101` / springTrackCam `398cbb4`):** el catálogo tiene ahora todos los códigos conocidos (1–71). La referencia completa, con lo que manda cada equipo, está en [catalogo-eventos.md](catalogo-eventos.md); esta tabla es copia.

Tratamiento (propuesta para validar con monitoreo):
- **Urgente:** abre incidente, suena y el monitorista debe atenderlo y finalizarlo (§14).
- **Aviso:** se resalta en la lista y en el mapa, sin sonido, y se agrupa por equipo.
- **Aviso técnico:** falla del equipo; para soporte, no para el monitorista.
- **Informativo:** solo historial y recorrido.

| Id | Evento | Equipos | Estado | ¿Abre incidente? | Tratamiento |
|---|---|---|---|---|---|
| 1 | Ignición On | AVL legacy, TrackGas, Cámara | 0/1 | No | Informativo |
| 2 | Ignición Off | AVL legacy, TrackGas, Cámara | 0/1 | No | Informativo |
| 3 | Batería baja | TrackGas, Cámara, Reloj, S18 | 9 | Sí (por estado) | Aviso |
| 4 | Alarma de energía (corte o desconexión) | TrackGas, Cámara, S18 | 10 (S18: 0/1) | Sí (por estado) | **Urgente** |
| 5 | Help Me (pánico / SOS) | AVL legacy, TrackGas, Cámara, Reloj, S18 | 2 | **Sí, propio** | **Urgente** |
| 6 | Exceso de velocidad | AVL legacy, TrackGas, Cámara, S18 | 7 | No | Aviso |
| 7 | Movimiento / reporte normal | TrackGas, Reloj, S18 | 0/1 | No | Informativo |
| 8 | Puerta | TrackGas | 0/1 | No | Aviso |
| 9 | Transmisión | AVL legacy, TrackGas, Cámara | 0/1 | No | Informativo |
| 10 | Cámara (foto) | Cámara | 0/1 | No | Informativo |
| 11 | Distancia | — | 0/1 | No | Informativo |
| 12 | ADAS Colisión frontal | Cámara | 0/1 | No | Aviso |
| 13 | ADAS Salida de carril | Cámara | 0/1 | No | Aviso |
| 14 | ADAS Distancia insuficiente | Cámara | 0/1 | No | Aviso |
| 15 | ADAS Colisión peatón | Cámara | 0/1 | No | Aviso |
| 16 | ADAS Cambios carril frecuentes | Cámara | 0/1 | No | Aviso |
| 17 | ADAS Obstáculo | Cámara | 0/1 | No | Aviso |
| 18 | ADAS Fallo sistema | Cámara | 0/1 | No | Aviso técnico |
| 19 | ADAS Reconocimiento señal | Cámara | 0/1 | No | Informativo |
| 20 | Sobrecupo | Cámara | 3 | **Sí, propio** | **Urgente** |
| 21 | DSM Fatiga | Cámara | 13 | No | Aviso |
| 22 | DSM Uso celular | Cámara | 13 | No | Aviso |
| 23 | DSM Fumar | Cámara | 13 | No | Aviso |
| 24 | DSM Distracción | Cámara | 0/1 | No | Aviso |
| 25 | DSM Conductor ausente | Cámara | 0/1 | No | Aviso |
| 26 | DSM Sin cinturón | Cámara | 0/1 | No | Aviso |
| 27 | DSM Cámara obstruida | Cámara | 0/1 | No | Aviso técnico |
| 28 | DSM Cambio conductor | Cámara | 0/1 | No | Informativo |
| 29 | Conducción anormal (genérico) | Cámara | 0/1 | No | Aviso |
| 30 | Conducción brusca (genérico) | Cámara | 0/1 | No | Aviso |
| 31 | Video señal enmascarada | Cámara | 0/1 | No | Aviso técnico |
| 32 | Colisión (acelerómetro) | Cámara | 2 | **Sí, propio** | **Urgente** |
| 33 | Volcadura | Cámara | 2 | **Sí, propio** | **Urgente** |
| 34 | Falla del módulo GNSS | Cámara | 3 | **Sí, propio** | **Urgente** |
| 35 | Caída | Reloj, S18 | 2 | **Sí, propio** | **Urgente** |
| 36 | Pulsera retirada | Reloj | 0/1 | No | Aviso |
| 37 | Ritmo cardiaco anormal | Reloj | 2 | **Sí, propio** | **Urgente** |
| 38 | Carga de combustible | TrackGas (sin detección aún) | 0/1 | No | Informativo |
| 39 | Descarga de combustible (posible robo) | TrackGas (sin detección aún), Cámara (bit 25) | 0/1 | No | Aviso |
| 40 | Antena GNSS desconectada | Cámara | 3 | **Sí, propio** | **Urgente** |
| 41 | Antena GNSS en cortocircuito | Cámara | 3 | **Sí, propio** | **Urgente** |
| 42 | Advertencia de peligro | Cámara | 0/1 | No | Aviso |
| 43 | Falla de pantalla | Cámara | 0/1 | No | Aviso técnico |
| 44 | Falla del módulo de voz | Cámara | 0/1 | No | Aviso técnico |
| 45 | Falla de cámara | Cámara | 0/1 | No | Aviso técnico |
| 46 | Falla del lector de tarjeta IC | Cámara | 0/1 | No | Aviso técnico |
| 47 | Video pérdida de señal | Cámara | 0/1 | No | Aviso técnico |
| 48 | Video falla de almacenamiento | Cámara | 0/1 | No | Aviso técnico |
| 49 | Video falla de dispositivo | Cámara | 0/1 | No | Aviso técnico |
| 50 | Video memoria de alarmas llena | Cámara | 0/1 | No | Aviso técnico |
| 51 | Aceleración brusca | Cámara | 0/1 | No | Aviso |
| 52 | Frenado brusco | Cámara | 0/1 | No | Aviso |
| 53 | Giro brusco | Cámara | 0/1 | No | Aviso |
| 54 | Ralentí prolongado | Cámara | 0/1 | No | Informativo |
| 55 | Apagado anormal del motor | Cámara | 0/1 | No | Aviso |
| 56 | Punto muerto en marcha | Cámara | 0/1 | No | Aviso |
| 57 | Sobrerrevolución del motor | Cámara | 0/1 | No | Aviso |
| 58 | DSM Sin cubrebocas | Cámara | 0/1 | No | Informativo |
| 59 | DSM Captura facial | Cámara | 0/1 | No | Informativo |
| 60 | DSM Bloqueo infrarrojo (gafas) | Cámara | 0/1 | No | Aviso |
| 61 | Tiempo de conducción excedido | Cámara | 0/1 | No | Aviso |
| 62 | Tiempo de estacionamiento excedido | Cámara | 0/1 | No | Informativo |
| 63 | Entrada o salida de área | Cámara | 0/1 | No | Informativo |
| 64 | Entrada o salida de ruta | Cámara | 0/1 | No | Informativo |
| 65 | Tiempo de tramo fuera de rango | Cámara | 0/1 | No | Informativo |
| 66 | Desvío de ruta | Cámara | 0/1 | No | Aviso |
| 67 | Falla del sensor de velocidad | Cámara | 0/1 | No | Aviso técnico |
| 68 | Robo de vehículo | Cámara | 2 | **Sí, propio** | **Urgente** |
| 69 | Encendido ilegal | Cámara | 2 | **Sí, propio** | **Urgente** |
| 70 | Desplazamiento ilegal | Cámara | 2 | **Sí, propio** | **Urgente** |
| 71 | Apertura ilegal de puerta | Cámara | 0/1 | No | Aviso |

Reglas generales:
- **Un Id desconocido** (sin nombre en el catálogo) se muestra como "Evento <Id>" y se trata como aviso. Nunca se oculta.
- **Avisos repetidos:** el mismo aviso del mismo equipo en menos de 1 minuto es un solo episodio (el gateway de TrackCam ya agrupa las alarmas en 60 s).
- **Posición sin GPS** (`GPS = 0`, sobre todo relojes): el punto puede ser una ubicación aproximada por WiFi o antena (§15) o la última ubicación conocida. Mostrar "última ubicación hace X min" y no presentarla como actual. Si es una alerta urgente, avisar al monitorista que la ubicación puede llegar después; el reloj manda una actualización en cuanto fija.
- **Paneles AX PRO:** no usan este catálogo. Cada evento trae `codigoSia`, `severidad` (3 urgente, 2 aviso, 1 informativo) y `esRestauracion`. Una restauración (por ejemplo `PR` tras `PA`, `AR` tras `AT`) cierra el evento abierto de la misma zona. El armado y desarmado (`CL`, `NL`, `OP`) y las pruebas periódicas (`RP`) son informativos.
- **Estado 13** (fatiga, celular, fumar de la cámara) no es alerta de consola: mostrarlo como aviso, sin incidente.
- **Cámara:** abren incidente las alertas que disparan la ráfaga de fotos (pánico, colisión, volcadura, GNSS y sobrecupo) más robo, encendido ilegal y desplazamiento ilegal, cada una con su incidente.

## 14. Finalizar incidentes

Los incidentes automáticos (SOS, caída, alertas de vehículo) **solo se cierran desde el front**; NextAPI no los cierra solo. Mientras un incidente esté abierto, la misma alerta del mismo equipo no abre otro: se agrega como seguimiento `medio = "Alerta automática"` (§12). Sin el botón de cierre, cada equipo queda con un incidente abierto para siempre por tipo de alerta.

| Acción | Endpoint | Body |
|---|---|---|
| **Finalizar reporte** (recomendado) | `PATCH /api/incidentes/:id/finalizar` | `{ "descripcion"?, "resultado"?, "conclusion"? }`, todos opcionales (máx. 1000 / 500 / 1000). `resultado` y `conclusion` quedan como seguimientos "Resultado final" y "Cierre". Si ya está cerrado → 400 |
| Alternar abierto ↔ cerrado | `PATCH /api/incidentes/estatus/:id` | Sin body. Sirve para reabrir uno cerrado por error |

- Pedir al monitorista al menos el **resultado** (por ejemplo "Falsa alarma confirmada con el usuario") antes de finalizar.
- Al finalizar, el incidente ya no admite seguimientos; la siguiente alerta de ese tipo abre un incidente nuevo.
- Lista de abiertos: `GET /api/incidentes/list`; seguimientos: `GET /api/incidentes/:id/seguimientos`.

## 15. Relojes: ubicación aproximada (sin GPS)

Bajo techo el reloj casi nunca ubica por GPS. Desde el 29/10/2026 el servidor calcula una **ubicación aproximada** con las redes WiFi y antenas que ve el reloj; NextAPI la guarda en `Posiciones.FuentePosicion` y `RadioM`. Un fijo GPS con mala precisión (más de 200 m) también se trata como sin GPS (30/10).

| Origen | Cómo mostrarlo |
|---|---|
| GPS | Punto normal |
| WiFi (radio típico 30–100 m) | Punto con **círculo** del radio y la leyenda "Ubicación aproximada (WiFi) ±R m" |
| Antena (radio 0.3–2 km) | Círculo grande, leyenda "Zona aproximada (antena celular)"; no centrar el mapa con zoom de calle |
| Última válida | "Última ubicación hace X min"; no presentarla como actual |

- En una **alerta** (SOS, caída) con ubicación aproximada, decirle al monitorista que la ubicación no es GPS y mostrar el círculo. Si después llega el GPS, la ubicación se actualiza sola.
- Campos en monitoreo, historial y reportes de posiciones: `fuentePosicion` (0 GPS, 1 WiFi, 2 antena, 3 última válida, `null` = no informado: cámaras y AVL, tratarlos como GPS) y `radioM` (metros). Circulo cuando `fuentePosicion` es 1 o 2.

## 16. Órdenes de servicio, etapa 2: programación, código y autorizaciones

Implementado en NextAPI `dev-isra` (commits `2e21da1` y `d8471f1`). Contrato completo: [ordenes-servicio.md](ordenes-servicio.md) §12–§13 y §17. Las órdenes ahora nacen programadas (CRM u operación) y el técnico las inicia en campo.

**Pantallas nuevas para operación y monitoreo**

| Pantalla | Roles | Endpoints |
|----------|-------|-----------|
| **Códigos por dictar** (siempre visible en turno) | 1–5 | `GET /ordenes-servicio/codigos-pendientes` cada 5–10 s con la pantalla abierta; al tocar una fila, `POST /ordenes-servicio/:id/codigo/ver` muestra el código (6 dígitos, vence en 15 min) y registra quién lo vio. Mostrar cliente, placa, económico y técnico para confirmar con el técnico por teléfono. Avisar con sonido cuando aparezca uno nuevo |
| **Autorizaciones pendientes** | 1–4 | `GET /ordenes-servicio/autorizaciones-pendientes`; botones Autorizar / Rechazar → `POST /:id/autorizacion/decision { autorizada, observaciones? }`. Mostrar la foto `equipo_existente` (detalle de la orden). Rechazar deja la orden no cumplida y cobrable |
| **Programar orden** (trabajos fuera del CRM) | 1–3 | `POST /ordenes-servicio/programar { tipo, idCliente, idInstalacion? (mantenimientos), unidades? (altas), cita, citaFin?, idTecnico, idOrdenOrigen?, observaciones? }`. Técnicos: usuarios rol 8. Reprogramar: `PATCH /:id/reprogramar` (solo programadas) |
| **Cerrar sin hacer / cancelar** | 1–3 | `POST /:id/no-cumplida` o `/:id/cancelar` con `claveMotivo` de `GET /ordenes-servicio/motivos`; pedir observaciones si el motivo lo requiere; `cobrable` editable solo aquí |
| **Pruebas por validar** (junto a códigos, siempre visible en turno) | 1–5 | `GET /ordenes-servicio/pruebas-pendientes` cada 5–10 s: transmisión, pánico o **paro de motor** que pide el técnico, con cliente, placa, técnico y su nota. El operador verifica en el monitoreo (llegó la posición, llegó la alerta, se detuvo el motor —el paro lo ejecuta con su herramienta de siempre—) y responde `POST /ordenes-servicio/:id/pruebas/:clave/validar { correcta, observaciones? }`. Avisar con sonido |
| **PDF y envío** (detalle de la orden) | Ver: 1–5. Compartir y enviar: 1–3 | `GET /ordenes-servicio/:id/pdf` (ver/descargar); `POST /:id/compartir { telefono? }` → abrir `whatsapp` en otra pestaña (10 dígitos: el back agrega la lada 52); `POST /:id/enviar-correo { correos }`. Solo con la orden cerrada o no cumplida. Monitoreo (4–5) recibe 403 al compartir o enviar: ocultar esos botones |

**Listados y detalle**
- Estados nuevos: `programada` y `no_cumplida` (además de `borrador`, `cerrada`, `cancelada`). Filtros nuevos en `GET /paginado`: `origen` (`crm`/`next`), `referenciaCrm`.
- Listado y detalle traen `nombreCliente`, `placa`, `numeroEconomico` y `nombreProducto` (30/10): no hace falta otra llamada para mostrarlos.
- Mostrar en el detalle: cita, quién programó, tipo programado vs. real (`tipoDistinto`) y vehículo programado vs. real (`vehiculoDistinto`) como alerta, código validado (sí/no), autorización y quién la decidió, motivo y si es cobrable.
- En el detalle, `pruebas[]`: cada prueba con su estatus (solicitada, correcta, fallida), quién la validó y las notas del técnico y del operador.

**Correcciones pendientes (de §11 y de la revisión del 29/10)**
- La SIM dice "IMEI" pero el dato es el **ICCID** (`Sims.IMEI` guarda el ICCID): cambiar la etiqueta en la fila, el detalle y el alta de SIM.
- "Reasignar" en la fila de instalación es del **dispositivo**: usar `PATCH /instalaciones/:id` (cambio con histórico). Ese cambio crea un Id nuevo y **borra las geocercas** de la versión anterior: avisarlo antes de confirmar. No usar la reasignación de cliente de `/dispositivos`.
- En Next, estatus 1 de equipo o SIM = disponible en almacén; instalado y operando = 2 (asignado). Revisar las etiquetas que digan "activo".

**Cambios de la remediación (29/10/2026, NextAPI `a77d3ac`, `e941374`, `b9aae64`; desplegado en springfieldDev)**
- **409 "cambió mientras tanto"**: decidir una autorización, cancelar, cerrar sin hacer, validar una prueba o reprogramar responden 409 si la orden ya cambió (otro usuario, el técnico o el CRM). Mostrar el mensaje y recargar el detalle; no reintentar solo.
- **Errores con datos**: algunos errores llegan como JSON `{ message, ...datos }` en lugar de texto (p. ej. `faltantes` al cerrar). Leer `message` en los dos casos.
- **Notas internas** (`notasInternas` en el detalle): lo que decide operación o el CRM (autorización, sobreprecio, motivo de cancelación). Mostrarlas en el detalle como "Notas internas"; no salen en el PDF del cliente ni las ve el técnico. `observaciones` es lo que sí ve el cliente.
- **Código de verificación**: lo pide y valida solo el técnico asignado, con un tope de 5 códigos por orden. Agregar en el detalle (roles 1–3) el botón **"Reiniciar códigos"** → `POST /ordenes-servicio/:id/codigo/reiniciar`, para cuando el técnico agota el tope (la App recibe 409).
- **Autorización de desinstalar** ligada al vehículo: el técnico indica el vehículo antes de pedirla y ya no se puede cambiar. Mostrar el vehículo de la autorización en la pantalla de autorizaciones.
- **Pruebas**: el paro de motor solo se pide si el vehículo tiene inmovilizador. Estatus nuevo de prueba `anulada` (la orden se cerró sin hacer el trabajo): mostrarla en gris. Solo se validan pruebas `solicitada`.
- **Cancelar** una orden ya cancelada responde 200 con `data.claveMotivo` (el motivo con el que quedó).

## 17. Alcance: quién ve qué (30/10/2026)

NextAPI cerró accesos que no revisaban el cliente del usuario ([diagnostico-modelo.md](diagnostico-modelo.md) §4). Lo que cambia para el front:

- **Fuera de alcance → 404**: histórico de posiciones, foto y video a demanda, detalle de cliente y de dispositivo, cambios de estatus de recursos, reportes, incidentes y alarmas. El front debe tratarlo como "no existe", no como un error de servidor.
- **Roles 7 y 9** (operador, usuario) ven en reportes, incidentes, alarmas y el histórico **solo las unidades que tienen asignadas**, igual que en monitoreo y consola. Un reporte sin unidades asignadas sale vacío.
- **Cliente padre (`idPadre`)**: solo los roles 1–3 lo cambian (403 a los demás) y no puede crear un ciclo. Si el formulario manda el mismo `idPadre` que ya tiene, no pasa nada.
- **Estatus "asignado" (2)** de dispositivo, SIM o producto ya no se pone a mano (400): lo pone la instalación. Quitar el 2 del selector de estatus.
- **Usuarios** (30/10):
  - administran usuarios (crear, editar a otros, estatus, asignar instalaciones) los roles 1, 2, 3, **4 (solo monitoristas 5 y operadores 7)** y 6 (solo usuarios 9 de su árbol); los demás reciben 403: ocultar esas acciones;
  - nadie asigna un rol más alto que el suyo;
  - **el jefe de monitoreo y el cliente solo pueden otorgar los permisos y soluciones que ellos mismos tienen** (403 si no): en el formulario, mostrar solo esos;
  - al editarse a sí mismo, nadie cambia su rol, cliente, permisos ni estatus.
- **Inventario** (vehículos, activos, personas, inmuebles, dispositivos, TrackCam, relojes, paneles, SIM):
  - el detalle o la edición de algo ajeno → 404;
  - el alta en un cliente fuera del alcance → 403;
  - **administración y el rol 6 ya pueden editar lo de sus clientes hijos** (antes recibían 404).
- **Clientes:** crean clientes los roles 1–3 y el 6 (este solo como hijo de su árbol); `GET /clientes/list/:cliente` ajeno → 404.
- `GET /sims/:id` ahora trae cliente, telefonía y plan, como el listado.


## 18. Estatus de equipos, SIM y vehículos: motor de activos (30/10/2026)

Desde la fase A ([motor-activos.md](motor-activos.md) §13), todo cambio de estatus pasa por un solo lugar y queda en el historial del recurso.

**Catálogo:** `GET /estatus-recurso` devuelve los estatus 0–5 de dispositivo y SIM con los cambios permitidos a mano (`transicionesManuales`) y a dónde puede ir lo que sale de una instalación (`salidaDeInstalacion`). Úsenlo para armar los selectores en lugar de listar 0–5 fijo.

| Id | Estatus | A mano puede pasar a |
|---|---|---|
| 0 | Inactivo | 1 |
| 1 | Disponible | 0, 3 |
| 2 | Instalado | Solo cambia con la instalación |
| 3 | Por revisar | 1, 4, 5, 0 |
| 4 | Laboratorio | 1, 5 |
| 5 | Inservible | Nada. Solo SA o Dev lo corrigen, con `motivo` |

- **`PATCH …/estatus/:id`** (dispositivos, trackcam, relojes, paneles, SIM): un cambio fuera de la tabla → 400, con los permitidos en el mensaje.
  - Acepta `motivo` opcional, que queda en el historial.
  - Productos (vehículo, persona, inmueble, activo) conservan su escala por ahora; solo se rechaza el 2.
- **Cambio de componente** (`PATCH /instalaciones/:id`): `estatusDispositivoAnterior` y `estatusSimAnterior` solo aceptan **3, 4 o 5** (antes 0–5). Quitar 0 y 1 del selector.
- **Baja de instalación** (`PATCH /instalaciones/estatus/:id` con 0 o 5):
  - el equipo y la SIM ya **no regresan a disponible**: van a "por revisar" (3), o el equipo a inservible (5) si la baja es 5;
  - el vehículo queda activo (1);
  - el periodo queda archivado y aparece en `GET /instalaciones/historico/:id` con `accion: "Baja"`.
- **Reactivar** (estatus 1):
  - primero hay que pasar el equipo y la SIM de 3 a 1 (revisados); si no → 400;
  - reactivar una instalación ya activa, o dar de baja una ya dada de baja → 400. La excepción: una baja como inactiva (0) se puede corregir a inservible (5).
- **Cambio de cliente** de un dispositivo o una SIM (`PATCH /dispositivos/:id`, `PATCH /sims/:id` con otro `idCliente`): solo si está disponible (1) o inactivo (0); si no → 400. Queda en el historial como `traspaso`.
- **Historial de vida:** `GET /dispositivos/:id/historial`, `/sims/:id/historial`, `/productos/:id/historial`. Solo roles 1–5 y 8 (cruza clientes).
  - Cada fila trae `accion` (alta, instalacion, cambio, baja, reactivacion, estatus), estatus anterior y nuevo, cliente, instalación, orden, `motivo`, usuario y `origen` (api, orden, sistema).
  - Propuesta: una pestaña "Historial" en el detalle del dispositivo y de la SIM.
- **409**: si otro usuario o una orden movió el recurso al mismo tiempo. Mostrar "cambió mientras se procesaba; vuelva a cargar".

## 19. Posiciones por vigencia y fecha real de instalación (fase D)

Desde la fase D ([motor-activos.md](motor-activos.md) §14), **cada instalación muestra solo lo que transmitió cada equipo mientras estuvo instalado en ella**. Los campos de las respuestas no cambian; cambia qué filas traen y, en distancia, cuántos recorridos hay por unidad.

- **Histórico** (`GET /monitoreo/:idInstalacion/historico`), **reportes** (posiciones, última posición, paso por POI, velocidad, distancia, salidas de geocerca), **consola** (transmisiones, galería, sin transmisión), **dashboard** y **productos del cliente**:
  - lo transmitido antes de `VigenteDesde` o después de que el equipo salió ya no aparece;
  - tras un cambio de equipo, la unidad trae **los dos equipos**, cada uno en su tramo. En distancia hay un recorrido por equipo (mismo `idInstalacion`, distinto `imei`), y en galería cada foto trae el `imei` del equipo que la tomó.
  - los reportes del cliente incluyen las unidades **dadas de baja** por lo que transmitieron mientras estuvieron instaladas; `totalRecorridos` cuenta recorridos (equipo por unidad), no unidades.
- **Última posición** (monitoreo, consola, sin transmisión, dashboard): si la última posición del equipo es anterior a su instalación actual (venía de otro vehículo o del taller), la unidad aparece **sin posición** hasta que transmita instalada.
- **Incidentes** (`POST /incidentes` con `idPosicion`): una posición de cuando el equipo no estaba instalado → 400; el incidente queda con el cliente de la instalación dueña de esa posición.
- **Corregir la fecha de instalación**: `PATCH /instalaciones/:id/vigente-desde` con `{ vigenteDesde: 'YYYY-MM-DD HH:mm:ss', motivo }` (hora de México). Roles 1–4.
  - Solo hacia atrás, no futura y solo instalaciones activas. Si se traslapa con la versión anterior de la instalación o con otro periodo del mismo equipo o SIM → 400 con el periodo que choca.
  - Responde `data.vigenteDesde` y `data.vigenteDesdeAnterior`. Al corregirla aparecen los recorridos anteriores al alta.
  - Propuesta: botón "Corregir fecha de instalación" en el detalle, con fecha, hora y motivo obligatorio.

## 20. Sin transmisión, equipos sin instalación e incidentes de inservibles (fase E)

Desde la fase E ([motor-activos.md](motor-activos.md) §15):

- **Bandeja "Sin transmisión"** (monitoreo, roles 1–5): `GET /vigilancia-transmision/avisos` (sin `estatus` trae los vivos: `abierto` y `atendido`; `?estatus=cerrado&fecha=YYYY-MM-DD` para el histórico).
  - Cada aviso: instalación, cliente, vehículo (placa, económico), equipo (IMEI, serie, tipo), SIM y compañía, última transmisión, horas sin transmitir, estatus, resultado y `posibleFallaProveedor`.
  - `porProveedor`: avisos por compañía telefónica según la evaluación en que se abrieron (`fechaEvaluacion` del grupo = `fechaPrimeraEvaluacion` de los avisos); si marca `posibleFallaProveedor`, mostrarlo como banner ("posible falla de Telcel: 5 equipos").
  - Se genera una vez al día entre 9:00 y 11:00. Cargar la bandeja al entrar y escuchar `vigilancia:avisos` en `/monitoreo` (§25): trae los avisos nuevos o actualizados (`evaluacion`), los que atendió otro operador (`atencion`) y los que salen de la bandeja (`cierre`, solo `id` y `motivoCierre`).
  - **Atender:** `PATCH /vigilancia-transmision/avisos/:id/atender` con `{ resultado, comentario?, fechaRegreso? }`. `resultado`: `falla_equipo`, `taller` (exige `fechaRegreso` futura; pausa la vigilancia de esa unidad hasta esa fecha), `proveedor`, `cliente_avisado`, `otro`.
  - El aviso se cierra solo cuando el equipo vuelve a transmitir o la instalación se da de baja. Si se cerró justo mientras se atendía → 409 (recargar la bandeja).
  - Pasada la fecha de regreso del taller, si sigue sin transmitir, vuelve a `abierto` sin resultado.
  - `?estatus=cerrado` sin `fecha` trae los cerrados de los últimos 30 días.
- **"Sin primera transmisión":** `GET /vigilancia-transmision/sin-primera-transmision`. Instalaciones activas que nunca han transmitido en su vigencia; no generan avisos diarios. Una pestaña aparte de la bandeja.
- **Equipos sin instalación** (roles 1–3): `GET /dispositivos/sin-instalacion?desde=&estatus=`. Equipos que transmiten sin estar instalados, con su estatus y la última instalación de la que salieron. Propuesta: una pantalla en inventario.
- **Incidentes:**
  - un equipo sin instalación (almacén, taller) ya no le abre incidentes a ningún cliente;
  - un **equipo inservible que transmite** abre un incidente para monitoreo (en el cliente raíz), con la descripción "Equipo inservible transmitiendo (posible robo o vandalismo)" y el cliente dueño del equipo.


## 21. Almacén: equipo y SIM sin cliente (fase B)

Desde la fase B ([motor-activos.md](motor-activos.md) §16):

- **`idCliente` de un dispositivo o SIM puede ser `null` = almacén.** Con cliente y sin instalar = reservado a ese cliente. Instalado = el cliente de su instalación. Mostrar "Almacén" cuando venga `null`.
- **Alta** (`POST /dispositivos`, `/dispositivos/trackcam`, `/dispositivos/relojes`, `/dispositivos/paneles`, `/sims`): `idCliente` ya es opcional; sin él entra al almacén (solo roles 1–5 y 8; el cliente debe indicarlo → 403).
- **Editar** (`PATCH /dispositivos/:id`, `/sims/:id`): `idCliente` con un id lo reserva (solo disponible o inactivo); `null` lo regresa al almacén (solo operación). Un equipo o SIM instalado no cambia de cliente → 400. La SIM ya no se "traspasa" a una SIM nueva: la respuesta siempre trae el mismo `id`.
- **Instalar** (`POST /instalaciones`, cambio de componente): el equipo y la SIM pueden venir del almacén o estar reservados al cliente. Reservado a otro cliente → 400. El selector `GET /dispositivos/list?idCliente=X` (y `/sims/list?idCliente=X`) ya trae, para operación, lo reservado a X **y** lo del almacén.
- **Al desinstalar** (baja o cambio), el equipo y la SIM regresan al almacén (`idCliente` null) en "por revisar".
- **Corregir instalación** (roles 1–4): `PATCH /instalaciones/:id/corregir-cliente` con `{ idCliente, idProducto, motivo }`. El vehículo se da de alta antes en el cliente correcto. Responde `data.id` = instalación nueva y `data.idInstalacionAnterior`. Propuesta: acción "Corregir cliente" en el detalle, con selector de cliente y de vehículo.
- Las configuraciones de panel, TrackCam y reloj ya no traen cliente propio: `idCliente` en sus respuestas es el del equipo.
- Pasar un equipo o SIM reservado a por revisar, laboratorio o inservible lo regresa al almacén.
- Un usuario de cliente (6, 7, 9) solo instala lo reservado a su cliente; el almacén es de operación.


## 22. Varias instalaciones por vehículo y geocercas del vehículo (fase C)

Desde la fase C ([motor-activos.md](motor-activos.md) §17):

- **Un vehículo puede tener un GPS, una TrackCam, un panel y un reloj activos** (una instalación por clase de equipo). Instalar otro de la misma clase → 400 con la instalación que ya la ocupa. Cada instalación trae `clase` (`AVL`, `TRACKCAM`, `PANEL`, `RELOJ`).
  - El listado de monitoreo sigue siendo por instalación: un vehículo con GPS y TrackCam aparece dos veces; agrupar por `idProducto` si se quiere una sola fila.
  - Un cambio de equipo (`PATCH /instalaciones/:id`) es de la misma clase; para agregar una TrackCam a un vehículo con GPS, dar de alta otra instalación.
- **Histórico del vehículo:** `GET /monitoreo/producto/:idProducto/historico?fechaInicio=&fechaFinal=` → `{ porFuente: [{ idInstalacion, fuente, totalDistancia, total }], posiciones: [... con fuente e idInstalacionFuente] }`. Mostrar por defecto `fuente = avl` y dejar alternar a `trackcam`.
- **Geocercas:** se dan de alta por vehículo (`idProducto` en `POST /geocercas` y `PATCH /geocercas/:id`). `idInstalacion` sigue aceptándose pero está obsoleto. Las respuestas traen `idProducto`; `idInstalacion` es la instalación activa principal del vehículo (GPS antes que TrackCam), o null.
  - Ya no se borran al cambiar de equipo ni al dar de baja la instalación.
- **Asignación de usuarios 7/9:** sigue por instalación; para que un operador vea la TrackCam del vehículo hay que asignársela también.


## 23. Reloj: números de emergencia y configuración (fase F)

Desde la fase F ([motor-activos.md](motor-activos.md) §18), Next le manda al reloj FA100S su configuración. En el detalle de una instalación de reloj (`clase = RELOJ`):

- **Números de emergencia** (roles 1–6): `GET` / `PUT /instalaciones/:id/reloj/numeros-emergencia` con `{ sos: [hasta 3], centro, agenda: [{ nombre (hasta 10), telefono }] (hasta 15) }`. Lo que no se envía no cambia. Son de la persona: si se cambia el reloj, volver a guardarlos para mandarlos al nuevo.
- **Configuración** (roles 1–5): `POST /instalaciones/:id/reloj/configuracion` con los campos a cambiar: `intervaloReporteSegundos`, `deteccionCaida`, `llamadaPorCaida`, `sensibilidadCaida` (1–6; mayor = menos sensible).
- **Estatus de lo enviado:** `GET /instalaciones/:id/reloj/comandos`. `pendiente` y `publicado` = todavía en Next/cola; `recibido` = en el socket; `enviado` = ya se escribió al reloj; `confirmado` = el reloj lo aplicó; `vencido` = el reloj no se conectó a tiempo (72 h). Mostrar el último de cada tipo con su estatus; si el reloj está apagado, se le entrega al conectarse.

## 24. TrackCam: parámetros de la cámara (31/10/2026)

Desde el 31/10 ([motor-activos.md](motor-activos.md) §19) la consola de configuración de equipos también cubre la TrackCam, por el mismo canal que el reloj. En el detalle de una instalación de TrackCam (`clase = TRACKCAM`), roles 1–5:

- **Ver:** `GET /instalaciones/:id/trackcam/parametros` → `{ fechaLectura, fechaActualizacion, parametros: [{ nombre, id, etiqueta, unidad, min, max, deseado, leido, pendiente }] }`. Pintar una fila por parámetro con lo que tiene la cámara (`leido`) y, si `pendiente`, lo pedido (`deseado`) marcado como "por aplicar". `fechaLectura` = cuándo se leyó la cámara por última vez (null = nunca).
- **Cambiar:** `PUT /instalaciones/:id/trackcam/parametros` con solo los campos a cambiar, por `nombre` (p. ej. `{ "intervaloReporteSegundos": 30, "velocidadMaximaKmh": 100 }`). Validar con `min`/`max` del `GET`. 400 si no va ninguno o alguno está fuera de rango.
- **Leer la cámara:** `POST /instalaciones/:id/trackcam/parametros/leer` (botón "Leer de la cámara"). Al confirmarse, el `GET` trae la lectura nueva.
- **Estatus:** `GET /instalaciones/:id/trackcam/comandos`, igual que el reloj (§23): `pendiente`/`publicado` → `recibido` → `enviado` → `confirmado`. `fallido` trae el motivo en `detalle` (p. ej. "La cámara aceptó pero guardó otro valor: 0x0027=600 (se pidió 300)"); mostrarlo tal cual. Aun fallido, el `GET` de parámetros ya trae lo que quedó en la cámara. Si la cámara está apagada, se aplica al encender.
- No hay campos de heartbeat, servidor, APN, fotos por alarma ni odómetro: los mantiene el gateway o la cámara.

## 25. Tiempo real (Socket.IO): qué escuchar en cada pantalla (31/10/2026)

Next empuja por Socket.IO lo que cambia; el front carga con el `GET` al entrar y luego solo escucha. Conectar con el JWT de acceso en `auth.token` (o `Authorization`/`?token=`). Las salas se fijan al conectar: tras crear una instalación nueva o cambiar de rol, reconectar. Contrato: `docs/contratos.md` §11.4.

| Pantalla | Namespace | Evento | Qué hacer |
|---|---|---|---|
| Mapa / listado | `/monitoreo` | `conexion:lista`, luego `monitoreo:actualizacion` | Pintar la lista inicial y reemplazar el ítem de esa instalación |
| Consola | `/monitoreo` | `conexion:consola`, luego `consola:actualizacion` | Igual, con el ítem de `GET /monitoreo/consola` |
| Bandeja "Sin transmisión" (roles 1–5) | `/monitoreo` | `vigilancia:avisos` | `evaluacion`/`atencion`: insertar o reemplazar por `id` (y `porProveedor` si viene); `cierre`: quitar por `id` |
| Incidentes (roles 1–5) | `/monitoreo` | `incidente:inservible` | Aviso destacado "equipo/panel inservible transmitiendo" con `idIncidente`; abrir el detalle con el `GET` de incidentes |
| Consola de configuración (reloj §23, TrackCam §24; roles 1–5, y el cliente 6 los del reloj) | `/monitoreo` | `comando:actualizacion` | Reemplazar el comando por `comando.id` en la lista; en TrackCam, al llegar `confirmado` o `fallido`, volver a pedir `GET …/trackcam/parametros` (trae la lectura nueva) |
| Paneles | `/alarmas` | `conexion:lista`, `evento:nuevo`, `panel:heartbeat`, `panel:estado` | Ya existente |

Lo que no empuja (consultar al entrar): equipos sin instalación (§20), "sin primera transmisión" y el histórico de cerrados.

