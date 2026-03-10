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
import { CatEstatusDispositivo } from './CatEstatusDispositivo';
import { Sims } from './Sims';

@applySchema
@Index('UQ_Dispositivos_NumeroSerie', ['numeroSerie'], { unique: true })
@Index('UQ_Dispositivos_IdSim', ['idSim'], { unique: true })
@Index('IX_Dispositivos_IdCliente_IdEstatusDispositivo', [
  'idCliente',
  'idEstatusDispositivo',
])
@Index('IX_Dispositivos_IdModeloDispositivo', ['idModeloDispositivo'])
@Index('IX_Dispositivos_IdTipoDispositivo', ['idTipoDispositivo'])
@Index('IX_Dispositivos_Estatus', ['estatus'])
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

  @Column('bigint', { name: 'IdEstatusDispositivo', default: 1 })
  idEstatusDispositivo: number;

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

  @ManyToOne(() => CatEstatusDispositivo, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdEstatusDispositivo', referencedColumnName: 'id' }])
  idEstatusDispositivo2: CatEstatusDispositivo;

  @ManyToOne(() => Sims, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdSim', referencedColumnName: 'id' }])
  idSim2: Sims;
}
