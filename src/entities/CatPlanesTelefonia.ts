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

  @Column('varchar', { name: 'Descripcion', length: 500, nullable: true })
  descripcion: string | null;

  @Column('bigint', { name: 'IdTelefonia' })
  idTelefonia: number;

  @Column('varchar', {
    name: 'Datos',
    length: 100,
    nullable: true,
    default: () => "'0'",
    comment: 'Cantidad de datos incluidos en MB (NULL = ilimitado)',
  })
  datos: string | null;

  @Column('varchar', {
    name: 'SMSIncluidos',
    length: 100,
    nullable: true,
    default: () => "'0'",
    comment: 'Cantidad de SMS incluidos',
  })
  smsIncluidos: string | null;

  @Column('varchar', {
    name: 'VozIncluidos',
    length: 100,
    nullable: true,
    default: () => "'0'",
    comment: 'Minutos de voz incluidos',
  })
  vozIncluidos: string | null;

  @Column('varchar', {
    name: 'CostoMensual',
    length: 100,
    nullable: true,
    comment: 'Costo mensual en MXN',
  })
  costoMensual: string | null;

  @Column('date', {
    name: 'FechaInicioVigencia',
    nullable: true,
    comment: 'Desde cuándo está disponible el plan',
  })
  fechaInicioVigencia: string | null;

  @Column('date', {
    name: 'FechaFinVigencia',
    nullable: true,
    comment: 'Hasta cuándo está disponible (NULL = sin fecha fin)',
  })
  fechaFinVigencia: string | null;

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

  @ManyToOne(() => CatTelefonia, (telefonia) => telefonia.planesTelefonia, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdTelefonia', referencedColumnName: 'id' }])
  telefonia: CatTelefonia;
}
