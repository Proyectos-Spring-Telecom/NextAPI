import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

/**
 * Orden de servicio: una visita del técnico, un tipo de servicio
 * (DDL: deploy/sql/OrdenesServicio.sql). Sin relación a Instalaciones: el
 * PATCH de instalaciones borra la fila anterior y crea otra con Id nuevo.
 */
@applySchema
@Index('UQ_OrdenesServicio_ClaveApp', ['claveApp'], { unique: true })
@Index('UQ_OrdenesServicio_Folio', ['folio'], { unique: true })
@Index('IX_OrdenesServicio_Cliente_Fecha', ['idCliente', 'fechaCreacion'])
@Index('IX_OrdenesServicio_Instalacion', ['idInstalacion'])
@Index('IX_OrdenesServicio_InstalacionResultado', ['idInstalacionResultado'])
@Index('IX_OrdenesServicio_Producto', ['idProducto'])
@Index('IX_OrdenesServicio_Tecnico_Estatus', ['idTecnico', 'estatus'])
@Index('UQ_OrdenesServicio_ReferenciaCrm_Unidad', ['referenciaCrm', 'unidad'], { unique: true })
@Index('IX_OrdenesServicio_Tecnico_Estatus_Cita', ['idTecnico', 'estatus', 'cita'])
@Index('IX_OrdenesServicio_FechaActualizacion', ['fechaActualizacion'])
@Entity('OrdenesServicio')
export class OrdenesServicio {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Folio', length: 20, nullable: true })
  folio: string | null;

  /** NULL mientras está programada: la app la pone al iniciar. */
  @Column('char', { name: 'ClaveApp', length: 36, nullable: true })
  claveApp: string | null;

  @Column('varchar', { name: 'TipoServicio', length: 20 })
  tipoServicio: string;

  @Column('varchar', { name: 'Estatus', length: 12, default: 'borrador' })
  estatus: string;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('bigint', { name: 'IdInstalacion', nullable: true })
  idInstalacion: number | null;

  @Column('bigint', { name: 'IdInstalacionResultado', nullable: true })
  idInstalacionResultado: number | null;

  @Column('bigint', { name: 'IdHistoricoInstalacion', nullable: true })
  idHistoricoInstalacion: number | null;

  @Column('bigint', { name: 'IdProducto', nullable: true })
  idProducto: number | null;

  @Column('bigint', { name: 'IdDispositivoNuevo', nullable: true })
  idDispositivoNuevo: number | null;

  @Column('bigint', { name: 'IdSimNuevo', nullable: true })
  idSimNuevo: number | null;

  @Column('tinyint', { name: 'EstatusSalienteAnterior', nullable: true })
  estatusSalienteAnterior: number | null;

  @Column('tinyint', { name: 'EstatusInstalacionBaja', nullable: true })
  estatusInstalacionBaja: number | null;

  @Column('bigint', { name: 'IdTecnico' })
  idTecnico: number;

  @Column('bigint', { name: 'IdMonitorista', nullable: true })
  idMonitorista: number | null;

  @Column('datetime', { name: 'FechaCaptura', nullable: true })
  fechaCaptura: Date | null;

  @Column('double', { name: 'Lat', nullable: true })
  lat: number | null;

  @Column('double', { name: 'Lng', nullable: true })
  lng: number | null;

  @Column('text', { name: 'Observaciones', nullable: true })
  observaciones: string | null;

  @Column('datetime', {
    name: 'FechaCreacion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaCreacion: Date;

  @Column('datetime', {
    name: 'FechaActualizacion',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  fechaActualizacion: Date;

  @Column('datetime', { name: 'FechaCierre', nullable: true })
  fechaCierre: Date | null;

  @Column('bigint', { name: 'IdUsuarioCierre', nullable: true })
  idUsuarioCierre: number | null;

  // --- Etapa 2 (docs/ordenes-servicio.md §12): programación, código, autorización, motivos ---

  /** `crm` | `next`; NULL = la creó el técnico en la app (etapa 1). */
  @Column('varchar', { name: 'Origen', length: 5, nullable: true })
  origen: string | null;

  /** Referencia del CRM (p. ej. `OI-123`); con `unidad` hace idempotente la programación. */
  @Column('varchar', { name: 'ReferenciaCrm', length: 40, nullable: true })
  referenciaCrm: string | null;

  @Column('smallint', { name: 'Unidad', nullable: true })
  unidad: number | null;

  @Column('smallint', { name: 'UnidadesTotal', nullable: true })
  unidadesTotal: number | null;

  /** Orden no cumplida o cancelada que ésta reprograma. */
  @Column('bigint', { name: 'IdOrdenOrigen', nullable: true })
  idOrdenOrigen: number | null;

  /** Lo que se programó; `tipoServicio` es lo que se hizo. */
  @Column('varchar', { name: 'TipoProgramado', length: 20, nullable: true })
  tipoProgramado: string | null;

  @Column('bigint', { name: 'IdInstalacionProgramada', nullable: true })
  idInstalacionProgramada: number | null;

  @Column('datetime', { name: 'Cita', nullable: true })
  cita: Date | null;

  @Column('datetime', { name: 'CitaFin', nullable: true })
  citaFin: Date | null;

  @Column('bigint', { name: 'IdUsuarioProgramo', nullable: true })
  idUsuarioProgramo: number | null;

  /** Nombre de quien programó (usuario de Next o del CRM). */
  @Column('varchar', { name: 'NombreProgramo', length: 120, nullable: true })
  nombreProgramo: string | null;

  @Column('datetime', { name: 'FechaInicio', nullable: true })
  fechaInicio: Date | null;

  /** Código en claro mientras está vigente: el operador lo dicta. Nunca sale al técnico. */
  @Column('char', { name: 'Codigo', length: 6, nullable: true })
  codigo: string | null;

  @Column('datetime', { name: 'CodigoExpira', nullable: true })
  codigoExpira: Date | null;

  @Column('tinyint', { name: 'CodigoIntentos', default: () => "'0'" })
  codigoIntentos: number;

  @Column('bigint', { name: 'IdUsuarioCodigo', nullable: true })
  idUsuarioCodigo: number | null;

  @Column('datetime', { name: 'FechaCodigoVisto', nullable: true })
  fechaCodigoVisto: Date | null;

  @Column('datetime', { name: 'FechaCodigoValidado', nullable: true })
  fechaCodigoValidado: Date | null;

  /** `pendiente` | `autorizada` | `rechazada`; NULL = no se pidió. */
  @Column('varchar', { name: 'Autorizacion', length: 10, nullable: true })
  autorizacion: string | null;

  @Column('datetime', { name: 'FechaSolicitudAutorizacion', nullable: true })
  fechaSolicitudAutorizacion: Date | null;

  @Column('bigint', { name: 'IdUsuarioAutorizo', nullable: true })
  idUsuarioAutorizo: number | null;

  @Column('varchar', { name: 'NombreAutorizo', length: 120, nullable: true })
  nombreAutorizo: string | null;

  @Column('datetime', { name: 'FechaAutorizacion', nullable: true })
  fechaAutorizacion: Date | null;

  /** `next` | `crm`. */
  @Column('varchar', { name: 'OrigenAutorizacion', length: 5, nullable: true })
  origenAutorizacion: string | null;

  /** Instalación de Next que se dio de baja al cerrar un alta autorizada. */
  @Column('bigint', { name: 'IdInstalacionRetirada', nullable: true })
  idInstalacionRetirada: number | null;

  /** → CatMotivosOrdenServicio (no cumplida o cancelada). */
  @Column('varchar', { name: 'ClaveMotivo', length: 40, nullable: true })
  claveMotivo: string | null;

  @Column('tinyint', { name: 'Cobrable', nullable: true })
  cobrable: number | null;

  /** PDF de la orden en S3 privado (etapa 3). */
  @Column('varchar', { name: 'RutaPdf', length: 500, nullable: true })
  rutaPdf: string | null;

  @Column('datetime', { name: 'FechaPdf', nullable: true })
  fechaPdf: Date | null;
}
