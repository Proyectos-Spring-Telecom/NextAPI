import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Clientes } from './Clientes';

@applySchema
@Index('IX_NumerosEmergenciaCliente_IdCliente', ['idCliente'])
@Index('IX_NumerosEmergenciaCliente_Cliente_Estatus', ['idCliente', 'estatus'])
@Entity('NumerosEmergenciaCliente')
export class NumerosEmergenciaCliente {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('varchar', {
    name: 'Nombre',
    length: 100,
    nullable: true,
  })
  nombre: string | null;

  @Column('varchar', { name: 'Telefono', length: 14 })
  telefono: string;

  @Column('varchar', {
    name: 'Descripcion',
    length: 255,
    nullable: true,
  })
  descripcion: string | null;

  @Column('int', { name: 'Prioridad', default: () => "'1'" })
  prioridad: number;

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;

  @Column('datetime', {
    name: 'FechaCreacion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaCreacion: Date;

  @Column('datetime', {
    name: 'FechaActualizacion',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  fechaActualizacion: Date;

  @ManyToOne(() => Clientes, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;
}
