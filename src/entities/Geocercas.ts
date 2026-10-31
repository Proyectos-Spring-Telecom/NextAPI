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
import { Productos } from './Productos';
import { UsuariosGeocerca } from './UsuariosGeocerca';

@applySchema
@Index('IX_Geocercas_IdCliente', ['idCliente'])
@Index('IX_Geocercas_Cliente_Estatus', ['idCliente', 'estatus'])
@Index('IX_Geocercas_Cliente_Producto', ['idCliente', 'idProducto'])
@Entity('Geocercas')
export class Geocercas {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  /** Vehículo (producto) al que aplica, no la versión de la instalación (fase C). NULL = no se evalúa. */
  @Column('bigint', { name: 'IdProducto', nullable: true })
  idProducto: number | null;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('varchar', {
    name: 'Descripcion',
    length: 500,
    nullable: true,
  })
  descripcion: string | null;

  /** GeoJSON / polígono de la geocerca */
  @Column('json', { name: 'Geocerca' })
  geocerca: Record<string, unknown> | unknown[];

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
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @ManyToOne(() => Productos, {
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
    nullable: true,
  })
  @JoinColumn([
    { name: 'IdCliente', referencedColumnName: 'idCliente' },
    { name: 'IdProducto', referencedColumnName: 'id' },
  ])
  idProducto2: Productos | null;

  @OneToMany(() => UsuariosGeocerca, (ug) => ug.idGeocerca2)
  usuariosGeocerca: UsuariosGeocerca[];
}
