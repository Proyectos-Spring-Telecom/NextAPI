import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Entity('CatCategoriaMantenimientoMecanico')
export class CatCategoriaMantenimientoMecanico {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 200 })
  nombre: string;

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;
}
