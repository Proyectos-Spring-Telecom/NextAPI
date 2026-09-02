import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Dispositivos } from './Dispositivos';

@applySchema
@Index('UQ_UltimaPosicion_Imei', ['imei'], { unique: true })
@Entity('UltimaPosicion')
export class UltimaPosicion {
  @PrimaryGeneratedColumn({ type: 'int', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'Imei' })
  imei: number;

  @Column('double', { name: 'Lat' })
  lat: number;

  @Column('double', { name: 'Lng' })
  lng: number;

  @Column('int', { name: 'Estado', nullable: true })
  estado: number | null;

  @Column('datetime', { name: 'FechaHora' })
  fechaHora: Date;

  @Column('int', { name: 'Velocidad' })
  velocidad: number;

  @Column('int', { name: 'Direccion' })
  direccion: number;

  @Column('int', { name: 'Odometro', nullable: true })
  odometro: number | null;

  @Column('int', { name: 'Ignicion', nullable: true })
  ignicion: number | null;

  @Column('int', { name: 'Alarma1', nullable: true })
  alarma1: number | null;

  @Column('int', { name: 'Alarma2', nullable: true })
  alarma2: number | null;

  @Column('int', { name: 'Energia', nullable: true })
  energia: number | null;

  @Column('int', { name: 'IdEvento', nullable: true })
  idEvento: number | null;

  @Column('bigint', { name: 'IdFoto', nullable: true })
  idFoto: number | null;

  @Column('datetime', {
    name: 'FHRegistro',
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  fhRegistro: Date | null;

  @Column('float', { name: 'Bateria', nullable: true })
  bateria: number | null;

  @Column('float', { name: 'Alimentacion', nullable: true })
  alimentacion: number | null;

  @Column('int', { name: 'GPS', nullable: true })
  gps: number | null;

  @Column('int', { name: 'GSM', nullable: true })
  gsm: number | null;

  @Column('int', { name: 'Movimiento', nullable: true })
  movimiento: number | null;

  @Column('int', { name: 'Combustible', nullable: true })
  combustible: number | null;

  @Column('varchar', { name: 'Foto1', length: 500, nullable: true })
  foto1: string | null;

  @Column('varchar', { name: 'Foto2', length: 500, nullable: true })
  foto2: string | null;

  @Column('varchar', { name: 'Foto3', length: 500, nullable: true })
  foto3: string | null;

  @Column('varchar', { name: 'Video1', length: 500, nullable: true })
  video1: string | null;

  @Column('varchar', { name: 'Video2', length: 500, nullable: true })
  video2: string | null;

  @Column('varchar', { name: 'Video3', length: 500, nullable: true })
  video3: string | null;

  @OneToOne(() => Dispositivos, (d) => d.ultimaPosicion, {
    onDelete: 'NO ACTION',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'Imei', referencedColumnName: 'imei' }])
  imei2: Dispositivos;
}
