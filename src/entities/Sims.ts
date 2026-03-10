import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Clientes } from './Clientes';
import { CatTelefonia } from './CatTelefonia';
import { CatPlanesTelefonia } from './CatPlanesTelefonia';
import { CatEstatusSim } from './CatEstatusSim';

@applySchema
@Index('UQ_Sims_ICC', ['icc'], { unique: true })
@Index('IX_Sims_IdCliente_IdEstatusSim', ['idCliente', 'idEstatusSim'])
@Index('IX_Sims_IdTelefonia', ['idTelefonia'])
@Index('IX_Sims_IdPlanTelefonia', ['idPlanTelefonia'])
@Index('IX_Sims_IMEI', ['imei'])
@Index('IX_Sims_IPEstatica', ['ipEstatica'])
@Index('IX_Sims_Estatus', ['estatus'])
@Entity('Sims')
export class Sims {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'ICC', length: 22 })
  icc: string;

  @Column('varchar', { name: 'IMEI', length: 15, nullable: true })
  imei: string | null;

  @Column('varchar', { name: 'NumeroTelefono', length: 20, nullable: true })
  numeroTelefono: string | null;

  @Column('varchar', { name: 'IPEstatica', length: 45, nullable: true })
  ipEstatica: string | null;

  @Column('bigint', { name: 'IdTelefonia' })
  idTelefonia: number;

  @Column('bigint', { name: 'IdPlanTelefonia' })
  idPlanTelefonia: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('bigint', { name: 'IdEstatusSim', default: 1 })
  idEstatusSim: number;

  @Column('date', { name: 'FechaActivacion', nullable: true })
  fechaActivacion: Date | null;

  @Column('date', { name: 'FechaVencimiento', nullable: true })
  fechaVencimiento: Date | null;

  @Column('varchar', { name: 'Notas', length: 500, nullable: true })
  notas: string | null;

  @CreateDateColumn({ name: 'FechaCreacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'FechaActualizacion' })
  fechaActualizacion: Date;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;

  @ManyToOne(() => Clientes, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @ManyToOne(() => CatTelefonia, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdTelefonia', referencedColumnName: 'id' }])
  idTelefonia2: CatTelefonia;

  @ManyToOne(() => CatPlanesTelefonia, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdPlanTelefonia', referencedColumnName: 'id' }])
  idPlanTelefonia2: CatPlanesTelefonia;

  @ManyToOne(() => CatEstatusSim, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdEstatusSim', referencedColumnName: 'id' }])
  idEstatusSim2: CatEstatusSim;
}
