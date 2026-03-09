import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('UQ_CatTelefonia_Nombre', ['nombre'], { unique: true })
@Index('IX_CatTelefonia_Estatus', ['estatus'])
@Entity('CatTelefonia')
export class CatTelefonia {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('varchar', { name: 'NombreCorto', length: 20, nullable: true })
  nombreCorto: string | null;

  @Column('varchar', { name: 'PaisCobertura', length: 100, default: 'México' })
  paisCobertura: string;

  @Column('varchar', { name: 'SitioWeb', length: 255, nullable: true })
  sitioWeb: string | null;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;
}
