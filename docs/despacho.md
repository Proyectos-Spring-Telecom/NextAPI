# Despacho de rutas y trabajos (guía para el front)

- **Ruta:** una plantilla con la secuencia de puntos de interés y, si se quiere, la ventana de llegada de cada uno (`HH:mm`).
- **Trabajo:** lo asignado a una unidad (`idInstalacion`) en una fecha. Al crearlo copia las paradas de la ruta o recibe paradas sueltas. Editar la ruta después no cambia los trabajos ya creados.
- **Cumplimiento:** se calcula cada vez que se consulta, con las posiciones de la unidad. No hay que ligar los puntos de interés al vehículo.
- **Chofer:** no se captura aquí; la asignación chofer–unidad es de ShiftControl.

## Endpoints

| Acción | Ruta | Roles |
|---|---|---|
| Crear ruta | `POST /despacho/rutas` `{ idCliente, nombre, descripcion?, paradas: [{ idPuntoInteres, horaDesde?, horaHasta? }] }` | SA, Dev, Admin, Jefe de monitoreo y Cliente |
| Listar o ver rutas | `GET /despacho/rutas?idCliente=` · `GET /despacho/rutas/:id` | Todos (también con llave de API) |
| Editar ruta | `PATCH /despacho/rutas/:id` (`paradas` reemplaza todas; `estatus` 0 la desactiva) | Escritura |
| Crear trabajo | `POST /despacho/trabajos` `{ idInstalacion, idRuta? \| paradas?, titulo, notas?, fecha, inicio?, fin? }` | Escritura |
| Listar trabajos | `GET /despacho/trabajos?fechaInicio=&fechaFinal=&idCliente=&idInstalacion=` (máximo 31 días) | Todos (también con llave de API) |
| Ver trabajo | `GET /despacho/trabajos/:id`, con las paradas y su cumplimiento | Todos (también con llave de API) |
| Editar o cancelar | `PATCH /despacho/trabajos/:id` · `PATCH /despacho/trabajos/:id/cancelar` `{ motivo }` | Escritura |

Los puntos de interés deben ser del cliente, de sus hijos o de sus padres, igual que en el reporte de paso por puntos de interés. Máximo 50 paradas.

## Estados

**Parada:**
- `pendiente`: aún no llega;
- `en_sitio`: llegó y no ha salido;
- `a_tiempo` / `tarde` / `antes`: llegó dentro, después o antes de su ventana;
- `visitada`: llegó y la parada no tiene ventana;
- `no_visitada`: pasó su ventana, o el trabajo terminó, sin llegar.

Cada parada trae `llegada`, `salida` y `minutosEnSitio`. Llega al entrar al radio del punto y sale al alejarse más que el radio más un margen (15 m o 20 %).

**Trabajo:**
- `programado`: aún no empieza;
- `en_curso`;
- `completado`: visitó todas y salió de la última;
- `incompleto`: terminó sin visitar todas;
- `cancelado`.

Además trae los conteos `visitadas`, `aTiempo`, `tarde` y `noVisitadas`, y `enOrden`, que dice si siguió la secuencia.

## Ideas de presentación

- **Tablero del día:** una fila por trabajo, con unidad, avance (visitadas / paradas), estado en color y alertas de `tarde` o `no_visitada`.
- **Detalle:**
  - el mapa con la ruta planeada (pines numerados) y el recorrido real de la unidad (`/monitoreo/:id/historico`);
  - la lista de paradas con su llegada, salida y estado.
