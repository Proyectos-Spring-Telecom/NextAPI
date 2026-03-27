import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Clientes } from './Clientes';
import { Instalaciones } from './Instalaciones';
import { Dispositivos } from './Dispositivos';
import { Vehiculos } from './Vehiculos';
import { CatEstatusInstalacion } from './CatEstatusInstalacion';

@applySchema
@Index('IX_HistInstalaciones_IdCliente_IdInstalacion', [
  'idCliente',
  'idInstalacion',
])
@Index('IX_HistInstalaciones_FechaRegistro', ['fechaRegistro'])
@Entity('HistoricoInstalaciones')
export class HistoricoInstalaciones {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('bigint', { name: 'IdInstalacion', nullable: true })
  idInstalacion: number | null;

  @Column('bigint', { name: 'IdDispositivo', nullable: true })
  idDispositivo: number | null;

  @Column('bigint', { name: 'IdVehiculo' })
  idVehiculo: number;

  @Column('bigint', { name: 'IdActivos', nullable: true })
  idActivos: number | null;

  @Column('bigint', { name: 'IdPortatiles', nullable: true })
  idPortatiles: number | null;

  @Column('bigint', { name: 'IdEstatusInstalacion' })
  idEstatusInstalacion: number;

  @Column('varchar', { name: 'Accion', length: 50 })
  accion: string;

  @Column('text', { name: 'Comentario', nullable: true })
  comentario: string | null;

  @CreateDateColumn({ name: 'FechaRegistro' })
  fechaRegistro: Date;

  @ManyToOne(() => Clientes, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @ManyToOne(() => Instalaciones, {
    nullable: true,
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdInstalacion', referencedColumnName: 'id' }])
  idInstalacion2: Instalaciones | null;

  @ManyToOne(() => Dispositivos, {
    nullable: true,
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdDispositivo', referencedColumnName: 'id' }])
  idDispositivo2: Dispositivos | null;

  @ManyToOne(() => Vehiculos, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdVehiculo', referencedColumnName: 'id' }])
  idVehiculo2: Vehiculos;

  @ManyToOne(() => CatEstatusInstalacion, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([
    { name: 'IdEstatusInstalacion', referencedColumnName: 'id' },
  ])
  idEstatusInstalacion2: CatEstatusInstalacion;
}
