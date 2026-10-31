import { Column, Entity, PrimaryColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

/**
 * Una fila por día de evaluación de la vigilancia de transmisión. Se inserta
 * antes de evaluar: la llave primaria evita evaluar dos veces el mismo día.
 */
@applySchema
@Entity('EvaluacionesTransmision')
export class EvaluacionesTransmision {
  /** Día en hora de México, `YYYY-MM-DD`. */
  @PrimaryColumn('date', { name: 'Fecha' })
  fecha: string;

  @Column('datetime', { name: 'Inicio' })
  inicio: Date;

  @Column('datetime', { name: 'Fin', nullable: true })
  fin: Date | null;

  @Column('int', { name: 'Avisos', default: () => '0' })
  avisos: number;

  @Column('int', { name: 'Cerrados', default: () => '0' })
  cerrados: number;

  @Column('varchar', { name: 'Origen', length: 10 })
  origen: string;

  @Column('bigint', { name: 'IdUsuario', nullable: true })
  idUsuario: number | null;
}
