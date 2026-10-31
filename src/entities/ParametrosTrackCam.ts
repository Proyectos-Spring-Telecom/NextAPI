import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Dispositivos } from './Dispositivos';

/** Parámetros JT808 de la TrackCam (1:1 con Dispositivos). DDL: deploy/sql/MotorActivosFaseFTrackCam.sql. */
@applySchema
@Entity('ParametrosTrackCam')
export class ParametrosTrackCam {
  @PrimaryColumn('bigint', { name: 'IdDispositivo' })
  idDispositivo: number;

  /** Pedido desde Next, por id hex (`0x0029`): solo lo que se ha configurado. */
  @Column('json', { name: 'Deseado', nullable: true })
  deseado: Record<string, number> | null;

  /** Última lectura completa de la cámara, por id hex. */
  @Column('json', { name: 'Leido', nullable: true })
  leido: Record<string, number | string> | null;

  @Column('datetime', { name: 'FechaLectura', nullable: true })
  fechaLectura: Date | null;

  @Column('bigint', { name: 'IdUsuario', nullable: true })
  idUsuario: number | null;

  @Column('datetime', { name: 'FechaActualizacion', nullable: true })
  fechaActualizacion: Date | null;

  @OneToOne(() => Dispositivos, { onDelete: 'CASCADE', onUpdate: 'NO ACTION' })
  @JoinColumn([{ name: 'IdDispositivo', referencedColumnName: 'id' }])
  idDispositivo2: Dispositivos;
}
