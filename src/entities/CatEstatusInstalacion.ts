import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('UQ_CatEstatusInstalacion_Codigo', ['codigo'], { unique: true })
@Entity('CatEstatusInstalacion')
export class CatEstatusInstalacion {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Codigo', length: 20 })
  codigo: string;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;
}
