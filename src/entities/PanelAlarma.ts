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
import { Inmuebles } from './Inmuebles';

@applySchema
@Index('UQ_PanelAlarma_CuentaSia', ['cuentaSia'], { unique: true })
@Index('FK_PanelAlarma_Clientes', ['idCliente'])
@Index('FK_PanelAlarma_Inmuebles', ['idInmueble'])
@Index('IX_PanelAlarma_IdCliente_Estatus', ['idCliente', 'estatus'])
@Entity('PanelAlarma')
export class PanelAlarma {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'CuentaSia', length: 20 })
  cuentaSia: string;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('bigint', { name: 'IdInmueble' })
  idInmueble: number;

  @Column('varchar', { name: 'Ip', nullable: true, length: 45 })
  ip: string | null;

  @Column('tinyint', { name: 'CifradoActivo', default: 0 })
  cifradoActivo: number;

  // TODO: cifrar en reposo
  @Column('varchar', { name: 'AesKey', nullable: true, length: 255 })
  aesKey: string | null;

  @Column('smallint', { name: 'AesBits', default: 128 })
  aesBits: number;

  @Column('datetime', { name: 'UltimoHeartbeat', nullable: true })
  ultimoHeartbeat: Date | null;

  @CreateDateColumn({ name: 'FechaCreacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'FechaActualizacion' })
  fechaActualizacion: Date;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;

  @ManyToOne(() => Clientes, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @ManyToOne(() => Inmuebles, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdInmueble', referencedColumnName: 'id' }])
  idInmueble2: Inmuebles;
}
