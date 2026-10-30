import { Column, Entity, PrimaryColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

/**
 * Prueba de una orden coordinada con el operador (transmisión, pánico, paro de
 * motor): el técnico la pide, el operador la verifica en su pantalla y deja el
 * resultado (DDL: deploy/sql/OrdenesServicioEtapa3.sql).
 */
@applySchema
@Entity('OrdenServicioPruebas')
export class OrdenServicioPruebas {
  @PrimaryColumn('bigint', { name: 'IdOrdenServicio' })
  idOrdenServicio: number;

  /** Clave de la sección `pruebas` del catálogo. */
  @PrimaryColumn('varchar', { name: 'Clave', length: 40 })
  clave: string;

  /** `solicitada` | `correcta` | `fallida`. */
  @Column('varchar', { name: 'Estatus', length: 10 })
  estatus: string;

  @Column('datetime', { name: 'FechaSolicitud' })
  fechaSolicitud: Date;

  @Column('bigint', { name: 'IdUsuarioSolicito' })
  idUsuarioSolicito: number;

  @Column('text', { name: 'NotaTecnico', nullable: true })
  notaTecnico: string | null;

  @Column('datetime', { name: 'FechaValidacion', nullable: true })
  fechaValidacion: Date | null;

  @Column('bigint', { name: 'IdUsuarioValido', nullable: true })
  idUsuarioValido: number | null;

  @Column('varchar', { name: 'NombreValido', length: 120, nullable: true })
  nombreValido: string | null;

  @Column('text', { name: 'NotaOperador', nullable: true })
  notaOperador: string | null;
}
