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
@Index('FK_Activos_Producto', ['idCliente', 'idProducto'])
@Entity('Activos')
export class Activos {
  @PrimaryColumn('bigint', { name: 'IdProducto' })
  idProducto: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('varchar', { name: 'Nombre', length: 250, nullable: true })
  nombre: string | null;

  @Column('varchar', { name: 'Descripcion', length: 500, nullable: true })
  descripcion: string | null;

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
