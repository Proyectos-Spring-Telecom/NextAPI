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
import { Dispositivos } from './Dispositivos';
import { Vehiculos } from './Vehiculos';

@applySchema
@Index('UQ_Instalaciones_IdCliente_IdVehiculo', ['idCliente', 'idVehiculo'], {
  unique: true,
})
@Index('UQ_Instalaciones_IdCliente_Id', ['idCliente', 'id'], { unique: true })
@Index('UQ_Instalaciones_IdCliente_IdDispositivo', [
  'idCliente',
  'idDispositivo',
], { unique: true })
@Index('IX_Instalaciones_IdCliente_IdEstatusInstalacion', [
  'idCliente',
  'estatusInstalacion',
])
@Entity('Instalaciones')
export class Instalaciones {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('bigint', { name: 'IdDispositivo', nullable: true })
  idDispositivo: number | null;

  @Column('bigint', { name: 'IdVehiculo' })
  idVehiculo: number;

  @Column('bigint', { name: 'IdActivos', nullable: true })
  idActivos: number | null;

  @Column('bigint', { name: 'IdPortatiles', nullable: true })
  idPortatiles: number | null;

  @Column('bigint', { name: 'EstatusInstalacion', default: 1 })
  estatusInstalacion: number;

  @CreateDateColumn({ name: 'FechaCreacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'FechaActualizacion' })
  fechaActualizacion: Date;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;

  @ManyToOne(() => Clientes, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @ManyToOne(() => Dispositivos, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn([
    { name: 'IdCliente', referencedColumnName: 'idCliente' },
    { name: 'IdDispositivo', referencedColumnName: 'id' },
  ])
  idDispositivo2: Dispositivos | null;

  @ManyToOne(() => Vehiculos, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([
    { name: 'IdCliente', referencedColumnName: 'idCliente' },
    { name: 'IdVehiculo', referencedColumnName: 'id' },
  ])
  idVehiculo2: Vehiculos;
}
