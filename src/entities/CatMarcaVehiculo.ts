import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('UQ_CatMarcaVehiculo_Nombre', ['nombre'], { unique: true })
@Index('IX_CatMarcaVehiculo_Estatus', ['estatus'])
@Entity('CatMarcaVehiculo')
export class CatMarcaVehiculo {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;
}
