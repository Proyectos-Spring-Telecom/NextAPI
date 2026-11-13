# Paro de motor (inmovilizador)

Next manda el paro o la reanudación de motor por la cola de comandos de cada socket (`docs/motor-activos.md` §8). El back está listo. **Funciona solo cuando el socket del equipo implementa el comando y la clase se habilita en `INMOVILIZADOR_CLASES`.** Hoy ningún socket lo implementa.

## Flujo (consola de Next)

1. **Solicitar:** `POST /inmovilizador/:idInstalacion/solicitar` con `{ "accion": "paro" | "reanudar", "motivo": "…" }` (motivo de 10 a 300 caracteres).
   - Para el **paro**, la última posición debe tener 5 min o menos y menos de 5 km/h. Si no, responde 409 con la razón.
   - Si todo está bien, devuelve un `codigo` que vale 2 min.
2. **Confirmar:** `POST /inmovilizador/confirmar` con `{ "codigo": "…" }`.
   - Solo lo puede confirmar **el mismo usuario** que solicitó.
   - Vuelve a revisar la seguridad, porque la unidad pudo arrancar en esos 2 minutos.
   - Encola el comando con **vigencia de 5 min**: si el equipo no lo recibe a tiempo, vence y no se entrega después.
3. **Seguimiento:** `GET /inmovilizador/:idInstalacion/comandos` lista los últimos 20 paros y reanudaciones, cada uno con estatus `pendiente → publicado → recibido → enviado → confirmado`, o `vencido` / `fallido`.

**Roles:** SA, Dev, Admin y Jefe de monitoreo. Todo queda en bitácora, incluidas las solicitudes rechazadas.

## Variables

| Variable | Defecto | Qué hace |
|---|---|---|
| `INMOVILIZADOR_CLASES` | vacío (nadie) | `CLASE:protocolo` separados por coma, p. ej. `AVL:jimi`. La clase es `Instalaciones.Clase`; el protocolo es el socket (`<protocolo>.cmd`). |
| `INMOVILIZADOR_VELOCIDAD_MAX` | 5 | km/h desde los que se rechaza el paro (el mismo umbral del `Estado` 0). |
| `INMOVILIZADOR_POSICION_MAX_MIN` | 5 | Antigüedad máxima de la última posición para el paro. |
| `INMOVILIZADOR_VIGENCIA_MIN` | 5 | Vigencia del comando en la cola. |

## Contrato para el socket

- **Comando** (`telemetry.commands`, routing key `<protocolo>.cmd`, mismo formato que los demás):
  - `tipo`: `PARO_MOTOR` o `REANUDAR_MOTOR`;
  - `contenido`: `{"motivo": "…", "idUsuario": 7}`, informativo;
  - `venceAt`: viene a 5 min.
- **Ejecución:**
  - el socket traduce el tipo al comando de su equipo, por ejemplo el `RELAY,1#` / `RELAY,0#` de los Jimi;
  - **nunca lo manda después de `venceAt`**;
  - si el equipo no está conectado, lo reporta `vencido`.
- **Acuse** (`<protocolo>.cmd.ack`):
  - `confirmado` solo cuando el equipo responde que activó o desactivó el relevador;
  - `fallido` si lo rechaza.
- **El corte a baja velocidad es del equipo:** si el equipo tiene la opción de cortar solo por debajo de cierta velocidad, conviene activarla, porque es la segunda barrera después de la revisión de Next.
