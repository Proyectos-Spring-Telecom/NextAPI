import { Column, Entity, Index, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { CatPlanesTelefonia } from './CatPlanesTelefonia';

@applySchema
@Index('UQ_CatTelefonia_Nombre', ['nombreTelefonia'], { unique: true })
@Entity({ name: 'CatTelefonia' })
export class CatTelefonia {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'NombreTelefonia', length: 100 })
  nombreTelefonia: string;

  @Column('varchar', { name: 'NombreAsesor', length: 200, nullable: true })
  nombreAsesor: string | null;

  @Column('varchar', { name: 'NumeroAsesor', length: 20, nullable: true })
  numeroAsesor: string | null;

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;

  @OneToMany(() => CatPlanesTelefonia, (plan) => plan.telefonia)
  planesTelefonia: CatPlanesTelefonia[];
}
