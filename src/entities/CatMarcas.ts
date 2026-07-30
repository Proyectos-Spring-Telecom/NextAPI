import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { CatProductos } from './CatProductos';

@applySchema
@Index('UQ_CatMarcas_Nombre', ['nombre'], { unique: true })
@Index('FK_CatMarcas_CatProductos', ['idProducto'])
@Entity('CatMarcas')
export class CatMarcas {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;

  @Column('bigint', { name: 'IdProducto' })
  idProducto: number;

  @ManyToOne(() => CatProductos, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdProducto', referencedColumnName: 'id' }])
  idProducto2: CatProductos;
}
