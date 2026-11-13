# Reportes de jornada y motor on/off (guía para el front)

Tres endpoints nuevos y un parámetro opcional en dos existentes. Todos son de solo lectura: se calculan al consultar con las posiciones del periodo. El contrato completo y los ejemplos están en Swagger, en la etiqueta **Reportes**.

## Endpoints

Los tres reciben el mismo body (`JornadaDto`):

```json
{ "idCliente": 15, "filtro": "placa", "valores": ["PXP613F"], "fechaInicio": "2026-11-12", "fechaFinal": "2026-11-12" }
```

- `fechaFinal` es opcional (por defecto, `fechaInicio`). El máximo es 31 días.
- `filtro` / `valores` funcionan igual que en distancia. Sin ellos, el reporte cubre toda la flota del alcance.

| Endpoint | Para qué | Respuesta |
|---|---|---|
| `POST /reportes/flota-dia` | Tabla de la flota: una fila por unidad y día. | `data.filas[]` con el resumen de la jornada. |
| `POST /reportes/jornada` | El detalle de una unidad: la barra del día. | `data.unidades[].jornadas[]` con el resumen + `tramos`, `ciclos`, `cambiosEstado` y `eventos`. |
| `POST /reportes/motor` | Medición de motor on/off. | `data.unidades[]` con `horasMotor`, `porDia[]` y `ciclos[]`. |
| `POST /reportes/paradas` | Paradas con duración, motor y lugar. Acepta `minutosMinimos` (opcional). | `data.unidades[].paradas[]`: `inicio`, `fin`, `min`, `motor` (`encendido` / `apagado` / `mixto` / `sin_ignicion`), `lat` / `lng`, `geocercas[]` y `puntoInteres`. |

**Resumen de cada día:**
- `primerEncendido` y `ultimoApagado`;
- `encendidoDesdeDiaAnterior` y `terminaEncendido`;
- `primerMovimiento` y `ultimoMovimiento`;
- `jornadaMin`, `km`, `horasMotor`, `velocidadMax` y `velocidadPromedio`;
- `tiempos` (`movimientoMin`, `detenidoEncendidoMin`, `apagadoMin`, `detenidoMin`, `sinDatosMin`);
- `ciclosMotor`, `excesosVelocidad`, `posiciones` y `reportaIgnicion`.

**`incluirJornada: true`** en `POST /reportes/velocidad` y `POST /reportes/distancia`:
- en velocidad agrega `data.jornadas[]`, con las mismas filas de flota-dia;
- en distancia agrega `recorridos[].jornada[]`, el resumen por día.

Sin el parámetro, las respuestas no cambian.

## Reglas

- **El día va de 00:00 a 23:59.** Un tramo que cruza la medianoche se parte. El día en curso termina en la hora actual.
- **Semáforo:** la unidad está detenida con velocidad menor a 5 km/h o con la ignición apagada. Es el mismo umbral con que el socket pone `Estado` 0, así que la barra y el semáforo coinciden, y el ruido del GPS parado (1–4 km/h) no cuenta como movimiento.

| `tipo` de tramo | Cuándo | Color sugerido |
|---|---|---|
| `movimiento` | Velocidad ≥ 5 km/h | Verde |
| `detenido_encendido` | Menos de 5 km/h con motor encendido | Ámbar |
| `apagado` | Ignición apagada | Gris |
| `detenido` | Menos de 5 km/h en equipos sin ignición (teléfono, reloj) | Ámbar claro |
| `sin_datos` | Hueco mayor al doble del intervalo de reporte con motor encendido (mínimo 10 min) | Rayado |

- Apagada, una unidad que reporta cada 2 h sigue contando como apagada; ese hueco no es `sin_datos`.
- **Un ciclo de motor** va del encendido al apagado. Un hueco `sin_datos` entre dos tramos encendidos queda dentro del ciclo (`sinDatosMin`).
- **Distancia:** solo cuenta entre coordenadas medidas.
- **Equipos sin ignición** (`reportaIgnicion: false`): no tienen ciclos ni horas de motor. Para ellos se usan `primerMovimiento` y `ultimoMovimiento`.
- **`eventos`** trae los que no son informativos (exceso, alertas, ADAS/DSM). El encendido y el apagado van en `ciclos`.
- **`cambiosEstado`** compara cada posición con el estado con que amaneció la unidad.

## Ideas de presentación

- **Flota del día:**
  - columnas de primer encendido, último apagado, horas de motor, km, % en movimiento, detenido encendido y excesos;
  - ordenable;
  - un clic abre la jornada.
- **Jornada:**
  - una barra de 24 h con los tramos por color;
  - marcadores de `eventos`;
  - tarjetas de encendido, apagado, km y horas;
  - la lista de paradas, de `POST /reportes/paradas`, con la dirección resuelta en el front con OpenStreetMap.
- **Paradas:**
  - un mapa con un pin por parada, con color según `motor`;
  - una tabla con duración, geocerca y punto de interés;
  - un filtro de minutos mínimos en el front.
  - Una parada que cruza la medianoche sale en los dos días (`continuaDelDiaAnterior` / `continuaAlDiaSiguiente`); el front puede unirlas.
- **Motor:**
  - una gráfica de horas de motor por día (`porDia`);
  - la tabla de ciclos;
  - un ranking de unidades por horas de motor o por tiempo detenido encendido.

## Odómetro y horas de motor acumulados

| Endpoint | Para qué |
|---|---|
| `POST /reportes/contadores` | Odómetro y horas de motor actuales por vehículo (`filtro` / `valores` como siempre). |
| `POST /reportes/odometro` | Por día: `km`, `odometroAlCierre`, `horasMotor` y `horasMotorAlCierre`. Hasta 366 días. |
| `PUT /reportes/contadores/:idProducto` | Captura la lectura del tablero: `{ "km": 215097, "horasMotor": 5120.5, "fecha": "2026-11-13 08:00:00" }` (uno o ambos). Roles SA, Dev, Admin y Cliente. Queda en bitácora. |

- **Base:** la última lectura capturada (`fuente: captura`). Sin ella, `Vehiculos.KM` y 0 horas en la fecha de alta del vehículo (`fuente: alta_vehiculo`).
- **Acumulado:** a la base se le suma lo de cada día **posterior** al de la lectura, más el día en curso.
- **`historialCompleto: false`:** el resumen diario todavía no cubre desde la base, así que el valor se queda corto. Conviene mostrarlo como "estimado parcial" o pedir la lectura del tablero.
- **`odometroEquipo`:** lo que reporta la cámara, sin ajustar. Puede venir en `null`.

**Resumen diario (tabla `ResumenDiarioUnidad`):**
- se llena solo: ayer, poco después de medianoche;
- hacia atrás completa un día cada 10 min, hasta 60 días;
- `POST /reportes/resumen-diario/recalcular` (SA y Dev) rehace días ya guardados.

**Ideas de presentación:**
- en la ficha del vehículo, el odómetro y las horas con la fecha de la última lectura y un botón "Capturar lectura";
- una gráfica de km por día con la línea del odómetro;
- un aviso cuando `historialCompleto` es falso.
