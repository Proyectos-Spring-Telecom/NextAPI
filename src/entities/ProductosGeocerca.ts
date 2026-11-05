import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Geocercas } from './Geocercas';
import { Productos } from './Productos';

/** Vehículos que evalúan cada geocerca (una geocerca, varios vehículos; un vehículo, varias geocercas). */
@applySchema
@Index('UQ_ProductoGeocerca', ['idProducto', 'idGeocerca'], { unique: true })
@Index('IX_ProductoGeocerca_Geocerca', ['idGeocerca', 'estatus'])
@Entity('ProductosGeocerca')
export class ProductosGeocerca {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdProducto' })
  idProducto: number;

  @Column('bigint', { name: 'IdGeocerca' })
  idGeocerca: number;

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;

  @Column('datetime', { name: 'FechaCreacion', default: () => 'CURRENT_TIMESTAMP' })
  fechaCreacion: Date;

  @Column('datetime', { name: 'FechaActualizacion', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  fechaActualizacion: Date;

  @ManyToOne(() => Productos, { onDelete: 'CASCADE', onUpdate: 'NO ACTION' })
  @JoinColumn([{ name: 'IdProducto', referencedColumnName: 'id' }])
  idProducto2: Productos;

  @ManyToOne(() => Geocercas, (g) => g.productosGeocerca, { onDelete: 'CASCADE', onUpdate: 'NO ACTION' })
  @JoinColumn([{ name: 'IdGeocerca', referencedColumnName: 'id' }])
  idGeocerca2: Geocercas;
}
