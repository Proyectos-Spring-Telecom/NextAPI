import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Productos } from './Productos';
import { PuntosInteres } from './PuntosInteres';

/** Vehículos que avisan llegada/salida de cada punto de interés (muchos a muchos). */
@applySchema
@Index('UQ_ProductoPuntoInteres', ['idProducto', 'idPuntoInteres'], { unique: true })
@Index('IX_ProductoPuntoInteres_Punto', ['idPuntoInteres', 'estatus'])
@Entity('ProductosPuntoInteres')
export class ProductosPuntoInteres {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdProducto' })
  idProducto: number;

  @Column('bigint', { name: 'IdPuntoInteres' })
  idPuntoInteres: number;

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;

  @Column('datetime', { name: 'FechaCreacion', default: () => 'CURRENT_TIMESTAMP' })
  fechaCreacion: Date;

  @Column('datetime', { name: 'FechaActualizacion', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  fechaActualizacion: Date;

  @ManyToOne(() => Productos, { onDelete: 'CASCADE', onUpdate: 'NO ACTION' })
  @JoinColumn([{ name: 'IdProducto', referencedColumnName: 'id' }])
  idProducto2: Productos;

  @ManyToOne(() => PuntosInteres, (p) => p.productosPuntoInteres, { onDelete: 'CASCADE', onUpdate: 'NO ACTION' })
  @JoinColumn([{ name: 'IdPuntoInteres', referencedColumnName: 'id' }])
  idPuntoInteres2: PuntosInteres;
}
