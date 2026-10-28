import { Column, Entity, PrimaryColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

/** Una casilla de la orden con su valor; se guardan también las apagadas. */
@applySchema
@Entity('OrdenServicioRespuestas')
export class OrdenServicioRespuestas {
  @PrimaryColumn('bigint', { name: 'IdOrdenServicio' })
  idOrdenServicio: number;

  @PrimaryColumn('varchar', { name: 'Seccion', length: 32 })
  seccion: string;

  @PrimaryColumn('varchar', { name: 'Clave', length: 40 })
  clave: string;

  @Column('tinyint', { name: 'Valor' })
  valor: number;
}
