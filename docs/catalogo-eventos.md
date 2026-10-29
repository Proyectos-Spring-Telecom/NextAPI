# Catálogo de eventos por equipo

Referencia única de `IdEvento` (tabla `CatEventos` de MySQL), de qué equipo los manda, con qué `Estado` llegan, cuáles abren incidente y cómo debe tratarlos el front. Actualizado el 28/10/2026.

- SQL: `CatEventos` 1–31 original; 35–37 en [`deploy/sql/CatEventosRelojes.sql`](../deploy/sql/CatEventosRelojes.sql); 32–34 y 38–71 en [`deploy/sql/CatEventosExtension.sql`](../deploy/sql/CatEventosExtension.sql).
- Código: `src/common/cat-eventos.enum.ts` (nombres) y `src/incidentes/incidentes-alerta.util.ts` (qué abre incidente).
- Cada socket calcula `IdEvento` y `Estado` y los manda listos; NextAPI solo agrega los estados 4/5/6 (tiempo detenido) y 8 (geocerca).

---

## 1. Tres datos por posición

| Dato | Qué dice | Quién lo pone |
|---|---|---|
| `IdEvento` | **Qué pasó** (pánico, caída, colisión, reporte normal…) | El socket del equipo |
| `Estado` | **Cómo la trata la consola** (alerta, detenido, movimiento…) | El socket; NextAPI agrega 4/5/6/8 |
| Incidente | **Expediente** que abre NextAPI cuando el `Estado` entra en alerta | NextAPI (`src/incidentes/auto/`) |

## 2. Estados

| Estado | Significado | ¿Alerta de consola? | Lo pone |
|---|---|---|---|
| 0 | Detenido | No | Socket (velocidad < 5 km/h) |
| 1 | Movimiento | No | Socket |
| 2 | Alerta primaria | **Sí** | Socket (pánico, colisión, volcadura, SOS, caída, ritmo cardiaco) |
| 3 | Alerta secundaria | **Sí** | Socket (GNSS y sobrecupo de la cámara) |
| 4 / 5 / 6 | Detenido más de 30 / 60 / 90 min | No | NextAPI (AVL, TrackCam, TrackGas) |
| 7 | Exceso de velocidad | No | Socket |
| 8 | Fuera de geocerca | **Sí** | NextAPI (geocercas ligadas a la instalación) |
| 9 | Batería baja | **Sí** | Socket |
| 10 | Falta de energía | **Sí** | Socket |
| 11 | Alerta de movimiento | **Sí** | Socket |
| 13 | Alerta de IA (fatiga, celular, fumar) | No: aviso en consola sin incidente | Socket de la cámara |

## 3. Incidentes automáticos

- Se abre uno cuando una posición **entra** en un estado de alerta (2, 3, 8, 9, 10, 11) y antes no lo estaba.
- **Incidente propio:** pánico/SOS (5), caída (35), ritmo cardiaco (37), colisión (32), volcadura (33), GNSS (34, 40, 41) y sobrecupo (20). En la cámara son las mismas alertas que disparan la ráfaga de fotos. Cada uno tiene su incidente aunque compartan estado, y la descripción dice el evento ("Alerta automática: Volcadura").
- El resto de alertas se agrupa por estado ("Alerta automática: Batería baja").
- Si ya hay un incidente **abierto** de esa misma alerta, no se abre otro: se agrega un seguimiento `Medio = "Alerta automática"` con la alerta, la ubicación y el Id de la posición.
- Solo se cierran con `PATCH /incidentes/:id/finalizar` (front); no hay cierre automático.

---

## 4. Catálogo completo

Tratamiento sugerido para el front: **Urgente** = suena y exige atención; **Aviso** = se resalta sin sonido; **Aviso técnico** = falla del equipo, para soporte; **Informativo** = solo historial.

| Id | Evento | Equipos | Estado | ¿Abre incidente? | Tratamiento |
|---|---|---|---|---|---|
| 1 | Ignición On | AVL legacy, TrackGas, Cámara | 0/1 | No | Informativo |
| 2 | Ignición Off | AVL legacy, TrackGas, Cámara | 0/1 | No | Informativo |
| 3 | Batería baja | TrackGas, Cámara, Reloj, S18 | 9 | Sí (por estado) | Aviso |
| 4 | Alarma de energía (corte o desconexión) | TrackGas, Cámara, S18 | 10 ({S}: 0/1) | Sí (por estado) | **Urgente** |
| 5 | Help Me (pánico / SOS) | AVL legacy, TrackGas, Cámara, Reloj, S18 | 2 ({A}: 0/1/6, ver §4.5) | **Sí, propio** | **Urgente** |
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
| 68 | Robo de vehículo | Cámara | 0/1 | No (pendiente, §6) | Aviso |
| 69 | Encendido ilegal | Cámara | 0/1 | No | Aviso |
| 70 | Desplazamiento ilegal | Cámara | 0/1 | No | Aviso |
| 71 | Apertura ilegal de puerta | Cámara | 0/1 | No | Aviso |

Equipos: **Cámara** = TrackCam AE-DI5052 (springTrackCam); **TrackGas** = VL802 + UL212 (springTrackGas); **AVL legacy** = los ~150 equipos que llegan por Server_Socket de Sion; **Reloj** = FA100S (springFA100S); **S18** = springS18.

---

## 5. Por equipo

### 5.1 Cámara (TrackCam)

- Cada `0x0200` puede traer varias alarmas (bits básicos JT808, TLV de ADAS, DSM, video, conducción brusca o anormal). El socket traduce cada código a su `IdEvento` y elige uno dominante por prioridad: pánico > colisión > volcadura > robo > sobrecupo > energía > batería > ADAS colisión > GNSS > velocidad > IA > técnicas > foto > transmisión.
- Todos los códigos conocidos tienen `IdEvento` (bits básicos 0–14 y 18–31 incluidos). Un código desconocido de conducción brusca o anormal cae en 30 o 29; cualquier otro, en 9 Transmisión.
- La ráfaga de fotos de ambos canales y el incidente propio coinciden: pánico, colisión, volcadura, GNSS (3 variantes) y sobrecupo.
- A `jt808.alarm.*` (cola de alarmas) solo van pánico, sobrecupo, fatiga, celular y fumar; el resto viaja solo en la posición.
- Código: springTrackCam `src/adapters/jt808/cat-evento.map.ts` y `src/libs/protocol-jt808/alarms/jt808.alarms.ts`.

### 5.2 Reloj (FA100S) y S18

- Reloj: SOS (5), caída (35) y ritmo cardiaco (37) con estado 2 e incidente propio; batería baja (3) con estado 9; pulsera retirada (36) sin alerta; reporte normal 7.
- S18: SOS (5) y caída (35) con estado 2; velocidad (6) con 7; batería (3) con 9; apagado (4) sin estado de alerta.
- Sin GPS, la posición llega con la última ubicación válida y `positionValid = false`; cuando fija, `alarm_location` corrige la ubicación de la alarma.

### 5.3 TrackGas (VL802 + UL212)

- Concox: SOS → 5 (estado 2); corte o desconexión → 4 (10); batería → 3 (9); velocidad → 6 (7); puerta y entrada 1 → 8; ACC → 1/2; vibración y remolque → 7.
- Entrada o salida de geocerca del equipo llega como 9 Transmisión: la geocerca la calcula NextAPI (estado 8).
- Combustible: 38 carga y 39 descarga ya están en el catálogo, pero **el socket todavía no los detecta** (UL212 solo reporta nivel). Falta definir el umbral y probar con más de un equipo.
- Hoy solo se ha conectado un equipo de prueba; la flota productiva de TrackGas no usa este socket.

### 5.4 AVL legacy (Server_Socket de Sion)

Lo que llegó en 7 días (al 28/10/2026, tipo de dispositivo 3):

| IdEvento | Estado | Posiciones |
|---|---|---|
| 9 Transmisión | 0, 1, 4, 5, 6, 8 | 376,600 |
| 1 Ignición On | 0, 1, 4, 5, 6, 8 | 53,192 |
| 6 Exceso de velocidad | 7, 8 | 15,109 |
| 5 Help Me | 0, 1, 6 | 5 |

- Server_Socket solo usa 1, 5, 6 y 9; nunca mandó 2 (ignición off), 3, 4, 7 u 8.
- **El SOS (5) llega sin estado de alerta** (0, 1 o 6, no 2): no aparece como alerta en consola ni abre incidente. Hay que confirmar con el catálogo legacy si es un pánico real o una restauración, y corregirlo en Server_Socket o en el mapper de NextAPI.
- Su catálogo de origen está en la base legacy de Sion (SQL Server); falta compararlo con este.

### 5.5 Paneles AX PRO

No usan `CatEventos`: cada evento trae `codigoSia`, `severidad` (3 urgente, 2 aviso, 1 informativo) y `esRestauracion`. La restauración cierra el evento de la misma zona. Código: springPanel `src/libs/protocol-sia/sia-codes.map.ts`.

---

## 6. Pendientes

1. **AVL legacy:** comparar con el catálogo de la base legacy y resolver el SOS sin estado de alerta (§5.4).
2. **TrackGas:** detección de carga y descarga de combustible en el socket (38/39).
3. **Decidir** si robo de vehículo (68), encendido ilegal (69) y desplazamiento ilegal (70) de la cámara deben abrir incidente; hoy no están en la regla de fotos.
4. **Front:** finalizar incidentes (sin eso, las alertas repetidas solo se agregan como seguimiento) y tratamiento por evento de la §4.
