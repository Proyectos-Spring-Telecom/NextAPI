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
import { CatTelefonia } from './CatTelefonia';
import { CatPlanesTelefonia } from './CatPlanesTelefonia';

@applySchema
@Index('UQ_Sims_Cliente_Id', ['idCliente', 'id'], { unique: true })
@Index('IX_Sims_IdCliente_IdEstatusSim', ['idCliente', 'estatusSim'])
@Index('IX_Sims_IdTelefonia', ['idTelefonia'])
@Index('IX_Sims_IdPlanTelefonia', ['idPlanTelefonia'])
@Index('IX_Sims_IMEI', ['imei'])
@Entity('Sims')
export class Sims {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', {
    name: 'IMEI',
    length: 15,
    nullable: true,
    comment: 'Identificador del suscriptor en la red móvil',
  })
  imei: string | null;

  @Column('varchar', {
    name: 'NumeroTelefono',
    length: 20,
    nullable: true,
    comment: 'Número de línea / MSISDN del SIM',
  })
  numeroTelefono: string | null;

  @Column('bigint', {
    name: 'IdTelefonia',
    comment: 'Compañía telefónica del SIM',
  })
  idTelefonia: number;

  @Column('bigint', {
    name: 'IdPlanTelefonia',
    comment: 'Plan de datos contratado',
  })
  idPlanTelefonia: number;

  @Column('bigint', {
    name: 'IdCliente',
    comment: 'Cliente/tenant propietario del SIM',
  })
  idCliente: number;

  @Column('tinyint', {
    name: 'EstatusSim',
    default: () => "'1'",
    comment: 'Estatus actual del SIM',
  })
  estatusSim: number;

  @Column('date', {
    name: 'FechaActivacion',
    nullable: true,
    comment: 'Fecha en que se activó el SIM',
  })
  fechaActivacion: Date | null;

  @Column('date', {
    name: 'FechaVencimiento',
    nullable: true,
    comment: 'Fecha de vencimiento del servicio o plan',
  })
  fechaVencimiento: Date | null;

  @Column('varchar', { name: 'Notas', length: 500, nullable: true })
  notas: string | null;

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

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;

  @ManyToOne(() => Clientes, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @ManyToOne(() => CatTelefonia, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdTelefonia', referencedColumnName: 'id' }])
  idTelefonia2: CatTelefonia;

  @ManyToOne(() => CatPlanesTelefonia, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdPlanTelefonia', referencedColumnName: 'id' }])
  idPlanTelefonia2: CatPlanesTelefonia;
}
