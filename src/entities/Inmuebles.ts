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
@Index('FK_Inmuebles_Clientes', ['idCliente'])
@Index('IX_Inmuebles_IdCliente_Estatus', ['idCliente', 'estatus'])
@Entity('Inmuebles')
export class Inmuebles {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Inmueble', nullable: true, length: 400 })
  inmueble: string | null;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('text', { name: 'DireccionFiscal', nullable: true })
  direccionFiscal: string | null;

  @Column('varchar', { name: 'VigenciaAnios', nullable: true, length: 45 })
  vigenciaAnios: string | null;

  @Column('datetime', { name: 'FechaInicio', nullable: true })
  fechaInicio: Date | null;

  @Column('datetime', { name: 'FechaFin', nullable: true })
  fechaFin: Date | null;

  @Column('varchar', {
    name: 'NombreRepresentante',
    nullable: true,
    length: 250,
  })
  nombreRepresentante: string | null;

  @Column('varchar', {
    name: 'TelefonoRepresentante',
    nullable: true,
    length: 10,
  })
  telefonoRepresentante: string | null;

  @Column('varchar', {
    name: 'CorreoRepresentante',
    nullable: true,
    length: 100,
  })
  correoRepresentante: string | null;

  @Column('datetime', {
    name: 'FHRegistro',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fhRegistro: Date;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;

  @Column('double', { name: 'Lat', nullable: true })
  lat: number | null;

  @Column('double', { name: 'Lng', nullable: true })
  lng: number | null;

  @Column('json', { name: 'MapaInmueble', nullable: true })
  mapaInmueble: Record<string, unknown> | null;

  @ManyToOne(() => Clientes, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;
}
