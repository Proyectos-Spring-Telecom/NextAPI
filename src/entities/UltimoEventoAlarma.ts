import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Dispositivos } from './Dispositivos';
import { EventoAlarma } from './EventoAlarma';
import { Clientes } from './Clientes';

@applySchema
@Index('UQ_UltimoEventoAlarma_IdPanel', ['idPanel'], { unique: true })
@Index('IX_UltimoEventoAlarma_IdCliente', ['idCliente'])
@Index('IX_UltimoEventoAlarma_CodigoSia', ['codigoSia'])
@Index('IX_UltimoEventoAlarma_RecibidoEn', ['recibidoEn'])
@Index('FK_UltimoEventoAlarma_Evento', ['idEventoAlarma'])
@Entity('UltimoEventoAlarma')
export class UltimoEventoAlarma {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdPanel' })
  idPanel: number;

  @Column('bigint', { name: 'IdCliente', nullable: true })
  idCliente: number | null;

  @Column('bigint', {
    name: 'IdEventoAlarma',
    comment: 'FK al evento en EventoAlarma',
  })
  idEventoAlarma: number;

  @Column('varchar', { name: 'CodigoSia', length: 8 })
  codigoSia: string;

  @Column('varchar', { name: 'TipoEvento', length: 40 })
  tipoEvento: string;

  @Column('tinyint', { name: 'EsRestauracion', default: () => "'0'" })
  esRestauracion: number;

  @Column('int', { name: 'Zona', nullable: true })
  zona: number | null;

  @Column('int', { name: 'Particion', nullable: true })
  particion: number | null;

  @Column('int', {
    name: 'CodigoUsuario',
    nullable: true,
    comment:
      'Código de usuario que disparó el evento (eventos de armado/desarmado)',
  })
  codigoUsuario: number | null;

  @Column('varchar', {
    name: 'NombreDispositivo',
    nullable: true,
    length: 100,
    comment:
      'Nombre del sensor/zona/dispositivo (campo S del frame, ej. Cocina, Sirena)',
  })
  nombreDispositivo: string | null;

  @Column('tinyint', {
    name: 'Severidad',
    unsigned: true,
    default: () => "'1'",
    comment: '1=Info, 2=Advertencia, 3=Crítica',
  })
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

  @Column('datetime', {
    name: 'FechaActualizacion',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  fechaActualizacion: Date;

  @ManyToOne(() => Clientes, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes | null;

  @ManyToOne(() => Dispositivos, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdPanel', referencedColumnName: 'id' }])
  idPanel2: Dispositivos;

  @ManyToOne(() => EventoAlarma, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdEventoAlarma', referencedColumnName: 'id' }])
  idEventoAlarma2: EventoAlarma;
}
