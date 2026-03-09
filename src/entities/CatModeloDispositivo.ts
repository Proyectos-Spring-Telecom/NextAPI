import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { CatMarcaDispositivo } from './CatMarcaDispositivo';

@applySchema
@Index('UQ_CatModeloDispositivo_Marca_Nombre', ['idMarcaDispositivo', 'nombre'], {
  unique: true,
})
@Index('FK_CatModeloDispositivo_Marca', ['idMarcaDispositivo'])
@Index('IX_CatModeloDispositivo_Estatus', ['estatus'])
@Entity('CatModeloDispositivo')
export class CatModeloDispositivo {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('varchar', { name: 'Descripcion', length: 255, nullable: true })
  descripcion: string | null;

  @Column('bigint', { name: 'IdMarcaDispositivo' })
  idMarcaDispositivo: number;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;

  @ManyToOne(() => CatMarcaDispositivo, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdMarcaDispositivo', referencedColumnName: 'id' }])
  idMarcaDispositivo2: CatMarcaDispositivo;
}
