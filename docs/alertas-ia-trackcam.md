# Alertas de IA de la TrackCam (ADAS/DSM): flujo y configuración

**Para:** equipo del frontend de Next
**Fuente:** gateway springTrackCam (cámara Hikvision AE-DI5052-G40PRO) y NextAPI (`dev-isra`)
**Actualizado:** 11/11/2026

Resumen en [front-next.md](front-next.md) §31. Catálogo completo de eventos: [catalogo-eventos.md](catalogo-eventos.md) y front-next §13.

## 1. En pocas palabras

- La cámara tiene IA en dos cámaras:
  - **ADAS** (cámara frontal): colisión, carril, distancia, peatón, obstáculo.
  - **DSM** (cámara de cabina): fatiga, celular, fumar, distracción, cinturón.
- También detecta la **conducción brusca** con su acelerómetro.
- Cada alerta llega a Next como un **evento de la posición** (`idEvento`). No hay endpoint ni cola aparte para el front.
- **Una alerta = un registro.** Si se repite seguida, solo llega la primera (§2, paso 2).
- **Ninguna alerta de IA toma foto ni abre incidente**, salvo el **sobrecupo de pasajeros**.
- **La configuración de la IA se hace en la cámara**, con la herramienta del fabricante (HikDashcam). Next todavía no puede cambiarla, aunque `TrackcamConfig` tenga los interruptores (§5).

## 2. Flujo de una alerta

```
Cámara (IA)        Gateway springTrackCam                NextAPI                         Front
───────────        ──────────────────────                ───────                         ─────
detecta  ──0x0200──► 1. traduce a idEvento
                    2. agrupa repeticiones (60 s)
                    3. foto solo si es sobrecupo
                    4. publica jt808.position ──────────► guarda en Posiciones
                                                          actualiza UltimaPosicion ──────► monitoreo:actualizacion
                                                          incidente solo si aplica ──────► consola:actualizacion
                    5. (algunas) jt808.alarm.* ─────────► solo auditoría (no cambia nada en pantalla)
```

1. **Traducción.** La cámara manda la alerta dentro de su reporte de posición. El gateway la convierte al `idEvento` del catálogo `CatEventos`. Si en un mismo reporte vienen varias, va la de mayor prioridad (pánico, colisión, volcadura, robo, sobrecupo, energía… y al final las informativas). La lista está en `cat-evento.map.ts` del gateway.
2. **Agrupación (60 s).** La cámara repite la misma alerta en cada reporte mientras dura. El gateway publica **solo la primera de cada episodio**: si el mismo código de la misma cámara sigue llegando con menos de 60 s entre reportes, no se vuelve a publicar (`GATEWAY_ALARM_REPEAT_WINDOW_SEC=60`). El pánico no se agrupa. Por eso **el front no puede saber cuánto duró una alerta**, solo cuándo empezó.
3. **Foto.** Las alertas de IA no generan foto. La única excepción es el **sobrecupo de pasajeros**, que dispara una ráfaga de los canales 1 y 2 como evidencia de quién va en cabina. Esa foto llega aparte, como posición con `idEvento` 10 (Cámara) y sus `Foto1..2`. El gateway manda su motivo (`trigger = alarm`, front-next §7), pero NextAPI todavía no lo expone. La cámara no toma fotos por su cuenta (`0x0052 = 0`).
4. **Posición.** NextAPI guarda la posición en `Posiciones` con `IdEvento` y `Estado`, actualiza `UltimaPosicion` y avisa por Socket.IO (`monitoreo:actualizacion` y `consola:actualizacion`, front-next §25).
5. **Cola de alarmas.** Fatiga, celular, fumar, sobrecupo y pánico van además a `jt808.alarm.*`. NextAPI **solo la audita**: no crea posición ni incidente. El front no depende de ella.

## 3. Qué hace cada alerta

`Estado`: 13 = alerta de conducta; 3 = alerta que abre incidente; 7 = exceso de velocidad; **0/1 = sin estado propio** (detenido / en movimiento, como una posición normal).

### Conductor (DSM, cámara de cabina)

| idEvento | Alerta | Estado | Foto | Incidente | Tratamiento |
|---|---|---|---|---|---|
| 21 | Fatiga / somnolencia | 13 | No | No | Aviso |
| 22 | Uso de celular | 13 | No | No | Aviso |
| 23 | Fumar | 13 | No | No | Aviso |
| 24 | Distracción (no mira al frente) | 0/1 | No | No | Aviso |
| 25 | Conductor ausente | 0/1 | No | No | Aviso |
| 26 | Sin cinturón | 0/1 | No | No | Aviso |
| 27 | Cámara del conductor obstruida | 0/1 | No | No | Aviso técnico |
| 28 | Cambio de conductor | 0/1 | No | No | Informativo |
| 58 | Sin cubrebocas | 0/1 | No | No | Informativo |
| 59 | Captura facial | 0/1 | No | No | Informativo |
| 60 | Bloqueo infrarrojo (gafas) | 0/1 | No | No | Aviso |
| **20** | **Sobrecupo de pasajeros** | **3** | **Sí (canales 1 y 2)** | **Sí, propio** | **Urgente** |

### Entorno (ADAS, cámara frontal)

| idEvento | Alerta | Estado | Foto | Incidente | Tratamiento |
|---|---|---|---|---|---|
| 12 | Colisión frontal | 0/1 | No | No | Aviso |
| 13 | Salida de carril | 0/1 | No | No | Aviso |
| 14 | Distancia insuficiente al de adelante | 0/1 | No | No | Aviso |
| 15 | Colisión con peatón | 0/1 | No | No | Aviso |
| 16 | Cambios de carril frecuentes | 0/1 | No | No | Aviso |
| 17 | Obstáculo | 0/1 | No | No | Aviso |
| 18 | Falla del sistema ADAS | 0/1 | No | No | Aviso técnico |
| 19 | Reconocimiento de señal | 0/1 | No | No | Informativo |
| 6 | Exceso sobre la señal de tránsito (llega como exceso de velocidad) | 7 | No | No | Aviso |

### Conducción (acelerómetro y datos del vehículo)

| idEvento | Alerta | Estado | Foto | Incidente | Tratamiento |
|---|---|---|---|---|---|
| 51 | Aceleración brusca | 0/1 | No | No | Aviso |
| 52 | Frenado brusco | 0/1 | No | No | Aviso |
| 53 | Giro brusco | 0/1 | No | No | Aviso |
| 54 | Ralentí prolongado | 0/1 | No | No | Informativo |
| 55 | Apagado anormal del motor | 0/1 | No | No | Aviso |
| 56 | Punto muerto en marcha | 0/1 | No | No | Aviso |
| 57 | Sobre-revoluciones | 0/1 | No | No | Aviso |
| 29 / 30 | Conducción anormal / brusca (genérico, sin detalle) | 0/1 | No | No | Aviso |

### Fallas de la IA y del video

| idEvento | Alerta | Estado | Tratamiento |
|---|---|---|---|
| 31 | Señal de video enmascarada (posible sabotaje) | 0/1 | Aviso técnico |
| 47–50 | Pérdida de señal, falla de almacenamiento, falla de dispositivo, memoria de alarmas llena | 0/1 | Aviso técnico |

Las capturas que la IA toma por su cuenta ("captura activa ADAS" y "captura automática DSM") llegan como `idEvento` 10 (Cámara), informativo.

**No son de IA** y sí abren incidente con foto: pánico (5), colisión por acelerómetro (32), volcadura (33) y GNSS (34, 40, 41). Robo (68), encendido ilegal (69) y desplazamiento ilegal (70) abren incidente sin foto. Ver front-next §13.

## 4. Qué debe hacer el front

- **Identificar la alerta por `idEvento`, no por `Estado`.** Casi todas las de IA llegan con Estado 0/1: por el estado no se distinguen de una posición normal. El nombre sale de `CatEventos` (`nombreEvento`).
- **Aviso:** resaltar en la lista y en el mapa, **sin sonido**, agrupado por equipo. Tienen el mismo trato las de Estado 13.
- **Aviso técnico:** falla o sabotaje de la cámara. Es para soporte, no para el monitorista; conviene un filtro aparte.
- **Informativo:** solo en el historial y el recorrido.
- **Urgente (sobrecupo):** abre incidente, suena y se finaliza desde el front (front-next §14), igual que pánico o colisión.
- **No mostrar "ver foto" ni "ver video" en las alertas de IA:** no tienen. El sobrecupo sí: su foto llega en la posición siguiente (`idEvento` 10).
- **No contar repeticiones como alertas distintas ni calcular duraciones:** cada registro es el inicio de un episodio. Otro registro del mismo tipo significa que la alerta se detuvo más de 60 s y volvió a empezar.
- **Historial y reportes:** filtrar por `idEvento` (12–31 y 51–60 son de la cámara).

## 5. Configuración de la IA

### 5.1 Qué hay en Next

`TrackcamConfig` (CRUD `/dispositivos/trackcam`, `PATCH /dispositivos/trackcam/:id`) guarda por cámara:

- **Canales:** `canal1Activo`–`canal4Activo`.
- **Intervalos:** `intervaloPosicionSegundos`, `intervaloPosicionDetenidoSegundos`, `intervaloImagenSegundos`.
- **Interruptores y umbrales de IA:**
  - DSM: `alarmaFatiga` + `umbralFatiga`, `alarmaTelefono`, `alarmaFumar`, `alarmaDistraccion`, `alarmaConductorAusente`, `alarmaCinturon`, `alarmaObstruccionCamara`;
  - ADAS: `alarmaColisionFrontal`, `alarmaSalidaCarril`, `alarmaDistanciaCorta` + `distanciaCortaSegundos`, `alarmaColisionPeaton`, `alarmaCambioCarrilFrecuente`, `alarmaExcesoSenalTransito`, `alarmaObstaculo`, `alarmaFallaAdas`;
  - conducción: `alarmaAceleracionBrusca` + `umbralAceleracionG`, `alarmaFrenadoBrusco` + `umbralFrenadoG`, `alarmaGiroBrusco` + `umbralGiroG`, `alarmaRalenti`, `alarmaApagadoAnormal`;
  - otros: `alarmaAproximacionTrasera*`, `alarmaExcesoVelocidad` + `velocidadMaximaKmh`, `alarmaFatigaTiempo`, `alarmaColision` + `colisionAceleracionG`, `alarmaVolteo`, `velocidadMinimaAlarmasKmh`.

### 5.2 Qué se aplica hoy

| Campos de `TrackcamConfig` | ¿Llega a la cámara? |
|---|---|
| `canal1Activo`–`canal4Activo` | **Sí.** El gateway los usa para elegir los canales de foto y video cuando no se manda `channelId`. |
| `intervaloImagenSegundos` | Solo en contingencia. Hoy manda la política de flota: foto cada 10 min con el motor encendido y cada 2 h apagado. |
| `intervaloPosicionSegundos`, `intervaloPosicionDetenidoSegundos` | **No.** Los intervalos de reporte se cambian en **parámetros de la cámara** (front-next §24). |
| Todos los `alarma*`, `umbral*`, `distanciaCortaSegundos`, `colisionAceleracionG`, `velocidadMinimaAlarmasKmh`, `velocidadMaximaKmh` | **No. Solo se guardan.** Ningún proceso los manda a la cámara. |

**Ojo con `velocidadMaximaKmh`:** existe en los dos lados con el mismo nombre. La de `TrackcamConfig` no hace nada. La que sí cambia la cámara es la de **parámetros** (`PUT /instalaciones/:id/trackcam/parametros { "velocidadMaximaKmh": 100 }`, parámetro JT808 `0x0055`, front-next §24).

### 5.3 Por qué

- El protocolo JT808 no trae parámetros estándar para la IA. La consola de parámetros (front-next §24) solo cubre los 12 parámetros JT808 de reporte, velocidad y conducción. El gateway rechaza cualquier otro.
- Hikvision configura su IA con su protocolo propio (ISAPI). El 09/11 se probó ISAPI a través de JT808 y **el firmware de la cámara responde "no soportado"**.
- Por eso hoy la IA se configura **en la cámara**, cámara por cámara, con HikDashcam: qué alertas están activas, la sensibilidad y la velocidad mínima a la que se disparan. Lo hace el instalador o soporte.

### 5.4 Qué debe hacer el front

- **No presentar los interruptores de IA de `TrackcamConfig` como si cambiaran la cámara.** Recomendación: ocultarlos.
- Si se dejan visibles, ponerlos en solo lectura con la leyenda "Referencia: la IA se configura en la cámara con HikDashcam".
- Para cambiar intervalos de reporte o velocidad máxima, usar la pantalla de **parámetros de la cámara** (front-next §24).
- Los canales activos sí se editan en `TrackcamConfig`.

## 6. Pendiente (no bloquea al front)

- **Estados propios para la IA:** se propusieron 14 (alerta de entorno, ADAS) y 15 (falla o sabotaje de cámara), sin aprobar. Si se aprueban, cambiaría el `Estado` de esas alertas. Si el front ya identifica la alerta por `idEvento`, no le afecta.
- **Volcadura (33):** en pruebas llegaron 35 avisos, probablemente falsos por el montaje o el umbral de la cámara. Sigue abriendo incidente.
- **Aplicar la IA desde Next:** requiere que Hikvision habilite la configuración remota en el firmware, u otro canal. Mientras tanto, §5.4.
