import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Dispositivos } from './Dispositivos';

@applySchema
@Index('FK_TrackcamConfig_Dispositivo', ['idCliente', 'idDispositivo'])
@Entity('TrackcamConfig')
export class TrackcamConfig {
  @PrimaryColumn('bigint', { name: 'IdDispositivo' })
  idDispositivo: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('int', {
    name: 'IntervaloPosicionSegundos',
    nullable: true,
    comment: 'Cada cuántos seg reporta posición (en movimiento)',
  })
  intervaloPosicionSegundos: number | null;

  @Column('int', {
    name: 'IntervaloPosicionDetenidoSegundos',
    nullable: true,
    comment: 'Cada cuántos seg reporta detenido / ACC off',
  })
  intervaloPosicionDetenidoSegundos: number | null;

  @Column('int', {
    name: 'VelocidadMinimaAlarmasKmh',
    nullable: true,
    comment:
      'Velocidad a partir de la cual se habilitan las alarmas de conducción (ADAS/DSM). Debajo de esto no se evalúan',
  })
  velocidadMinimaAlarmasKmh: number | null;

  @Column('tinyint', { name: 'Canal1Activo', default: () => "'0'" })
  canal1Activo: number;

  @Column('tinyint', { name: 'Canal2Activo', default: () => "'0'" })
  canal2Activo: number;

  @Column('tinyint', { name: 'Canal3Activo', default: () => "'0'" })
  canal3Activo: number;

  @Column('tinyint', { name: 'Canal4Activo', default: () => "'0'" })
  canal4Activo: number;

  @Column('tinyint', { name: 'Canal5Activo', default: () => "'0'" })
  canal5Activo: number;

  @Column('tinyint', { name: 'AlarmaFatiga', default: () => "'0'" })
  alarmaFatiga: number;

  @Column('tinyint', {
    name: 'UmbralFatiga',
    nullable: true,
    comment: 'Nivel 1-10 (DSM). Mayor = más severo',
  })
  umbralFatiga: number | null;

  @Column('tinyint', { name: 'AlarmaTelefono', default: () => "'0'" })
  alarmaTelefono: number;

  @Column('tinyint', { name: 'AlarmaFumar', default: () => "'0'" })
  alarmaFumar: number;

  @Column('tinyint', { name: 'AlarmaDistraccion', default: () => "'0'" })
  alarmaDistraccion: number;

  @Column('tinyint', { name: 'AlarmaConductorAusente', default: () => "'0'" })
  alarmaConductorAusente: number;

  @Column('tinyint', { name: 'AlarmaCinturon', default: () => "'0'" })
  alarmaCinturon: number;

  @Column('tinyint', { name: 'AlarmaObstruccionCamara', default: () => "'0'" })
  alarmaObstruccionCamara: number;

  @Column('tinyint', { name: 'AlarmaColisionFrontal', default: () => "'0'" })
  alarmaColisionFrontal: number;

  @Column('tinyint', { name: 'AlarmaSalidaCarril', default: () => "'0'" })
  alarmaSalidaCarril: number;

  @Column('tinyint', { name: 'AlarmaDistanciaCorta', default: () => "'0'" })
  alarmaDistanciaCorta: number;

  @Column('smallint', {
    name: 'DistanciaCortaSegundos',
    nullable: true,
    comment: 'Umbral de distancia al vehículo de adelante (100 ms)',
  })
  distanciaCortaSegundos: number | null;

  @Column('tinyint', { name: 'AlarmaColisionPeaton', default: () => "'0'" })
  alarmaColisionPeaton: number;

  @Column('tinyint', {
    name: 'AlarmaCambioCarrilFrecuente',
    default: () => "'0'",
  })
  alarmaCambioCarrilFrecuente: number;

  @Column('tinyint', {
    name: 'AlarmaExcesoSenalTransito',
    default: () => "'0'",
  })
  alarmaExcesoSenalTransito: number;

  @Column('tinyint', { name: 'AlarmaObstaculo', default: () => "'0'" })
  alarmaObstaculo: number;

  @Column('tinyint', { name: 'AlarmaFallaAdas', default: () => "'0'" })
  alarmaFallaAdas: number;

  @Column('tinyint', { name: 'AlarmaAceleracionBrusca', default: () => "'0'" })
  alarmaAceleracionBrusca: number;

  @Column('smallint', {
    name: 'UmbralAceleracionG',
    nullable: true,
    comment: 'Umbral aceleración, unidad 1/100 g',
  })
  umbralAceleracionG: number | null;

  @Column('tinyint', { name: 'AlarmaFrenadoBrusco', default: () => "'0'" })
  alarmaFrenadoBrusco: number;

  @Column('smallint', {
    name: 'UmbralFrenadoG',
    nullable: true,
    comment: 'Umbral desaceleración, unidad 1/100 g',
  })
  umbralFrenadoG: number | null;

  @Column('tinyint', { name: 'AlarmaGiroBrusco', default: () => "'0'" })
  alarmaGiroBrusco: number;

  @Column('smallint', {
    name: 'UmbralGiroG',
    nullable: true,
    comment: 'Umbral giro, unidad 1/100 g',
  })
  umbralGiroG: number | null;

  @Column('tinyint', { name: 'AlarmaRalenti', default: () => "'0'" })
  alarmaRalenti: number;

  @Column('tinyint', { name: 'AlarmaApagadoAnormal', default: () => "'0'" })
  alarmaApagadoAnormal: number;

  @Column('tinyint', {
    name: 'AlarmaAproximacionTrasera',
    default: () => "'0'",
  })
  alarmaAproximacionTrasera: number;

  @Column('tinyint', {
    name: 'AlarmaAproximacionTraseraIzq',
    default: () => "'0'",
  })
  alarmaAproximacionTraseraIzq: number;

  @Column('tinyint', {
    name: 'AlarmaAproximacionTraseraDer',
    default: () => "'0'",
  })
  alarmaAproximacionTraseraDer: number;

  @Column('tinyint', { name: 'AlarmaExcesoVelocidad', default: () => "'0'" })
  alarmaExcesoVelocidad: number;

  @Column('int', {
    name: 'VelocidadMaximaKmh',
    nullable: true,
    comment: 'Umbral de exceso de velocidad',
  })
  velocidadMaximaKmh: number | null;

  @Column('tinyint', { name: 'AlarmaFatigaTiempo', default: () => "'0'" })
  alarmaFatigaTiempo: number;

  @Column('tinyint', { name: 'AlarmaColision', default: () => "'0'" })
  alarmaColision: number;

  @Column('smallint', {
    name: 'ColisionAceleracionG',
    nullable: true,
    comment: 'Umbral colisión, unidad 0.1 g',
  })
  colisionAceleracionG: number | null;

  @Column('tinyint', { name: 'AlarmaVolteo', default: () => "'0'" })
  alarmaVolteo: number;

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

  @OneToOne(() => Dispositivos, {
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([
    { name: 'IdCliente', referencedColumnName: 'idCliente' },
    { name: 'IdDispositivo', referencedColumnName: 'id' },
  ])
  idDispositivo2: Dispositivos;
}
