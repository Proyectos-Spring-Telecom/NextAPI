import { Column, Entity, PrimaryColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

/** Dentro o fuera de un vehículo en un punto de interés (lo comparten sus equipos). */
@applySchema
@Entity('EstadoPuntoInteres')
export class EstadoPuntoInteres {
  @PrimaryColumn('bigint', { name: 'IdProducto' })
  idProducto: number;

  @PrimaryColumn('bigint', { name: 'IdPuntoInteres' })
  idPuntoInteres: number;

  @Column('tinyint', { name: 'Dentro' })
  dentro: number;

  /** De la posición que fijó el estado (hora de México). */
  @Column('datetime', { name: 'FechaHora' })
  fechaHora: Date;
}
