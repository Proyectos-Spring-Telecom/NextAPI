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
import { CatTipoProducto } from './CatTipoProducto';

@applySchema
@Index('UQ_Productos_Cliente_Id', ['idCliente', 'id'], { unique: true })
@Index('IX_Productos_Cliente_Tipo', [
  'idCliente',
  'idTipoProducto',
  'estatus',
])
@Index('FK_Productos_Tipo', ['idTipoProducto'])
@Entity('Productos')
export class Productos {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('bigint', { name: 'IdTipoProducto' })
  idTipoProducto: number;

  @Column('varchar', {
    name: 'Nombre',
    length: 400,
    nullable: true,
    comment: 'Etiqueta legible del producto',
  })
  nombre: string | null;

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

  @ManyToOne(() => CatTipoProducto, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdTipoProducto', referencedColumnName: 'id' }])
  idTipoProducto2: CatTipoProducto;
}
