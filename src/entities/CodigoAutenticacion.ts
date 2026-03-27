import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

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

  @CreateDateColumn({
    name: 'FechaCreacion',
    type: 'datetime',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaCreacion: Date;

  @Column({ name: 'FechaExpiracion', type: 'datetime' })
  fechaExpiracion: Date;

  @Column({ name: 'Usado', type: 'tinyint', default: () => 0 })
  usado: number;

  @Column({ name: 'FechaUso', type: 'datetime', nullable: true })
  fechaUso: Date | null;

  @Column({ name: 'Estatus', type: 'tinyint', default: () => 1 })
  estatus: number;

  @Column({ name: 'IntentosFallidos', type: 'int', default: 0 })
  intentosFallidos: number;
}
