# Resumen de análisis — BD Next (respaldo 2026-03-09)

Análisis del archivo `Next20260309.sql` en comparación con el proyecto **NextAPI** y la documentación (`CONTRATO-PROYECTO-NEXTAPI.md`, `CONTEXTO-PROYECTO.md`).

---

## 1. Información general del respaldo

| Campo | Valor |
|-------|-------|
| **Origen** | Host: 216.238.90.14, DB: `Next` |
| **Fecha respaldo** | 2026-03-09 |
| **Motor** | MySQL 8.0.45 |
| **Charset** | utf8mb4, collation utf8mb4_0900_ai_ci |
| **Total tablas** | 37 |

---

## 2. Tablas en la BD

### 2.1 Tablas core (auth, multitenancy, auditoría)

| Tabla | Descripción | Estado NextAPI |
|-------|-------------|----------------|
| Bitacora | Auditoría de acciones | ✅ Implementado |
| Clientes | Tenants (multitenancy) | ✅ Implementado |
| Usuarios | Usuarios por cliente | ✅ Implementado |
| Roles | Roles del sistema | ✅ Implementado |
| Permisos | Permisos por módulo | ✅ Implementado |
| Modulos | Catálogo de módulos | ✅ Implementado |
| UsuariosPermisos | Relación usuario–permiso | ✅ Implementado |
| CodigoAutenticacion | Códigos 2FA, recuperación de contraseña | ✅ Implementado |

### 2.2 Catálogos (Cat*)

| Tabla | Registros | API NextAPI |
|-------|-----------|-------------|
| CatCategoriaLicencia | 2 | ✅ |
| CatCategoriaMantenimientoMecanico | 10 | ❌ (Fase 3) |
| CatCaracteristicasEvaluacionMttoMecanico | 35 | ❌ (Fase 3) |
| CatEstatusDispositivo | 6 | ✅ |
| CatEstatusInstalacion | 4 | ✅ |
| CatEstatusMantenimiento | 4 | ❌ (Fase 3) |
| CatEstatusOperador | 6 | ✅ |
| CatEstatusSim | 5 | ✅ |
| CatEstatusVehiculo | 5 | ✅ |
| CatMarcaDispositivo | 9 | ✅ |
| CatMarcaVehiculo | 30 | ✅ |
| CatModeloDispositivo | 22 | ✅ |
| CatModeloVehiculo | 84 | ✅ |
| CatPlanesTelefonia | 6 | ✅ |
| CatReferenciaServicio | 2 | ✅ |
| CatTelefonia | 6 | ✅ |
| CatTipoAlerta | 14 | ✅ |
| CatTipoCombustible | 7 | ✅ |
| CatTipoDispositivo | 4 | ✅ |
| CatTipoGeocerca | 3 | ❌ (Fase 2) |
| CatTipoLicencia | 6 | ❌ Pendiente API |
| CatTipoVehiculo | 10 | ❌ Pendiente API |
| CatTipoVerificaciones | 2 | ❌ (Fase 3) |

### 2.3 Tablas operativas

| Tabla | Registros | API NextAPI |
|-------|-----------|-------------|
| Dispositivos | 0 | 🔲 Pendiente |
| Sims | 0 | 🔲 Pendiente |
| Instalaciones | 0 | 🔲 Pendiente |
| HistoricoInstalaciones | 0 | 🔲 Pendiente |
| Vehiculos | 0 | 🔲 Pendiente |
| Operadores | 0 | 🔲 Pendiente |
| Licencias | 0 | 🔲 Pendiente |

### 2.4 Tablas que NO existen en la BD

| Tabla | Uso esperado |
|-------|--------------|
| **Posiciones** | Coordenadas GPS en tiempo real (CONTEXTO 4.4) |

---

## 3. Diferencias y cambios relevantes

### 3.1 Módulos faltantes en `Modulos`

La tabla `Modulos` tiene: **1, 2, 3, 4, 5, 14, 15, 16, 17, 18, 19** (no hay 6–13, 20, 21).

NextAPI utiliza estos **IdModulo** en Bitácora:

| IdModulo | Módulo | Catálogo asociado | ¿Existe en BD? |
|----------|--------|-------------------|----------------|
| 15 | Dispositivos | CatMarcaDispositivo, CatModeloDispositivo, CatEstatusDispositivo, **CatTipoDispositivo** | ✅ |
| 16 | Vehículos | CatEstatusVehiculo, CatMarcaVehiculo, CatModeloVehiculo, **CatTipoCombustible** | ✅ |
| 17 | Instalaciones | CatEstatusInstalacion | ✅ |
| 18 | Operadores | CatEstatusOperador | ✅ |
| 19 | Licencias | CatCategoriaLicencia | ✅ |
| **20** | Referencia Servicio | CatReferenciaServicio | ❌ **No existe** |
| **21** | Alertas | CatTipoAlerta | ❌ **No existe** |

**Acción recomendada:** Insertar en `Modulos` los registros 20 y 21 para que la Bitácora de CatReferenciaServicio y CatTipoAlerta no falle por violación de FK:

```sql
INSERT INTO Modulos (Nombre, Descripcion, Estatus) VALUES
('Referencia Servicio', 'Catálogo de referencia de servicio (por kilometraje, por tiempo)', 1),
('Alertas', 'Tipos de alertas del sistema de monitoreo', 1);
```

### 3.2 Catálogos con API implementada vs. BD

| Catálogo | En BD | En NextAPI | Coincidencia |
|----------|-------|------------|--------------|
| CatTipoCombustible | Id, Nombre, Estatus | ✅ | ✅ |
| CatTipoDispositivo | Id, Nombre, Descripcion, Estatus | ✅ | ✅ |
| CatTipoAlerta | Id, Nombre, Descripcion, Icono, Severidad, Estatus | ✅ | ✅ |
| CatReferenciaServicio | Id, Nombre, Estatus | ✅ | ✅ |

### 3.3 Catálogos en BD sin API

- **CatTipoLicencia** — Pendiente (requerido para LicenciasModule)
- **CatTipoVehiculo** — Pendiente (requerido para VehiculosModule)
- **CatTipoGeocerca** — Fase 2
- **CatCategoriaMantenimientoMecanico**, **CatCaracteristicasEvaluacionMttoMecanico**, **CatEstatusMantenimiento**, **CatTipoVerificaciones** — Fase 3

### 3.4 HistoricoInstalaciones

La tabla tiene columnas `IdActivos` e `IdPortatiles` con comentarios “pendiente”. Las tablas `Activos` y `Portatiles` **no existen** en la BD actual.

### 3.5 Instalaciones

`IdActivos` e `IdPortatiles` están como DEFAULT NULL y referencian entidades que no existen.

---

## 4. Datos de ejemplo en el respaldo

| Entidad | Cantidad |
|---------|----------|
| Clientes | 2 |
| Usuarios | 2 |
| Roles | 2 |
| Bitacora | 39 registros |
| CatTipoCombustible | 7 (Gasolina Magna, Premium, Diésel, etc.) |
| CatTipoDispositivo | 4 (Rastreador Vehicular, Personal, OBD-II, Activos) |
| CatTipoAlerta | 14 (Exceso de Velocidad, Geocercas, Motor, etc.) |

---

## 5. Resumen ejecutivo

| Aspecto | Estado |
|---------|--------|
| **Estructura BD** | Completa para Fase 1 (flota, dispositivos, instalaciones) |
| **Modulos 20 y 21** | Faltan; agregar para Bitácora de CatReferenciaServicio y CatTipoAlerta |
| **Tabla Posiciones** | No existe; requerida para módulo de monitoreo GPS |
| **CatTipoLicencia, CatTipoVehiculo** | Existen en BD; falta exponerlos vía API |
| **Compatibilidad NextAPI** | CatTipoCombustible, CatTipoDispositivo, CatTipoAlerta, CatReferenciaServicio coinciden en estructura |

---

*Documento generado a partir del análisis de `Next20260309.sql`.*
