import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { CatCategoriaMantenimientoMecanico } from './CatCategoriaMantenimientoMecanico';

@applySchema
@Index('FK_CatCaracEvlnMttoMco_CatCatMntnoMco', [
  'idCatCategoriaMantenimientoMecanico',
])
@Entity('CatCaracteristicasEvaluacionMttoMecanico')
export class CatCaracteristicasEvaluacionMttoMecanico {
  @PrimaryColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 250 })
  nombre: string;

  @Column('bigint', { name: 'IdCatCategoriaMantenimientoMecanico' })
  idCatCategoriaMantenimientoMecanico: number;

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;

  @ManyToOne(() => CatCategoriaMantenimientoMecanico, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([
    {
      name: 'IdCatCategoriaMantenimientoMecanico',
      referencedColumnName: 'id',
    },
  ])
  idCatCategoriaMantenimientoMecanico2: CatCategoriaMantenimientoMecanico;
}
