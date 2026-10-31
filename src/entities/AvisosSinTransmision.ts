import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

/**
 * Bandeja "Sin transmisión" de monitoreo (docs/motor-activos.md §7b): un aviso
 * abierto o atendido por instalación. Sin llaves foráneas: es evidencia.
 */
@applySchema
@Index('IX_AvisosSinTx_Estatus', ['estatus', 'fechaEvaluacion'])
@Index('IX_AvisosSinTx_Instalacion', ['idInstalacion', 'estatus'])
@Index('UQ_AvisosSinTx_Vivo', ['idInstalacionVivo'], { unique: true })
@Entity('AvisosSinTransmision')
export class AvisosSinTransmision {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdInstalacion' })
  idInstalacion: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('bigint', { name: 'IdDispositivo' })
  idDispositivo: number;

  @Column('bigint', { name: 'IdTipoDispositivo' })
  idTipoDispositivo: number;

  @Column('bigint', { name: 'IdSim', nullable: true })
  idSim: number | null;

  @Column('bigint', { name: 'IdTelefonia', nullable: true })
  idTelefonia: number | null;

  /** Día de la última evaluación que lo encontró sin transmitir, `YYYY-MM-DD`. */
  @Column('date', { name: 'FechaEvaluacion' })
  fechaEvaluacion: string;

  /** Evaluación que lo abrió: agrupa la posible falla de un proveedor. */
  @Column('date', { name: 'FechaPrimeraEvaluacion' })
  fechaPrimeraEvaluacion: string;

  @Column('datetime', { name: 'UltimaTransmision' })
  ultimaTransmision: Date;

  @Column('int', { name: 'HorasSinTransmitir' })
  horasSinTransmitir: number;

  /** abierto | atendido | cerrado */
  @Column('varchar', { name: 'Estatus', length: 12 })
  estatus: string;

  /** falla_equipo | taller | proveedor | cliente_avisado | otro */
  @Column('varchar', { name: 'Resultado', nullable: true, length: 20 })
  resultado: string | null;

  @Column('varchar', { name: 'Comentario', nullable: true, length: 1000 })
  comentario: string | null;

  /** Taller: la vigilancia de la instalación se pausa hasta esta fecha. */
  @Column('datetime', { name: 'FechaRegreso', nullable: true })
  fechaRegreso: Date | null;

  @Column('bigint', { name: 'IdUsuarioAtiende', nullable: true })
  idUsuarioAtiende: number | null;

  @Column('datetime', { name: 'FechaAtencion', nullable: true })
  fechaAtencion: Date | null;

  @Column('datetime', { name: 'FechaCierre', nullable: true })
  fechaCierre: Date | null;

  /** transmitio | baja */
  @Column('varchar', { name: 'MotivoCierre', nullable: true, length: 20 })
  motivoCierre: string | null;

  @Column('datetime', { name: 'FechaCreacion' })
  fechaCreacion: Date;

  /** Un aviso vivo (abierto o atendido) por instalación: UNIQUE sobre esta columna generada. */
  @Column({
    type: 'bigint',
    name: 'IdInstalacionVivo',
    nullable: true,
    asExpression: "if((`Estatus` in ('abierto','atendido')),`IdInstalacion`,NULL)",
    generatedType: 'STORED',
    insert: false,
    update: false,
  })
  idInstalacionVivo: number | null;
}
