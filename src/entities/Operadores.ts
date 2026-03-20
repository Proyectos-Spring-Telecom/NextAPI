import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Clientes } from './Clientes';
import { Usuarios } from './Usuarios';
import { CatEstatusOperador } from './CatEstatusOperador';

@applySchema
@Index('UQ_Operadores_IdUsuario', ['idUsuario'], { unique: true })
@Index('UQ_Operadores_IdCliente_CURP', ['idCliente', 'curp'], { unique: true })
@Index('UQ_Operadores_IdCliente_NSS', ['idCliente', 'nss'], { unique: true })
@Index('IX_Operadores_IdCliente_IdEstatusOperador', [
  'idCliente',
  'idEstatusOperador',
])
@Index('IX_Operadores_Estatus', ['estatus'])
@Entity('Operadores')
export class Operadores {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('bigint', { name: 'IdUsuario' })
  idUsuario: number;

  @Column('date', { name: 'FechaNacimiento' })
  fechaNacimiento: Date;

  @Column('varchar', { name: 'CURP', length: 18 })
  curp: string;

  @Column('varchar', { name: 'NSS', length: 11 })
  nss: string;

  @Column('varchar', { name: 'ContactoEmergenciaNombre', length: 200 })
  contactoEmergenciaNombre: string;

  @Column('varchar', { name: 'ContactoEmergenciaTelefono', length: 14 })
  contactoEmergenciaTelefono: string;

  @Column('varchar', { name: 'Identificacion', length: 500 })
  identificacion: string;

  @Column('varchar', { name: 'Foto', length: 500, nullable: true })
  foto: string | null;

  @Column('varchar', {
    name: 'ComprobanteDomicilio',
    length: 500,
    nullable: true,
  })
  comprobanteDomicilio: string | null;

  @Column('varchar', { name: 'CertificadoMedico', length: 500, nullable: true })
  certificadoMedico: string | null;

  @Column('varchar', { name: 'AntecedentesNoPenales', length: 500, nullable: true })
  antecedentesNoPenales: string | null;

  @Column('bigint', { name: 'IdEstatusOperador', default: 1 })
  idEstatusOperador: number;

  @CreateDateColumn({ name: 'FechaCreacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'FechaActualizacion' })
  fechaActualizacion: Date;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;

  @ManyToOne(() => Clientes, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @ManyToOne(() => Usuarios, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdUsuario', referencedColumnName: 'id' }])
  idUsuario2: Usuarios;

  @ManyToOne(() => CatEstatusOperador, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdEstatusOperador', referencedColumnName: 'id' }])
  idEstatusOperador2: CatEstatusOperador;
}
