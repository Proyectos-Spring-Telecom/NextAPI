import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { CatTelefonia } from './CatTelefonia';

@applySchema
@Index('FK_CatPlanesTelefonia_Telefonia', ['idTelefonia'])
@Index('IX_CatPlanesTelefonia_Estatus', ['estatus'])
@Entity('CatPlanesTelefonia')
export class CatPlanesTelefonia {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 150 })
  nombre: string;

  @Column('varchar', { name: 'Descripcion', length: 500, nullable: true })
  descripcion: string | null;

  @Column('bigint', { name: 'IdTelefonia' })
  idTelefonia: number;

  @Column('int', { name: 'DatosMB', unsigned: true, nullable: true })
  datosMB: number | null;

  @Column('int', { name: 'SMSIncluidos', unsigned: true, default: 0 })
  smsIncluidos: number;

  @Column('int', { name: 'VozMinutos', unsigned: true, default: 0 })
  vozMinutos: number;

  @Column('varchar', { name: 'TecnologiaRed', length: 50, nullable: true })
  tecnologiaRed: string | null;

  @Column('varchar', { name: 'APN', length: 100, nullable: true })
  apn: string | null;

  @Column('varchar', { name: 'TipoRed', length: 50, default: 'M2M' })
  tipoRed: string;

  @Column('decimal', {
    name: 'CostoMensual',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  costoMensual: string | null;

  @Column('decimal', {
    name: 'CostoActivacion',
    precision: 10,
    scale: 2,
    default: '0.00',
  })
  costoActivacion: string;

  @Column('decimal', {
    name: 'CostoExcedenteMB',
    precision: 10,
    scale: 4,
    nullable: true,
  })
  costoExcedenteMB: string | null;

  @Column('varchar', { name: 'Moneda', length: 3, default: 'MXN' })
  moneda: string;

  @Column('int', { name: 'VigenciaDias', unsigned: true, default: 30 })
  vigenciaDias: number;

  @Column('tinyint', { name: 'RenovacionAutomatica', default: 1 })
  renovacionAutomatica: number;

  @Column('date', { name: 'FechaInicioVigencia', nullable: true })
  fechaInicioVigencia: Date | null;

  @Column('date', { name: 'FechaFinVigencia', nullable: true })
  fechaFinVigencia: Date | null;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;

  @ManyToOne(() => CatTelefonia, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdTelefonia', referencedColumnName: 'id' }])
  idTelefonia2: CatTelefonia;
}
