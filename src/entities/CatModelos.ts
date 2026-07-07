import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { CatMarcas } from './CatMarcas';

@applySchema
@Index('FK_CatModelos_CatMarcas', ['idCatMarcas'])
@Entity('CatModelos')
export class CatModelos {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('varchar', { name: 'Descripcion', length: 255, nullable: true })
  descripcion: string | null;

  @Column('bigint', { name: 'IdCatMarcas' })
  idCatMarcas: number;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;

  @ManyToOne(() => CatMarcas, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdCatMarcas', referencedColumnName: 'id' }])
  idCatMarcas2: CatMarcas;
}
