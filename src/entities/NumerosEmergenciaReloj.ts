import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

/** Números de emergencia del reloj de una persona (producto): SOS 1–3, centro y agenda hasta 15. */
@applySchema
@Index('UQ_NumEmergReloj_Producto_Tipo_Orden', ['idProducto', 'tipo', 'orden'], { unique: true })
@Index('IX_NumEmergReloj_Cliente', ['idCliente'])
@Entity('NumerosEmergenciaReloj')
export class NumerosEmergenciaReloj {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('bigint', { name: 'IdProducto' })
  idProducto: number;

  @Column('varchar', { name: 'Tipo', length: 8 })
  tipo: string;

  @Column('tinyint', { name: 'Orden' })
  orden: number;

  @Column('varchar', { name: 'Nombre', nullable: true, length: 20 })
  nombre: string | null;

  @Column('varchar', { name: 'Telefono', length: 20 })
  telefono: string;

  @Column('bigint', { name: 'IdUsuario', nullable: true })
  idUsuario: number | null;

  @Column('datetime', { name: 'FechaActualizacion' })
  fechaActualizacion: Date;
}
