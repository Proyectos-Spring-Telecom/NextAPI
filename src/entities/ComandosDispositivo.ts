import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

/** Comando de Next a un equipo y su recorrido hasta la confirmación (docs/motor-activos.md §8). */
@applySchema
@Index('IX_ComandosDisp_Dispositivo', ['idDispositivo', 'fechaCreacion'])
@Index('IX_ComandosDisp_Estatus', ['estatus', 'fechaCreacion'])
@Entity('ComandosDispositivo')
export class ComandosDispositivo {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdDispositivo' })
  idDispositivo: number;

  @Column('varchar', { name: 'Protocolo', length: 10 })
  protocolo: string;

  @Column('varchar', { name: 'Tipo', length: 20 })
  tipo: string;

  @Column('varchar', { name: 'Contenido', length: 500 })
  contenido: string;

  @Column('varchar', { name: 'Estatus', length: 12 })
  estatus: string;

  @Column('varchar', { name: 'Detalle', nullable: true, length: 500 })
  detalle: string | null;

  /** Lo que el equipo devolvió al confirmar (p. ej. los parámetros leídos de la TrackCam). */
  @Column('json', { name: 'Resultado', nullable: true })
  resultado: Record<string, unknown> | null;

  @Column('int', { name: 'Intentos', default: () => "'0'" })
  intentos: number;

  @Column('bigint', { name: 'IdUsuario', nullable: true })
  idUsuario: number | null;

  @Column('varchar', { name: 'Origen', length: 10 })
  origen: string;

  @Column('datetime', { name: 'VenceAt' })
  venceAt: Date;

  @Column('datetime', { name: 'FechaCreacion' })
  fechaCreacion: Date;

  @Column('datetime', { name: 'FechaPublicado', nullable: true })
  fechaPublicado: Date | null;

  @Column('datetime', { name: 'FechaRecibido', nullable: true })
  fechaRecibido: Date | null;

  @Column('datetime', { name: 'FechaEnviado', nullable: true })
  fechaEnviado: Date | null;

  @Column('datetime', { name: 'FechaConfirmado', nullable: true })
  fechaConfirmado: Date | null;
}
