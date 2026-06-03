import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { PanelAlarma } from './PanelAlarma';
import { EventoAlarma } from './EventoAlarma';

@applySchema
@Index('UQ_UltimoEventoAlarma_IdPanel', ['idPanel'], { unique: true })
@Index('FK_UltimoEventoAlarma_PanelAlarma', ['idPanel'])
@Index('FK_UltimoEventoAlarma_EventoAlarma', ['idEventoAlarma'])
@Entity('UltimoEventoAlarma')
export class UltimoEventoAlarma {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdPanel' })
  idPanel: number;

  @Column('bigint', { name: 'IdCliente', nullable: true })
  idCliente: number | null;

  @Column('bigint', { name: 'IdEventoAlarma' })
  idEventoAlarma: number;

  @Column('varchar', { name: 'CodigoSia', length: 8 })
  codigoSia: string;

  @Column('varchar', { name: 'TipoEvento', length: 40 })
  tipoEvento: string;

  @Column('tinyint', { name: 'EsRestauracion', default: 0 })
  esRestauracion: number;

  @Column('int', { name: 'Zona', nullable: true })
  zona: number | null;

  @Column('int', { name: 'Particion', nullable: true })
  particion: number | null;

  @Column('int', { name: 'CodigoUsuario', nullable: true })
  codigoUsuario: number | null;

  @Column('varchar', { name: 'NombreDispositivo', nullable: true, length: 100 })
  nombreDispositivo: string | null;

  @Column('tinyint', { name: 'Severidad', unsigned: true, default: 1 })
  severidad: number;

  @Column('varchar', { name: 'IpOrigen', nullable: true, length: 45 })
  ipOrigen: string | null;

  @Column('datetime', { name: 'RecibidoEn' })
  recibidoEn: Date;

  @Column('varchar', { name: 'TimestampPanel', nullable: true, length: 40 })
  timestampPanel: string | null;

  @Column('datetime', {
    name: 'FHRegistro',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fhRegistro: Date;

  @ManyToOne(() => PanelAlarma, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdPanel', referencedColumnName: 'id' }])
  idPanel2: PanelAlarma;

  @ManyToOne(() => EventoAlarma, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdEventoAlarma', referencedColumnName: 'id' }])
  idEventoAlarma2: EventoAlarma;
}
