import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('IX_CatEstatusOperador_Estatus', ['estatus'])
@Entity('CatEstatusOperador')
export class CatEstatusOperador {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 50 })
  nombre: string;

  @Column('varchar', { name: 'Descripcion', length: 255, nullable: true })
  descripcion: string | null;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;
}
