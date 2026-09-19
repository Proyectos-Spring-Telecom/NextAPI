import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Incidentes } from './Incidentes';
import { Usuarios } from './Usuarios';

@applySchema
@Index('IX_SeguimientoIncidentes_IdIncidente', ['idIncidente'])
@Index('IX_SeguimientoIncidentes_IdUsuario', ['idUsuario'])
@Index('IX_SeguimientoIncidentes_Incidente_FechaHora', [
  'idIncidente',
  'fechaHora',
])
@Entity('SeguimientoIncidentes')
export class SeguimientoIncidentes {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdIncidente' })
  idIncidente: number;

  @Column('bigint', { name: 'IdUsuario', nullable: true })
  idUsuario: number | null;

  @Column('datetime', {
    name: 'FechaHora',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaHora: Date;

  @Column('varchar', { name: 'Actividad', length: 1000 })
  actividad: string;

  @Column('varchar', { name: 'Medio', length: 100, nullable: true })
  medio: string | null;

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

  @ManyToOne(() => Incidentes, (incidente) => incidente.seguimientoIncidentes, {
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdIncidente', referencedColumnName: 'id' }])
  idIncidente2: Incidentes;

  @ManyToOne(() => Usuarios, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
    nullable: true,
  })
  @JoinColumn([{ name: 'IdUsuario', referencedColumnName: 'id' }])
  idUsuario2: Usuarios | null;
}
