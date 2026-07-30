import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Clientes } from './Clientes';
import { Dispositivos } from './Dispositivos';
import { Sims } from './Sims';
import { CatEstatusInstalacion } from './CatEstatusInstalacion';
import { Productos } from './Productos';

@applySchema
@Index('UQ_Instalaciones_Cliente_Id', ['idCliente', 'id'], { unique: true })
@Index('UQ_Inst_DispositivoActivo', ['idCliente', 'dispositivoActivo'], {
  unique: true,
})
@Index('UQ_Inst_SimActivo', ['idCliente', 'simActivo'], { unique: true })
@Index('IX_Instalaciones_Cliente_Estatus', [
  'idCliente',
  'estatusInstalacion',
])
@Index('FK_Inst_Producto_idx', ['idCliente', 'idProducto'])
@Index('FK_Inst_Dispositivo_idx', ['idCliente', 'idDispositivo'])
@Index('FK_Inst_Sim_idx', ['idCliente', 'idSim'])
@Index('FK_Inst_Estatus', ['estatusInstalacion'])
@Entity('Instalaciones')
export class Instalaciones {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('bigint', {
    name: 'IdProducto',
    comment: 'OBLIGATORIO',
  })
  idProducto: number;

  @Column('bigint', {
    name: 'IdDispositivo',
    nullable: true,
    comment: 'OPCIONAL',
  })
  idDispositivo: number | null;

  @Column('bigint', {
    name: 'IdSim',
    nullable: true,
    comment: 'OPCIONAL',
  })
  idSim: number | null;

  @Column('bigint', {
    name: 'EstatusInstalacion',
    default: () => "'1'",
  })
  estatusInstalacion: number;

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;

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

  @Column({
    type: 'bigint',
    name: 'DispositivoActivo',
    nullable: true,
    asExpression: 'if((`Estatus` = 1),`IdDispositivo`,NULL)',
    generatedType: 'STORED',
  })
  dispositivoActivo: number | null;

  @Column({
    type: 'bigint',
    name: 'SimActivo',
    nullable: true,
    asExpression: 'if((`Estatus` = 1),`IdSim`,NULL)',
    generatedType: 'STORED',
  })
  simActivo: number | null;

  @ManyToOne(() => Clientes, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @ManyToOne(() => Dispositivos, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
    nullable: true,
  })
  @JoinColumn([
    { name: 'IdCliente', referencedColumnName: 'idCliente' },
    { name: 'IdDispositivo', referencedColumnName: 'id' },
  ])
  idDispositivo2: Dispositivos | null;

  @ManyToOne(() => Productos, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([
    { name: 'IdCliente', referencedColumnName: 'idCliente' },
    { name: 'IdProducto', referencedColumnName: 'id' },
  ])
  idProducto2: Productos;

  @ManyToOne(() => Sims, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
    nullable: true,
  })
  @JoinColumn([
    { name: 'IdCliente', referencedColumnName: 'idCliente' },
    { name: 'IdSim', referencedColumnName: 'id' },
  ])
  idSim2: Sims | null;

  @ManyToOne(() => CatEstatusInstalacion, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([
    { name: 'EstatusInstalacion', referencedColumnName: 'id' },
  ])
  estatusInstalacion2: CatEstatusInstalacion;
}
