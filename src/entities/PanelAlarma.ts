import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Dispositivos } from './Dispositivos';

@applySchema
@Index('UQ_PanelAlarma_CuentaSia', ['cuentaSia'], { unique: true })
@Index('IX_PanelAlarma_UltimoHeartbeat', ['ultimoHeartbeat'])
@Index('FK_PanelAlarma_Dispositivo', ['idCliente', 'idDispositivo'])
@Entity('PanelAlarma')
export class PanelAlarma {
  @PrimaryColumn('bigint', { name: 'IdDispositivo' })
  idDispositivo: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('varchar', { name: 'CuentaSia', length: 20 })
  cuentaSia: string;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('varchar', { name: 'Ip', nullable: true, length: 45 })
  ip: string | null;

  @Column('tinyint', { name: 'CifradoActivo', default: () => "'0'" })
  cifradoActivo: number;

  @Column('varchar', {
    name: 'AesKey',
    nullable: true,
    length: 255,
    comment: 'TODO: cifrar en reposo',
  })
  aesKey: string | null;

  @Column('smallint', { name: 'AesBits', default: () => "'128'" })
  aesBits: number;

  @Column('datetime', { name: 'UltimoHeartbeat', nullable: true })
  ultimoHeartbeat: Date | null;

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;

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

  @ManyToOne(() => Dispositivos, {
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([
    { name: 'IdCliente', referencedColumnName: 'idCliente' },
    { name: 'IdDispositivo', referencedColumnName: 'id' },
  ])
  idDispositivo2: Dispositivos;
}
