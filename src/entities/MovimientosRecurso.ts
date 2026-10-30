import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

/**
 * Historial de vida de dispositivos, SIM y productos. Solo lo escribe el motor
 * de activos, en la transacción del cambio (docs/motor-activos.md §4).
 */
@applySchema
@Index('IX_MovRec_Recurso', ['tipoRecurso', 'idRecurso', 'fecha'])
@Index('IX_MovRec_Instalacion', ['idInstalacion'])
@Index('IX_MovRec_Orden', ['idOrdenServicio'])
@Entity('MovimientosRecurso')
export class MovimientosRecurso {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'TipoRecurso', length: 12 })
  tipoRecurso: string;

  @Column('bigint', { name: 'IdRecurso' })
  idRecurso: number;

  @Column('datetime', { name: 'Fecha' })
  fecha: Date;

  @Column('varchar', { name: 'Accion', length: 20 })
  accion: string;

  @Column('tinyint', { name: 'EstatusAnterior', nullable: true })
  estatusAnterior: number | null;

  @Column('tinyint', { name: 'EstatusNuevo' })
  estatusNuevo: number;

  @Column('bigint', { name: 'IdClienteAnterior', nullable: true })
  idClienteAnterior: number | null;

  @Column('bigint', { name: 'IdClienteNuevo', nullable: true })
  idClienteNuevo: number | null;

  @Column('bigint', { name: 'IdInstalacion', nullable: true })
  idInstalacion: number | null;

  @Column('bigint', { name: 'IdOrdenServicio', nullable: true })
  idOrdenServicio: number | null;

  @Column('varchar', { name: 'Motivo', length: 500, nullable: true })
  motivo: string | null;

  @Column('bigint', { name: 'IdUsuario', nullable: true })
  idUsuario: number | null;

  @Column('varchar', { name: 'Origen', length: 10 })
  origen: string;
}
