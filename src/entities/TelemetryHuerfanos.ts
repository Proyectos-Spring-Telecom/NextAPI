import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

/** Equipos que transmiten sin alta en Next (DDL: deploy/sql/TelemetryHuerfanos.sql). */
@applySchema
@Index('UQ_TelemetryHuerfanos_ProtocolDevice', ['protocol', 'deviceId'], {
  unique: true,
})
@Index('IX_TelemetryHuerfanos_UltimaVez', ['ultimaVez'])
@Entity('TelemetryHuerfanos')
export class TelemetryHuerfanos {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Protocol', length: 16 })
  protocol: string;

  @Column('varchar', { name: 'DeviceId', length: 32 })
  deviceId: string;

  @Column('varchar', { name: 'Motivo', length: 32 })
  motivo: string;

  @Column('datetime', { name: 'PrimeraVez' })
  primeraVez: Date;

  @Column('datetime', { name: 'UltimaVez' })
  ultimaVez: Date;

  @Column('bigint', { name: 'Mensajes', default: 1 })
  mensajes: number;

  @Column('varchar', { name: 'UltimoRoutingKey', length: 128, nullable: true })
  ultimoRoutingKey: string | null;

  @Column('double', { name: 'UltimaLat', nullable: true })
  ultimaLat: number | null;

  @Column('double', { name: 'UltimaLng', nullable: true })
  ultimaLng: number | null;
}
