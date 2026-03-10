# Verificación: Entidades vs. Tablas BD

Comparación de los atributos de las **entities** de NextAPI con las **tablas** del respaldo `Next20260309.sql`.

**Leyenda:**
- ✅ = Coincide
- ⚠️ = Diferencia (detalle abajo)
- 📋 = Revisar

---

## 1. Bitacora

| Columna BD | Tipo BD | Entity | Tipo Entity | Estado |
|------------|---------|--------|-------------|--------|
| Id | bigint | id | bigint | ✅ |
| Accion | varchar(45) | accion | varchar 45 | ✅ |
| Descripcion | varchar(250) | descripcion | varchar 250 | ✅ |
| Estatus | varchar(20) | estatus | varchar 20 | ✅ |
| Error | varchar(1000) | error | varchar 1000 | ✅ |
| FechaCreacion | datetime | fechaCreacion | datetime | ✅ |
| IdModulo | bigint DEFAULT NULL | idModulo | bigint | ⚠️ BD permite NULL, entity no nullable |
| IdUsuario | bigint NOT NULL | idUsuario | bigint | ✅ |
| Modulo | varchar(100) | modulo | varchar 100 | ✅ |
| Query | json | query | json | ✅ |

**Nota:** La entity declara `IdModulo` sin `nullable: true`, pero en BD es `DEFAULT NULL`. La Bitácora puede registrar sin módulo.

---

## 2. Clientes

| Columna BD | Tipo BD | Entity | Estado |
|------------|---------|--------|--------|
| Id | bigint | id (bigint) | ✅ |
| IdPadre | bigint | idPadre (bigint) | ✅ |
| RFC | varchar(16) | rfc (varchar 16) | ✅ |
| TipoPersona | tinyint | tipoPersona (tinyint) | ✅ |
| Nombre ... Logotipo | varchar | Todos presentes | ✅ |
| FechaCreacion | datetime | fechaCreacion | ✅ |
| FechaActualizacion | datetime | fechaActualizacion | ✅ |
| Estatus | tinyint | estatus | ✅ |

**Resultado:** ✅ Coincide

---

## 3. Usuarios

| Columna BD | Tipo BD | Entity | Estado |
|------------|---------|--------|--------|
| Id | bigint | id | ✅ |
| UserName | varchar(100) | userName | ✅ |
| PasswordHash | varchar(255) | passwordHash | ✅ |
| PinHash | varchar(255) | pinHash | ✅ |
| EmailConfirmado | tinyint | emailConfirmado | ✅ |
| Nombre ... FotoPerfil | varchar | Todos presentes | ✅ |
| FechaCreacion, FechaActualizacion | datetime | fechaCreacion, fechaActualizacion | ✅ |
| Estatus | tinyint | estatus | ✅ |
| IdRol | bigint | idRol | ✅ |
| IdCliente | bigint | idCliente | ✅ |

**Resultado:** ✅ Coincide

---

## 4. Modulos

| Columna BD | Entity | Estado |
|------------|--------|--------|
| Id, Nombre, Descripcion | ✅ | ✅ |
| FechaCreacion, FechaActualizacion | ✅ | ✅ |
| Estatus | ✅ | ✅ |

**Resultado:** ✅ Coincide

---

## 5. Roles

| Columna BD | Entity | Estado |
|------------|--------|--------|
| Id, Nombre, Descripcion | ✅ | ✅ |
| FechaCreacion, FechaActualizacion | ✅ | ✅ |
| Estatus | ✅ | ✅ |

**Resultado:** ✅ Coincide

---

## 6. Permisos

| Columna BD | Entity | Estado |
|------------|--------|--------|
| Id, Nombre, Descripcion | ✅ | ✅ |
| FechaCreacion, FechaActualizacion | ✅ | ✅ |
| Estatus, IdModulo | ✅ | ✅ |

**Resultado:** ✅ Coincide

---

## 7. UsuariosPermisos

| Columna BD | Entity | Estado |
|------------|--------|--------|
| Id | bigint | ✅ |
| FechaCreacion, FechaActualizacion | ✅ | ✅ |
| Estatus | ✅ | ✅ |
| IdUsuario | bigint | ✅ |
| IdPermiso | bigint | ✅ |

**Resultado:** ✅ Coincide

---

## 8. CodigoAutenticacion

| Columna BD | Entity | Estado |
|------------|--------|--------|
| Id | bigint | ✅ |
| IdUsuario | bigint | ✅ |
| Codigo | varchar(4) | ✅ |
| Tipo | tinyint unsigned | ✅ |
| FechaCreacion | datetime | ✅ (CreateDateColumn) |
| FechaExpiracion | datetime | ✅ |
| Usado | tinyint | ✅ |
| FechaUso | datetime | ✅ |
| Estatus | tinyint | ✅ |

**Resultado:** ✅ Coincide

---

## 9. CatCategoriaLicencia

| Columna BD | Tipo BD | Entity | Estado |
|------------|---------|--------|--------|
| Id | bigint | id (bigint) | ✅ |
| Nombre | varchar(100) | nombre (varchar 100) | ✅ |
| Estatus | tinyint | estatus | ✅ |

**Resultado:** ✅ Coincide

---

## 10. CatEstatusDispositivo

| Columna BD | Tipo BD | Entity | Estado |
|------------|---------|--------|--------|
| Id | **bigint** | id | **int** ⚠️ |
| Nombre | varchar(50) | nombre | ✅ |
| Descripcion | varchar(255) | descripcion | ✅ |
| Estatus | tinyint | estatus | ✅ |

**Diferencia:** La entity usa `type: 'int'` para Id; la BD usa `bigint`. Funcionalmente compatible para rangos típicos, pero no coincide.

---

## 11. CatEstatusInstalacion

| Columna BD | Entity | Estado |
|------------|--------|--------|
| Id | bigint | **int** ⚠️ |
| Nombre, Descripcion, Estatus | ✅ | ✅ |

**Diferencia:** Id: entity `int`, BD `bigint`.

---

## 12. CatEstatusOperador

| Columna BD | Entity | Estado |
|------------|--------|--------|
| Id | bigint | **int** ⚠️ |
| Nombre, Descripcion, Estatus | ✅ | ✅ |

**Diferencia:** Id: entity `int`, BD `bigint`.

---

## 13. CatEstatusSim

| Columna BD | Entity | Estado |
|------------|--------|--------|
| Id | bigint | **int** ⚠️ |
| Nombre, Descripcion, Estatus | ✅ | ✅ |

**Diferencia:** Id: entity `int`, BD `bigint`.

---

## 14. CatEstatusVehiculo

| Columna BD | Entity | Estado |
|------------|--------|--------|
| Id | bigint | **int** ⚠️ |
| Nombre, Descripcion, Estatus | ✅ | ✅ |

**Diferencia:** Id: entity `int`, BD `bigint`.

---

## 15. CatMarcaDispositivo

| Columna BD | Entity | Estado |
|------------|--------|--------|
| Id | bigint | ✅ |
| Nombre | varchar(100) | ✅ |
| SitioWeb | varchar(255) | ✅ |
| Estatus | tinyint | ✅ |

**Resultado:** ✅ Coincide

---

## 16. CatMarcaVehiculo

| Columna BD | Entity | Estado |
|------------|--------|--------|
| Id | bigint | ✅ |
| Nombre | varchar(100) | ✅ |
| Estatus | tinyint | ✅ |

**Resultado:** ✅ Coincide

---

## 17. CatModeloDispositivo

| Columna BD | Entity | Estado |
|------------|--------|--------|
| Id | bigint | ✅ |
| Nombre | varchar(100) | ✅ |
| Descripcion | varchar(255) | ✅ |
| IdMarcaDispositivo | bigint | ✅ |
| Estatus | tinyint | ✅ |

**Resultado:** ✅ Coincide

---

## 18. CatModeloVehiculo

| Columna BD | Entity | Estado |
|------------|--------|--------|
| Id | bigint | ✅ |
| Nombre | varchar(100) | ✅ |
| IdMarcaVehiculo | bigint | ✅ |
| Estatus | tinyint | ✅ |

**Resultado:** ✅ Coincide

---

## 19. CatPlanesTelefonia

| Columna BD | Entity | Estado |
|------------|--------|--------|
| Id | bigint | ✅ |
| Nombre ... Estatus | ✅ | ✅ |
| **FechaCreacion** | datetime NOT NULL | **No existe en entity** ⚠️ |
| **FechaActualizacion** | datetime NOT NULL | **No existe en entity** ⚠️ |

**Diferencia:** La tabla BD tiene `FechaCreacion` y `FechaActualizacion`; la entity no los declara. TypeORM no los mapea ni actualiza.

---

## 20. CatReferenciaServicio

| Columna BD | Tipo BD | Entity | Estado |
|------------|---------|--------|--------|
| Id | **bigint** | id | **int** ⚠️ |
| Nombre | varchar(100) | nombre | ✅ |
| Estatus | tinyint | estatus | ✅ |

**Diferencia:** Id: entity `int`, BD `bigint`.

---

## 21. CatTelefonia

| Columna BD | Entity | Estado |
|------------|--------|--------|
| Id | bigint | ✅ |
| Nombre, NombreCorto | ✅ | ✅ |
| PaisCobertura | varchar(100) | ✅ |
| SitioWeb | varchar(255) | ✅ |
| Estatus | tinyint | ✅ |

**Resultado:** ✅ Coincide

---

## 22. CatTipoAlerta

| Columna BD | Entity | Estado |
|------------|--------|--------|
| Id | bigint | ✅ |
| Nombre | varchar(100) | ✅ |
| Descripcion | varchar(255) | ✅ |
| Icono | varchar(100) | ✅ |
| Severidad | tinyint unsigned | ✅ |
| Estatus | tinyint | ✅ |

**Resultado:** ✅ Coincide

---

## 23. CatTipoCombustible

| Columna BD | Entity | Estado |
|------------|--------|--------|
| Id | bigint | ✅ |
| Nombre | varchar(100) | ✅ |
| Estatus | tinyint | ✅ |

**Resultado:** ✅ Coincide

---

## 24. CatTipoDispositivo

| Columna BD | Entity | Estado |
|------------|--------|--------|
| Id | bigint | ✅ |
| Nombre | varchar(100) | ✅ |
| Descripcion | varchar(255) | ✅ |
| Estatus | tinyint | ✅ |

**Resultado:** ✅ Coincide

---

## Resumen de diferencias

| Entity | Diferencia | Impacto |
|--------|------------|---------|
| **Bitacora** | IdModulo: entity no nullable, BD sí | Bajo; Bitácora acepta IdModulo NULL |
| **CatEstatusDispositivo** | Id: entity `int`, BD `bigint` | Bajo; compatible en rangos usuales |
| **CatEstatusInstalacion** | Id: entity `int`, BD `bigint` | Bajo |
| **CatEstatusOperador** | Id: entity `int`, BD `bigint` | Bajo |
| **CatEstatusSim** | Id: entity `int`, BD `bigint` | Bajo |
| **CatEstatusVehiculo** | Id: entity `int`, BD `bigint` | Bajo |
| **CatPlanesTelefonia** | Faltan FechaCreacion, FechaActualizacion en entity | Medio; la BD las mantiene, TypeORM no las usa |
| **CatReferenciaServicio** | Id: entity `int`, BD `bigint` | Bajo |

---

## Recomendaciones

1. **Tipo Id:** Unificar en `bigint` en las entities donde la BD usa `bigint` (CatEstatus*, CatReferenciaServicio).
2. **CatPlanesTelefonia:** Añadir `FechaCreacion` y `FechaActualizacion` en la entity si se desea gestionarlas desde TypeORM.
3. **Bitacora:** Considerar `nullable: true` en `IdModulo` si se permite registrar Bitácora sin módulo.

---

*Documento generado a partir de la comparación entre `src/entities/*.ts` y `Next20260309.sql`.*
