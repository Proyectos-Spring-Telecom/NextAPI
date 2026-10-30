# Remediación: órdenes de servicio (NextAPI + CRM)

Ruta para quitar los bugs, vicios y deuda técnica que encontró la revisión independiente del 29/10/2026 sobre las etapas 2–3 (NextAPI `2e21da1^..`, crmAPI `0615a31^..`, CrmWEB `a431267^..`).

**Regla de trabajo:** cada bug se reproduce primero con una prueba de punta a punta (`npm run test:e2e-ordenes`) que falla; luego se corrige y la prueba queda en verde. Nada se entrega sin pruebas unitarias, batería de punta a punta y revisión independiente.

Estado: ⬜ pendiente · 🟨 en curso · ✅ hecho (con la prueba que lo demuestra).

**Pruebas que lo demuestran:** `test/e2e-ordenes/robustez.e2e-spec.ts` (un caso por hallazgo, numerado como en esta tabla), `reglas-flujo.e2e-spec.ts` (reglas del flujo contra MySQL real; reemplazan a las unitarias con repositorio simulado) y `flujo-ordenes.e2e-spec.ts` (los cuatro escenarios de negocio). Corrida del 29/10/2026 (tras la tercera revisión): 61/61 sobre el esquema real de producción, con la zona horaria de producción (MySQL `-06:00`, NextAPI `DB_TZ=-00:00`).

**Otros hallazgos de la propia batería:** bitácora demasiado larga al programar muchas unidades (500 después de guardar) → resumen y la bitácora ya no tumba una operación confirmada; dos peticiones idénticas del CRM en el mismo milisegundo → nonce por petición.

**Pendiente:** 0.5 (subir crmAPI y CrmWEB a un repositorio remoto; lo decide Israel). El esquema de producción (0.3) se cargó el 29/10/2026: la batería corre sobre él y comprueba que coincida con las entidades.

## Fase 0 — Red de seguridad

| # | Qué | Estado |
|---|-----|--------|
| 0.1 | Proxy de fallas entre CRM y NextAPI en la batería (caído, lento, error) | ✅ |
| 0.2 | Pruebas de concurrencia (peticiones simultáneas sobre la misma orden) | ✅ |
| 0.3 | Esquema de la batería desde el dump real de producción (`mysqldump --no-data`) + `deploy/sql`; `synchronize` solo para detectar diferencias | ✅ |
| 0.4 | Zona horaria de la batería igual a producción | ✅ |
| 0.5 | crmAPI y CrmWEB en un repositorio remoto | ⬜ (requiere OK) |

## Fase 1 — Integridad de datos

| # | Dónde | Bug | Remedio | Estado |
|---|-------|-----|---------|--------|
| 1.1 | Next | La autorización de desinstalar no queda ligada al vehículo | `IdProductoAutorizacion`; no se cambia el vehículo con autorización; la baja solo de ese vehículo | ✅ |
| 1.2 | Next | Transiciones leer-y-escribir sin condición (cerrar vs cancelar, dos decisiones, reprogramar vs iniciar) | `UPDATE … WHERE Estatus/Autorizacion = esperado`; 0 filas → 409 | ✅ |
| 1.3 | Next | Intentos del código no atómicos; el código se puede regenerar sin tope | Incremento atómico; tope de códigos por orden | ✅ |
| 1.4 | Next/CRM | Cursor de cambios: se atasca (> límite en el mismo segundo) y pierde filas confirmadas tarde | Cursor compuesto (fecha, Id) y traslape de lectura; procesamiento idempotente | ✅ |
| 1.5 | Next | 500 por llave duplicada en `programar`/`iniciar`; `referenciaCrm` reutilizada devuelve órdenes de otro cliente | Respuesta idempotente o 409 | ✅ |
| 1.6 | CRM | Sin outbox: cancelar/reprogramar fallidos no se reintentan | Tabla de operaciones pendientes hacia Next, reintentos en la sincronización | ✅ |
| 1.7 | CRM | Cobro "con el corte" falla en un alta y deja la decisión a medias | Validar antes de Next; en un alta el cargo se crea al instalarse (primer corte) | ✅ |
| 1.8 | CRM | Segunda autorización en la misma orden pierde el cobro; cargo duplicado; cargo vivo al cancelar | Sobreprecio y cargo por autorización (único por orden de Next); cancelar la orden cancela sus cargos pendientes | ✅ |
| 1.9 | CRM | Cursor avanza antes de procesar; sincronizaciones en paralelo; la liga por aproximación roba cierres | Procesar y luego avanzar; una sola corrida (candado); excluir órdenes con referencia | ✅ |
| 1.10 | CRM | Reagendar tras una no cumplida se revierte solo | Programar con el estado vivo de Next; al regresar a por agendar se limpia la cita | ✅ |
| 1.11 | Next | Pruebas `solicitada` huérfanas; compartir/ver código mueven el cursor del CRM | Anularlas al cerrar sin hacer; esas escrituras no tocan `FechaActualizacion` | ✅ |

## Fase 2 — Seguridad y exposición

| # | Qué | Remedio | Estado |
|---|-----|---------|--------|
| 2.1 | HMAC sin método/ruta ni protección de repetición | Firma v2 `ts.MÉTODO ruta\ncuerpo` + rechazo de firmas repetidas en la ventana | ✅ |
| 2.2 | Admin pide y valida el código solo | Código solo del técnico asignado | ✅ |
| 2.3 | Cargos con permiso de instalaciones | Crear cargos exige `cobranza.editar` | ✅ |
| 2.4 | CRM decide autorizaciones de órdenes de Next; operador cambia pruebas ya validadas | Mismo filtro de pertenencia; solo `solicitada` se valida | ✅ |
| 2.5 | PDF al cliente con datos internos; correo por monitoreo a cualquiera; error SMTP expuesto | PDF sin "Cobrable" ni notas internas; compartir: técnico dueño y roles 1–3; error genérico | ✅ |
| 2.6 | IMEI completos y datos crudos de Next en el CRM | Enmascarar; mapear campos | ✅ |
| 2.7 | WhatsApp sin lada | 10 dígitos → 52 | ✅ |

## Fase 3 — Deuda técnica

| # | Qué | Remedio | Estado |
|---|-----|---------|--------|
| 3.1 | Sin índices para pantallas de sondeo | (Estatus, CodigoExpira), (Estatus, Autorizacion) | ✅ |
| 3.2 | Roles y pertenencia repartidos en 4 y 3 lugares | Un módulo de permisos de órdenes | ✅ |
| 3.3 | CRM lee Next por API y por base (ya divergen) | Solo API | ✅ |
| 3.4 | La lista del CRM sincroniza en línea; N+1; `uno()` recorre toda la lista | Sincronización en segundo plano; consultas por lote | ✅ |
| 3.5 | Lógica de transición de la App etapa 1 repartida | Una sola función, con criterio de retiro | ✅ |
| 3.6 | Paro de motor obligatorio siempre | Solo si el vehículo tiene inmovilizador | ✅ |

## Segunda revisión (29/10/2026)

Una segunda revisión independiente, sobre las correcciones anteriores, encontró que varias no se sostenían del todo y algunos bugs nuevos. Pruebas: `robustez.e2e-spec.ts`, bloque "Segunda revisión" (`[R2.n]`).

| # | Dónde | Hallazgo | Remedio | Estado |
|---|-------|----------|---------|--------|
| R2.1 | CRM | El outbox podía mandar un cambio de cita viejo después del nuevo, o la misma operación dos veces | Una operación nueva reemplaza la pendiente que ya no aplica (`reemplazada`); se toma con `en_curso` antes de llamar a Next; en orden por Id; si una falla, las siguientes de esa orden esperan; las `en_curso` abandonadas (> 5 min) se recuperan | ✅ |
| R2.2 | Next/CRM | Respuesta perdida: Next canceló, el reintento recibía 409 y daba un aviso falso | Cancelar una ya cancelada es idempotente (200) | ✅ |
| R2.3 | CRM | Una operación que Next rechaza siempre (401, 500) se reintentaba sin fin | Espera creciente (`ProximoIntento`, `NEXT_OUTBOX_ESPERA_MS`, hasta 15 min) y tope (`NEXT_OUTBOX_MAX_INTENTOS`, 20): queda `rechazada` con aviso | ✅ |
| R2.4 | CRM | El último cierre copiado al reagendar no contaba como cambio: la orden no quedaba instalada | Barrido independiente del cursor: órdenes abiertas con todas sus unidades hechas | ✅ |
| R2.5 | CRM | Cancelar una orden a medias cancelaba el cobro de una unidad ya hecha | Solo se cancelan los sobreprecios de unidades no cerradas en Next | ✅ |
| R2.6 | Next | El código correcto se aceptaba aunque ya se hubiera emitido otro; el tope de códigos no tenía salida | Validación condicional al código vigente (409); `POST /:id/codigo/reiniciar` para roles 1–3 | ✅ |
| R2.7 | Next | Notas de autorización, sobreprecio y cancelación salían en el PDF del cliente | Columna `NotasInternas` | ✅ |
| R2.8 | CRM | Con Next lento, mover una orden de N unidades hacía esperar N × 15 s | Tiempo de espera `NEXT_API_TIMEOUT_MS` (8 s); tras la primera falla las demás solo se encolan | ✅ |
| R2.9 | CRM | Cancelar con una unidad ya iniciada encolaba una cancelación que Next siempre rechaza (avisos repetidos) | Solo se cancela lo `programada`; un aviso para lo iniciado | ✅ |
| R2.10 | CRM | Registrar dos veces el sobreprecio de una autorización: `INSERT IGNORE` ocultaba la diferencia | 409 antes de llamar a Next | ✅ |
| R2.11 | CRM | Transiciones del CRM sin condición (cancelar vs cierre de la app, regreso a por agendar vs reagendado) | `UPDATE … WHERE Estatus IN (…)` / misma cita; 0 filas → 409 o se omite (unitarias de `instalaciones.service.spec.ts`) | ✅ |
| R2.12 | CRM | Orden de bloqueo distinto entre cobrar y cancelar (deadlock) | Ambos bloquean primero la orden (`FOR UPDATE`) | ✅ |
| R2.13 | CRM | Un registro malo de Next tumbaba toda la sincronización; sobreprecios "con el corte" que fallaban no se reintentaban | Revisión por orden con aviso y se sigue; el barrido reintenta los diferidos sin avisar otra vez; el último error queda en `SincronizacionNext` | ✅ |
| R2.14 | Next | `os_cambiar_indice` no era idempotente con columnas distintas; las órdenes de la etapa 1 pedían "vehículo con equipo" | Compara columnas y cambia en un solo `ALTER`; el faltante no aplica a la etapa 1 | ✅ |

## Tercera revisión (29/10/2026)

Revisión independiente de la segunda ronda. Pruebas: bloque "Tercera revisión" (`[R3.n]`) y unitarias del CRM.

| # | Dónde | Hallazgo | Remedio | Estado |
|---|-------|----------|---------|--------|
| R3.1 | CRM | Una cancelación en espera de reintento salía después de un reagendado y lo deshacía | La última operación gana: toda operación nueva reemplaza lo pendiente de esa orden de Next, sea del tipo que sea | ✅ |
| R3.2 | CRM | Una operación abandonada a la mitad (proceso caído) se reenviaba después de una más nueva | No sale una operación mientras haya una anterior de la misma orden en curso; al recuperar una abandonada, si ya hay una más nueva queda `reemplazada` | ✅ |
| R3.3 | CRM | Cancelar la orden cancelaba el sobreprecio de unidades cerradas en Next aún sin sincronizar, o en curso (desinstalación quizá hecha), sin aviso; un sobreprecio «con el corte» de una unidad hecha en una orden cancelada nunca se cobraba | Se refresca de Next antes de cancelar; solo se cancela lo que Next confirma que no se hizo (programada, cancelada, no cumplida). El barrido cobra lo cerrado y cancela lo que Next termine sin hacer; «mandar a cobranza» en una orden cancelada solo toma unidades cerradas | ✅ |
| R3.4 | Next/CRM | Cancelar una orden ya cancelada por operación dejaba en el CRM el motivo del CRM | Next devuelve `data.claveMotivo`; el CRM guarda ese | ✅ |
| R3.5 | CRM | Editar la orden (cita, lugar…) podía reabrir una ya instalada o cancelada mientras tanto | Condicional a que siga abierta; 409 (unitaria) | ✅ |
| R3.6 | CRM | El barrido repetía el mismo aviso en cada corrida | No se repite el último aviso igual de la misma orden (unitaria) | ✅ |
| R3.7 | CRM | `028` no llevaba a la forma actual una `OperacionesNext` creada por su versión anterior | El procedimiento agrega `ProximoIntento`, amplía `Estatus` y ajusta índices (probado: versión anterior + nueva dos veces) | ✅ |

DDL: `deploy/sql/OrdenesServicioEtapa4.sql` (Next, agrega `NotasInternas`) y `crmAPI/sql/028_remediacion_next.sql` (reescrito: idempotente, `ProximoIntento`, estatus `en_curso`/`reemplazada`). Ninguno se había aplicado en producción.

## Fase 4 — Práctica permanente

- Definición de terminado: unitarias + batería de punta a punta + revisión independiente + documentación del cambio para back y front.
- La batería corre antes de cada despliegue de NextAPI o crmAPI.
