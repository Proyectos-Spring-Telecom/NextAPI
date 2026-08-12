import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Clientes } from './Clientes';
import { Usuarios } from './Usuarios';
import { Licencias } from './Licencias';

@applySchema
@Index('UQ_Operadores_IdUsuario', ['idUsuario'], { unique: true })
@Index('UQ_Operadores_IdCliente_CURP', ['idCliente', 'curp'], { unique: true })
@Index('UQ_Operadores_IdCliente_NSS', ['idCliente', 'nss'], { unique: true })
@Index('IX_Operadores_IdCliente_IdEstatusOperador', [
  'idCliente',
  'idEstatusOperador',
])
@Entity('Operadores')
export class Operadores {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', {
    name: 'IdCliente',
    comment: 'FK → Clientes.Id (multitenancy, directo para evitar JOINs)',
  })
  idCliente: number;

  @Column('bigint', {
    name: 'IdUsuario',
    comment: 'FK → Usuarios.Id (el operador es un usuario)',
  })
  idUsuario: number;

  @Column('date', { name: 'FechaNacimiento' })
  fechaNacimiento: Date;

  @Column('varchar', {
    name: 'CURP',
    length: 18,
    comment: 'Clave Única de Registro de Población',
  })
  curp: string;

  @Column('varchar', {
    name: 'NSS',
    length: 11,
    comment: 'Número de Seguro Social',
  })
  nss: string;

  @Column('varchar', { name: 'ContactoEmergenciaNombre', length: 200 })
  contactoEmergenciaNombre: string;

  @Column('varchar', { name: 'ContactoEmergenciaTelefono', length: 14 })
  contactoEmergenciaTelefono: string;

  @Column('varchar', {
    name: 'Identificacion',
    length: 500,
    comment: 'INE / Pasaporte',
  })
  identificacion: string;

  @Column('varchar', {
    name: 'Foto',
    length: 500,
    nullable: true,
    comment: 'Fotografía del operador',
  })
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

  @Column('bigint', {
    name: 'IdEstatusOperador',
    default: () => "'1'",
  })
  idEstatusOperador: number;

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

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;

  @ManyToOne(() => Clientes, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @ManyToOne(() => Usuarios, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdUsuario', referencedColumnName: 'id' }])
  idUsuario2: Usuarios;

  @OneToMany(() => Licencias, (licencia) => licencia.idOperador2)
  licencias: Licencias[];
}
