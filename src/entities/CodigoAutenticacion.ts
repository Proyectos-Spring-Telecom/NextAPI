// src/usuarios/entities/codigo-autenticacion.entity.ts

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { Usuarios } from './Usuarios'; 

@Entity('CodigoAutenticacion')
export class CodigoAutenticacion {
  @PrimaryGeneratedColumn({ name: 'Id', type: 'bigint' })
  id: number;

  @Column({ name: 'IdUsuario', type: 'bigint' })
  idUsuario: number;

  @Column({ name: 'Codigo', type: 'varchar', length: 4 })
  codigo: string;

  @Column({ name: 'Tipo', type: 'tinyint', })
  tipo: number;

  @CreateDateColumn({ name: 'FechaCreacion', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  fechaCreacion: Date;

  @Column({ name: 'FechaExpiracion', type: 'datetime' })
  fechaExpiracion: Date;

  @Column({ name: 'Usado', type: 'tinyint', default: () => 0 })
  usado: number;

  @Column({ name: 'FechaUso', type: 'datetime', nullable: true })
  fechaUso: Date | null;

  @Column({ name: 'Estatus', type: 'tinyint', default: () => 1 })
  estatus: number;

}
