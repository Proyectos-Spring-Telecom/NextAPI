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
import { CatMarcas } from './CatMarcas';
import { CatModelos } from './CatModelos';
import { Sims } from './Sims';

@applySchema
@Index('UQ_Dispositivos_IdCliente_Id', ['idCliente', 'id'], { unique: true })
@Index('UQ_Dispositivos_NumeroSerie', ['numeroSerie'], { unique: true })
@Index('UQ_Dispositivos_IdSim', ['idSim'], { unique: true })
@Index('IX_Dispositivos_IdCliente_IdEstatusDispositivo', [
  'idCliente',
  'estatusDispositivo',
])
@Index('FK_Dispositivos_ModeloDispositivo_idx', ['idModeloDispositivo'])
@Index('FK_Dispositivos_MarcaDispositivo_idx', ['idMarcaDispositivo'])
@Entity('Dispositivos')
export class Dispositivos {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'NumeroSerie', length: 100 })
  numeroSerie: string;

  @Column('bigint', { name: 'IdMarcaDispositivo', nullable: true })
  idMarcaDispositivo: number | null;

  @Column('bigint', { name: 'IdModeloDispositivo', nullable: true })
  idModeloDispositivo: number | null;

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

  @ManyToOne(() => CatMarcas, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdMarcaDispositivo', referencedColumnName: 'id' }])
  idMarcaDispositivo2: CatMarcas | null;

  @ManyToOne(() => CatModelos, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdModeloDispositivo', referencedColumnName: 'id' }])
  idModeloDispositivo2: CatModelos | null;

  @ManyToOne(() => Sims, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdSim', referencedColumnName: 'id' }])
  idSim2: Sims;
}
