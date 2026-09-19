import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Clientes } from './Clientes';
import { EventoAlarma } from './EventoAlarma';
import { Posiciones } from './Posiciones';
import { Usuarios } from './Usuarios';
import { SeguimientoIncidentes } from './SeguimientoIncidentes';

@applySchema
@Index('IX_Incidentes_IdCliente', ['idCliente'])
@Index('IX_Incidentes_IdPosicion', ['idPosicion'])
@Index('IX_Incidentes_IdUsuario', ['idUsuario'])
@Index('IX_Incidentes_Cliente_Estatus', ['idCliente', 'estatus'])
@Index('IX_Incidentes_IdEventoAlarma', ['idEventoAlarma'])
@Index('IX_Incidentes_TipoOrigen', ['tipoOrigen'])
@Entity('Incidentes')
export class Incidentes {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('tinyint', { name: 'TipoOrigen', default: () => "'1'" })
  tipoOrigen: number;

  @Column('int', { name: 'IdPosicion', nullable: true })
  idPosicion: number | null;

  @Column('int', { name: 'IdPosicionOrigen', nullable: true })
  idPosicionOrigen: number | null;

  @Column('bigint', { name: 'IdEventoAlarma', nullable: true })
  idEventoAlarma: number | null;

  @Column('bigint', { name: 'IdEventoAlarmaOrigen', nullable: true })
  idEventoAlarmaOrigen: number | null;

  @Column('json', { name: 'DatosOrigen' })
  datosOrigen: Record<string, unknown>;

  @Column('bigint', { name: 'IdUsuario', nullable: true })
  idUsuario: number | null;

  @Column('varchar', { name: 'Descripcion', length: 1000, nullable: true })
  descripcion: string | null;

  @Column('datetime', {
    name: 'FechaInicio',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaInicio: Date;

  @Column('datetime', { name: 'FechaCierre', nullable: true })
  fechaCierre: Date | null;

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

  @ManyToOne(() => Clientes, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @ManyToOne(() => Posiciones, {
    onDelete: 'SET NULL',
    onUpdate: 'NO ACTION',
    nullable: true,
  })
  @JoinColumn([{ name: 'IdPosicion', referencedColumnName: 'id' }])
  idPosicion2: Posiciones | null;

  @ManyToOne(() => EventoAlarma, {
    onDelete: 'SET NULL',
    onUpdate: 'NO ACTION',
    nullable: true,
  })
  @JoinColumn([{ name: 'IdEventoAlarma', referencedColumnName: 'id' }])
  idEventoAlarma2: EventoAlarma | null;

  @ManyToOne(() => Usuarios, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
    nullable: true,
  })
  @JoinColumn([{ name: 'IdUsuario', referencedColumnName: 'id' }])
  idUsuario2: Usuarios | null;

  @OneToMany(
    () => SeguimientoIncidentes,
    (seguimiento) => seguimiento.idIncidente2,
  )
  seguimientoIncidentes: SeguimientoIncidentes[];
}
