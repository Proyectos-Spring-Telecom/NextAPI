import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Productos } from './Productos';

@applySchema
@Index('FK_Personas_Producto', ['idCliente', 'idProducto'])
@Entity('Personas')
export class Personas {
  @PrimaryColumn('bigint', { name: 'IdProducto' })
  idProducto: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('varchar', { name: 'Nombre', length: 250, nullable: true })
  nombre: string | null;

  @Column('varchar', { name: 'Telefono', length: 20, nullable: true })
  telefono: string | null;

  @OneToOne(() => Productos, {
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([
    { name: 'IdCliente', referencedColumnName: 'idCliente' },
    { name: 'IdProducto', referencedColumnName: 'id' },
  ])
  idProducto2: Productos;
}
