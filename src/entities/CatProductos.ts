import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Entity('CatProductos')
export class CatProductos {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('datetime', {
    name: 'FechaCreacion',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaCreacion: Date | null;

  @Column('datetime', {
    name: 'FechaActualizacion',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  fechaActualizacion: Date | null;
}
