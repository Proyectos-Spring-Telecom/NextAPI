import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

/** Llegada o salida de un vehículo a un punto de interés ligado (en vivo). */
@applySchema
@Index('IX_EventosPuntoInteres_Instalacion', ['idInstalacion', 'fechaHora'])
@Index('IX_EventosPuntoInteres_Punto', ['idPuntoInteres', 'fechaHora'])
@Index('IX_EventosPuntoInteres_Producto', ['idProducto', 'fechaHora'])
@Entity('EventosPuntoInteres')
export class EventosPuntoInteres {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdPuntoInteres' })
  idPuntoInteres: number;

  @Column('bigint', { name: 'IdProducto' })
  idProducto: number;

  @Column('bigint', { name: 'IdInstalacion' })
  idInstalacion: number;

  @Column('bigint', { name: 'IdPosicion' })
  idPosicion: number;

  /** `llegada` | `salida` */
  @Column('varchar', { name: 'Tipo', length: 10 })
  tipo: 'llegada' | 'salida';

  /** De la posición (hora de México). */
  @Column('datetime', { name: 'FechaHora' })
  fechaHora: Date;

  @Column('datetime', { name: 'FechaRegistro', default: () => 'CURRENT_TIMESTAMP' })
  fechaRegistro: Date;
}
