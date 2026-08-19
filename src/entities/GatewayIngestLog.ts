import { Column, Entity, PrimaryColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

export type GatewayIngestTipo = 'evento' | 'heartbeat';

/**
 * Idempotencia de ingest SIA (SpringPanel → Next).
 * PK = IdempotencyKey (SHA-256 hex, 64 chars).
 */
@applySchema
@Entity('GatewayIngestLog')
export class GatewayIngestLog {
  @PrimaryColumn('char', { name: 'IdempotencyKey', length: 64 })
  idempotencyKey: string;

  @Column('varchar', { name: 'Tipo', length: 16 })
  tipo: GatewayIngestTipo;

  @Column('bigint', { name: 'IdEventoAlarma', nullable: true })
  idEventoAlarma: number | null;

  @Column('datetime', { name: 'RecibidoEn' })
  recibidoEn: Date;

  @Column('datetime', {
    name: 'FHRegistro',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fhRegistro: Date;
}
