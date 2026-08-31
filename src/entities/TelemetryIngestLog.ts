import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('UQ_TelemetryIngestLog_EventId', ['eventId'], { unique: true })
@Index('IX_TelemetryIngestLog_DeviceId', ['deviceId'])
@Index('IX_TelemetryIngestLog_FHRegistro', ['fhRegistro'])
@Entity('TelemetryIngestLog')
export class TelemetryIngestLog {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'EventId', length: 64 })
  eventId: string;

  @Column('varchar', { name: 'Protocol', length: 16 })
  protocol: string;

  @Column('varchar', { name: 'Kind', length: 32 })
  kind: string;

  @Column('varchar', { name: 'DeviceId', length: 20 })
  deviceId: string;

  @Column('varchar', { name: 'RoutingKey', length: 128, nullable: true })
  routingKey: string | null;

  @Column('bigint', { name: 'PosicionId', nullable: true })
  posicionId: number | null;

  @Column('json', { name: 'PayloadJson', nullable: true })
  payloadJson: unknown;

  @Column('datetime', {
    name: 'FHRegistro',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fhRegistro: Date;
}
