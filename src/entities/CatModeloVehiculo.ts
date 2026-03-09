import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { CatMarcaVehiculo } from './CatMarcaVehiculo';

@applySchema
@Index('UQ_CatModeloVehiculo_Marca_Nombre', ['idMarcaVehiculo', 'nombre'], {
  unique: true,
})
@Index('FK_CatModeloVehiculo_Marca', ['idMarcaVehiculo'])
@Index('IX_CatModeloVehiculo_Estatus', ['estatus'])
@Entity('CatModeloVehiculo')
export class CatModeloVehiculo {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('bigint', { name: 'IdMarcaVehiculo' })
  idMarcaVehiculo: number;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;

  @ManyToOne(() => CatMarcaVehiculo, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdMarcaVehiculo', referencedColumnName: 'id' }])
  idMarcaVehiculo2: CatMarcaVehiculo;
}
