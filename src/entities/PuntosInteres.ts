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
@Index('IX_PuntosInteres_IdCliente', ['idCliente'])
@Entity('PuntosInteres')
export class PuntosInteres {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('varchar', { name: 'Nombre', length: 150 })
  nombre: string;

  @Column('varchar', {
    name: 'Descripcion',
    length: 500,
    nullable: true,
  })
  descripcion: string | null;

  @Column('double', { name: 'Lng' })
  lng: number;

  @Column('double', { name: 'Lat' })
  lat: number;

  @Column('varchar', {
    name: 'Icono',
    length: 500,
    nullable: true,
  })
  icono: string | null;

  @Column('smallint', {
    name: 'Estatus',
    default: () => "'1'",
  })
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

  @ManyToOne(() => Clientes, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;
}
