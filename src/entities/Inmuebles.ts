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
@Index('FK_Inmuebles_Producto', ['idCliente', 'idProducto'])
@Entity('Inmuebles')
export class Inmuebles {
  @PrimaryColumn('bigint', { name: 'IdProducto' })
  idProducto: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('varchar', { name: 'Inmueble', nullable: true, length: 400 })
  inmueble: string | null;

  @Column('text', { name: 'DireccionFiscal', nullable: true })
  direccionFiscal: string | null;

  @Column('varchar', {
    name: 'NombreRepresentante',
    nullable: true,
    length: 250,
  })
  nombreRepresentante: string | null;

  @Column('varchar', {
    name: 'TelefonoRepresentante',
    nullable: true,
    length: 10,
  })
  telefonoRepresentante: string | null;

  @Column('varchar', {
    name: 'CorreoRepresentante',
    nullable: true,
    length: 100,
  })
  correoRepresentante: string | null;

  @Column('double', { name: 'Lat', nullable: true })
  lat: number | null;

  @Column('double', { name: 'Lng', nullable: true })
  lng: number | null;

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
