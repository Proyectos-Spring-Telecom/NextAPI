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
@Entity('OrdenesServicio')
export class OrdenesServicio {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Folio', length: 20, nullable: true })
  folio: string | null;

  @Column('char', { name: 'ClaveApp', length: 36 })
  claveApp: string;

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
}
