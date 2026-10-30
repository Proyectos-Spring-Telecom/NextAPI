import { Column, Entity, Index, PrimaryColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

/** Estatus de dispositivos y SIM (docs/motor-activos.md §1). */
@applySchema
@Index('UQ_CatEstatusRecurso_Codigo', ['codigo'], { unique: true })
@Entity('CatEstatusRecurso')
export class CatEstatusRecurso {
  @PrimaryColumn('tinyint', { name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Codigo', length: 20 })
  codigo: string;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('varchar', { name: 'Descripcion', length: 255 })
  descripcion: string;
}
