import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('IX_CatTipoVehiculo_Estatus', ['estatus'])
@Entity('CatTipoVehiculo')
export class CatTipoVehiculo {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;
}
