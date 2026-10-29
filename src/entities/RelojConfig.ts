import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Dispositivos } from './Dispositivos';

/** Configuración de relojes FA100S (1:1 con Dispositivos). DDL: deploy/sql/Relojes.sql. */
@applySchema
@Index('FK_RelojConfig_Dispositivo', ['idCliente', 'idDispositivo'])
@Entity('RelojConfig')
export class RelojConfig {
  @PrimaryColumn('bigint', { name: 'IdDispositivo' })
  idDispositivo: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('int', {
    name: 'IntervaloReporteSegundos',
    nullable: true,
    default: () => "'300'",
    comment: 'UPLOAD: cada cuántos seg reporta posición en movimiento',
  })
  intervaloReporteSegundos: number | null;

  @Column('int', {
    name: 'IntervaloGpsSegundos',
    nullable: true,
    default: () => "'600'",
    comment: 'CR: cada cuántos seg el servidor enciende el GPS (0 = solo en SOS/caída)',
  })
  intervaloGpsSegundos: number | null;

  @Column('tinyint', { name: 'DeteccionCaida', default: () => "'1'" })
  deteccionCaida: number;

  @Column('tinyint', { name: 'LlamadaPorCaida', default: () => "'1'" })
  llamadaPorCaida: number;

  @Column('tinyint', {
    name: 'SensibilidadCaida',
    default: () => "'3'",
    comment: 'LSSET n+6: 1 a 6, mayor = menos sensible',
  })
  sensibilidadCaida: number;

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

  @OneToOne(() => Dispositivos, {
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([
    { name: 'IdCliente', referencedColumnName: 'idCliente' },
    { name: 'IdDispositivo', referencedColumnName: 'id' },
  ])
  idDispositivo2: Dispositivos;
}
