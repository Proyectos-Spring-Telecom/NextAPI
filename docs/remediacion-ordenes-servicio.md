# Remediación: órdenes de servicio (NextAPI + CRM)

Ruta para quitar los bugs, vicios y deuda técnica que encontró la revisión independiente del 29/10/2026 sobre las etapas 2–3 (NextAPI `2e21da1^..`, crmAPI `0615a31^..`, CrmWEB `a431267^..`).

**Regla de trabajo:** cada bug se reproduce primero con una prueba de punta a punta (`npm run test:e2e-ordenes`) que falla; luego se corrige y la prueba queda en verde. Nada se entrega sin pruebas unitarias, batería de punta a punta y revisión independiente.

Estado: ⬜ pendiente · 🟨 en curso · ✅ hecho (con la prueba que lo demuestra).

**Pruebas que lo demuestran:** `test/e2e-ordenes/robustez.e2e-spec.ts` (un caso por hallazgo, numerado como en esta tabla), `reglas-flujo.e2e-spec.ts` (reglas del flujo contra MySQL real; reemplazan a las unitarias con repositorio simulado) y `flujo-ordenes.e2e-spec.ts` (los cuatro escenarios de negocio). Corrida del 29/10/2026: 47/47 sobre el esquema real de producción, con la zona horaria de producción (MySQL `-06:00`, NextAPI `DB_TZ=-00:00`).

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

## Fase 4 — Práctica permanente

- Definición de terminado: unitarias + batería de punta a punta + revisión independiente + documentación del cambio para back y front.
- La batería corre antes de cada despliegue de NextAPI o crmAPI.
