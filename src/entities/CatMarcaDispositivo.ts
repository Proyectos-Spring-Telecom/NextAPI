import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('UQ_CatMarcaDispositivo_Nombre', ['nombre'], { unique: true })
@Index('IX_CatMarcaDispositivo_Estatus', ['estatus'])
@Entity('CatMarcaDispositivo')
export class CatMarcaDispositivo {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('varchar', { name: 'SitioWeb', length: 255, nullable: true })
  sitioWeb: string | null;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;
}
