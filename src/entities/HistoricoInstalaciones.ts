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

@applySchema
@Index('IX_HistInstalaciones_IdCliente_IdInstalacion', [
  'idCliente',
  'idInstalacion',
])
@Index('IX_HistInstalaciones_IdCliente_IdDispositivo', [
  'idCliente',
  'idDispositivo',
])
@Index('IX_HistInstalaciones_IdCliente_IdVehiculo', [
  'idCliente',
  'idVehiculo',
])
@Index('IX_HistInstalaciones_FechaRegistro', ['fechaRegistro'])
@Index('FK_HistInstalaciones_Vehiculos', ['idVehiculo'])
@Index('FK_HistInstalaciones_Dispositivos', ['idDispositivo'])
@Index('FK_HistInstalaciones_Instalaciones', ['idInstalacion'])
@Entity('HistoricoInstalaciones')
export class HistoricoInstalaciones {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', {
    name: 'IdCliente',
    comment: 'FK → Clientes.Id (multitenancy)',
  })
  idCliente: number;

  @Column('bigint', {
    name: 'IdInstalacion',
    nullable: true,
    comment: 'FK → Instalaciones.Id',
  })
  idInstalacion: number | null;

  @Column('bigint', {
    name: 'IdDispositivo',
    nullable: true,
    comment: 'Dispositivo GPS que estaba instalado',
  })
  idDispositivo: number | null;

  @Column('bigint', {
    name: 'IdVehiculo',
    comment: 'Vehículo donde estaba instalado',
  })
  idVehiculo: number;

  @Column('bigint', {
    name: 'IdActivos',
    nullable: true,
    comment: 'Activo que estaba asociado',
  })
  idActivos: number | null;

  @Column('bigint', {
    name: 'IdPortatiles',
    nullable: true,
    comment: 'Portátil que estaba asociado',
  })
  idPortatiles: number | null;

  @Column('bigint', {
    name: 'EstatusInstalacion',
    comment: 'Estatus que tenía la instalación',
  })
  estatusInstalacion: number;

  @Column('varchar', {
    name: 'Accion',
    length: 50,
    comment:
      'Ej: Instalación, Desinstalación, Cambio de Dispositivo, Cambio de Vehículo, Suspensión',
  })
  accion: string;

  @Column('text', {
    name: 'Comentario',
    nullable: true,
    comment: 'Observaciones del técnico o motivo del cambio',
  })
  comentario: string | null;

  @Column('datetime', {
    name: 'FechaRegistro',
    default: () => 'CURRENT_TIMESTAMP',
    comment: 'Fecha en que se registró el movimiento',
  })
  fechaRegistro: Date;

  @ManyToOne(() => Clientes, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;
}
