import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { PanelAlarma } from './PanelAlarma';

@applySchema
@Index('FK_EventoAlarma_PanelAlarma', ['idPanel'])
@Index('IX_EventoAlarma_IdCliente_RecibidoEn', ['idCliente', 'recibidoEn'])
@Index('IX_EventoAlarma_IdPanel_RecibidoEn', ['idPanel', 'recibidoEn'])
@Entity('EventoAlarma')
export class EventoAlarma {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdPanel', nullable: true })
  idPanel: number | null;

  @Column('bigint', { name: 'IdCliente', nullable: true })
  idCliente: number | null;

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

  @Column('varchar', { name: 'Secuencia', nullable: true, length: 8 })
  secuencia: string | null;

  @Column('text', { name: 'FrameCrudo' })
  frameCrudo: string;

  @Column('text', { name: 'DataDescifrada', nullable: true })
  dataDescifrada: string | null;

  @Column('varchar', { name: 'IpOrigen', nullable: true, length: 45 })
  ipOrigen: string | null;

  @Column('datetime', { name: 'RecibidoEn' })
  recibidoEn: Date;

  @Column('varchar', { name: 'TimestampPanel', nullable: true, length: 40 })
  timestampPanel: string | null;

  @CreateDateColumn({ name: 'FechaCreacion' })
  fechaCreacion: Date;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;

  @ManyToOne(() => PanelAlarma, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdPanel', referencedColumnName: 'id' }])
  idPanel2: PanelAlarma;
}
