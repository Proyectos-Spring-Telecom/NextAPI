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
import { Usuarios } from './Usuarios';

@applySchema
@Index('UQ_HistInst_Cliente_Id', ['idCliente', 'id'], { unique: true })
@Index('IX_HistInst_Cliente_Original', ['idCliente', 'idInstalacionOriginal'])
@Index('IX_HistInst_Cliente_Dispositivo', ['idCliente', 'idDispositivo'])
@Index('IX_HistInst_FHArchivado', ['fhArchivado'])
@Index('FK_HistInst_Eslabon_idx', ['idHistoricoInstalacion'])
@Index('FK_HistInst_Producto_idx', ['idCliente', 'idProducto'])
@Index('FK_HistInst_Sim_idx', ['idCliente', 'idSim'])
@Index('FK_HistInst_Estatus', ['estatusInstalacion'])
@Index('IX_HistInst_VigenteDesde', ['vigenteDesde'])
@Index('FK_HistInst_Usuario_idx', ['idUsuario'])
@Entity('HistoricoInstalaciones')
export class HistoricoInstalaciones {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('bigint', { name: 'IdProducto' })
  idProducto: number;

  @Column('bigint', { name: 'IdDispositivo', nullable: true })
  idDispositivo: number | null;

  @Column('bigint', { name: 'IdSim', nullable: true })
  idSim: number | null;

  @Column('bigint', { name: 'EstatusInstalacion' })
  estatusInstalacion: number;

  @Column('bigint', {
    name: 'IdInstalacionOriginal',
    nullable: true,
    comment: 'Id que tenía la instalación dada de baja (trazabilidad)',
  })
  idInstalacionOriginal: number | null;

  @Column('datetime', {
    name: 'VigenteDesde',
    nullable: true,
    comment: 'Inicio de vigencia de esta versión archivada',
  })
  vigenteDesde: Date | null;

  @Column('datetime', {
    name: 'VigenteHasta',
    nullable: true,
    comment: 'Fin de vigencia (instante en que se archivó esta versión)',
  })
  vigenteHasta: Date | null;

  @Column('bigint', {
    name: 'IdHistoricoInstalacion',
    nullable: true,
    comment: 'Eslabón anterior de la cadena (auto-FK). NULL = origen',
  })
  idHistoricoInstalacion: number | null;

  @Column('bigint', {
    name: 'IdUsuario',
    nullable: true,
    comment: 'Usuario que realizó esta acción (NULL = sistema)',
  })
  idUsuario: number | null;

  @Column('varchar', {
    name: 'Accion',
    length: 50,
    comment:
      'Ej: Alta, Cambio de dispositivo, Cambio de producto, Baja, Suspensión',
  })
  accion: string;

  @Column('text', {
    name: 'Comentario',
    nullable: true,
    comment: 'Motivo del cambio / observaciones del técnico',
  })
  comentario: string | null;

  @Column('datetime', {
    name: 'FHArchivado',
    default: () => 'CURRENT_TIMESTAMP',
    comment: 'Momento en que esta versión se archivó',
  })
  fhArchivado: Date;

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

  @ManyToOne(() => HistoricoInstalaciones, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
    nullable: true,
  })
  @JoinColumn([
    { name: 'IdHistoricoInstalacion', referencedColumnName: 'id' },
  ])
  idHistoricoInstalacion2: HistoricoInstalaciones | null;

  @ManyToOne(() => Usuarios, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
    nullable: true,
  })
  @JoinColumn([{ name: 'IdUsuario', referencedColumnName: 'id' }])
  idUsuario2: Usuarios | null;
}
