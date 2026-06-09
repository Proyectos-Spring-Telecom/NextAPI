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
import { CatModeloDispositivo } from './CatModeloDispositivo';
import { CatTipoDispositivo } from './CatTipoDispositivo';
import { Sims } from './Sims';

@applySchema
@Index('UQ_Dispositivos_IdCliente_Id', ['idCliente', 'id'], { unique: true })
@Index('UQ_Dispositivos_NumeroSerie', ['numeroSerie'], { unique: true })
@Index('UQ_Dispositivos_IdSim', ['idSim'], { unique: true })
@Index('IX_Dispositivos_IdCliente_IdEstatusDispositivo', [
  'idCliente',
  'estatusDispositivo',
])
@Index('FK_Dispositivos_ModeloDispositivo', ['idModeloDispositivo'])
@Index('FK_Dispositivos_TipoDispositivo', ['idTipoDispositivo'])
@Entity('Dispositivos')
export class Dispositivos {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'NumeroSerie', length: 100 })
  numeroSerie: string;

  @Column('bigint', { name: 'IdModeloDispositivo' })
  idModeloDispositivo: number;

  @Column('bigint', { name: 'IdTipoDispositivo' })
  idTipoDispositivo: number;

  @Column('bigint', { name: 'EstatusDispositivo', default: 1 })
  estatusDispositivo: number;

  @Column('bigint', { name: 'IdSim' })
  idSim: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @CreateDateColumn({ name: 'FechaCreacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'FechaActualizacion' })
  fechaActualizacion: Date;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;

  @ManyToOne(() => Clientes, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @ManyToOne(() => CatModeloDispositivo, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdModeloDispositivo', referencedColumnName: 'id' }])
  idModeloDispositivo2: CatModeloDispositivo;

  @ManyToOne(() => CatTipoDispositivo, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdTipoDispositivo', referencedColumnName: 'id' }])
  idTipoDispositivo2: CatTipoDispositivo;

  @ManyToOne(() => Sims, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdSim', referencedColumnName: 'id' }])
  idSim2: Sims;
}
