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
import { PanelAlarma } from './PanelAlarma';

@applySchema
@Index('IX_EventoAlarma_IdCliente_RecibidoEn', ['idCliente', 'recibidoEn'])
@Index('IX_EventoAlarma_IdPanel_RecibidoEn', ['idPanel', 'recibidoEn'])
@Index('IX_EventoAlarma_CodigoSia', ['codigoSia'])
@Index('IX_EventoAlarma_RecibidoEn', ['recibidoEn'])
@Index('FK_EventoAlarma_Panel', ['idPanel'])
@Index('FK_EventoAlarma_Clientes', ['idCliente'])
@Index('IX_EventoAlarma_NombreDispositivo', ['nombreDispositivo'])
@Entity('EventoAlarma')
export class EventoAlarma {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', {
    name: 'IdPanel',
    nullable: true,
    comment: 'FK a PanelAlarma; NULL si llegó #acct desconocido',
  })
  idPanel: number | null;

  @Column('bigint', {
    name: 'IdCliente',
    nullable: true,
    comment: 'Desnormalizado para filtro multi-tenant',
  })
  idCliente: number | null;

  @Column('varchar', {
    name: 'CodigoSia',
    length: 8,
    comment: 'BA, OP, TA, AT, YT, etc.',
  })
  codigoSia: string;

  @Column('varchar', {
    name: 'TipoEvento',
    length: 40,
    comment:
      'intrusion, arm, disarm, tamper, ac_loss, low_battery, zone, restore',
  })
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

  @Column('varchar', {
    name: 'Secuencia',
    nullable: true,
    length: 8,
    comment: 'SEQ del frame DC-09',
  })
  secuencia: string | null;

  @Column('text', { name: 'FrameCrudo' })
  frameCrudo: string;

  @Column('text', { name: 'DataDescifrada', nullable: true })
  dataDescifrada: string | null;

  @Column('varchar', { name: 'IpOrigen', nullable: true, length: 45 })
  ipOrigen: string | null;

  @Column('datetime', {
    name: 'RecibidoEn',
    comment: 'Timestamp de recepción en el server',
  })
  recibidoEn: Date;

  @Column('varchar', { name: 'TimestampPanel', nullable: true, length: 40 })
  timestampPanel: string | null;

  @Column('datetime', {
    name: 'FechaCreacion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaCreacion: Date;

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;

  @ManyToOne(() => Clientes, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes | null;

  @ManyToOne(() => PanelAlarma, {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([
    { name: 'IdPanel', referencedColumnName: 'idDispositivo' },
  ])
  idPanel2: PanelAlarma | null;
}
