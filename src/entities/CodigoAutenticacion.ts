import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Usuarios } from './Usuarios';

@applySchema
@Index('IDX_CodigoAutenticacion_IdUsuario', ['idUsuario'])
@Entity('CodigoAutenticacion')
export class CodigoAutenticacion {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  id: number;

  @Column({ name: 'IdUsuario', type: 'bigint' })
  idUsuario: number;

  @Column({ name: 'Codigo', type: 'varchar', length: 6 })
  codigo: string;

  @Column({ name: 'Tipo', type: 'tinyint', unsigned: true })
  tipo: number;

  @Column('datetime', {
    name: 'FechaCreacion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaCreacion: Date;

  @Column('datetime', { name: 'FechaExpiracion' })
  fechaExpiracion: Date;

  @Column('tinyint', { name: 'Usado', default: () => "'0'" })
  usado: number;

  @Column('datetime', { name: 'FechaUso', nullable: true })
  fechaUso: Date | null;

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;

  @Column('int', {
    name: 'IntentosFallidos',
    nullable: true,
    default: () => "'0'",
  })
  intentosFallidos: number | null;

  @ManyToOne(() => Usuarios, {
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdUsuario', referencedColumnName: 'id' }])
  idUsuario2: Usuarios;
}
