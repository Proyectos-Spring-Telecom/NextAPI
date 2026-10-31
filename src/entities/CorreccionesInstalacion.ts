import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

/**
 * Correcciones a una instalación que no abren versión nueva (fecha real de
 * instalación). Evidencia: quién, cuándo, valor anterior y motivo
 * (docs/motor-activos.md §3).
 */
@applySchema
@Index('IX_CorrInst_Instalacion', ['idInstalacion', 'fecha'])
@Entity('CorreccionesInstalacion')
export class CorreccionesInstalacion {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdInstalacion' })
  idInstalacion: number;

  @Column('datetime', { name: 'Fecha' })
  fecha: Date;

  @Column('varchar', { name: 'Campo', length: 30 })
  campo: string;

  @Column('varchar', { name: 'ValorAnterior', nullable: true, length: 100 })
  valorAnterior: string | null;

  @Column('varchar', { name: 'ValorNuevo', nullable: true, length: 100 })
  valorNuevo: string | null;

  @Column('varchar', { name: 'Motivo', length: 500 })
  motivo: string;

  @Column('bigint', { name: 'IdUsuario', nullable: true })
  idUsuario: number | null;

  @Column('varchar', { name: 'Origen', length: 10 })
  origen: string;
}
