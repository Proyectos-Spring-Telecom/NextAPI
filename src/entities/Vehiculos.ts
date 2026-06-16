import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Clientes } from './Clientes';
import { CatModeloVehiculo } from './CatModeloVehiculo';
import { CatMarcaVehiculo } from './CatMarcaVehiculo';
import { CatTipoCombustible } from './CatTipoCombustible';

@applySchema
@Index('UQ_Vehiculos_IdCliente_Id', ['idCliente', 'id'], { unique: true })
@Index('UQ_Vehiculos_Placa', ['placa', 'idCliente'], { unique: true })
@Index('FK_Vehiculos_CatModeloVehiculo', ['idModeloVehiculo'])
@Index('FK_Vehiculos_CatTipoCombustible', ['idCombustible'])
@Index('FK_Vehiculos_Placa', ['placa'])
@Index('FK_Vehiculos_CatMarcaVehiculo_idx', ['idMarcaVehiculo'])
@Entity('Vehiculos')
export class Vehiculos {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('varchar', { name: 'Placa', length: 10 })
  placa: string;

  @Column('varchar', { name: 'NumeroEconomico', length: 50 })
  numeroEconomico: string;

  @Column('bigint', { name: 'IdMarcaVehiculo' })
  idMarcaVehiculo: number;

  @Column('bigint', { name: 'IdModeloVehiculo' })
  idModeloVehiculo: number;

  @Column('int', { name: 'Anio' })
  anio: number;

  @Column('varchar', { name: 'Color', length: 30, nullable: true })
  color: string | null;

  @Column('varchar', { name: 'NumeroSerie', length: 20, nullable: true })
  numeroSerie: string | null;

  @Column('varchar', { name: 'Foto', length: 500, nullable: true })
  foto: string | null;

  @Column('varchar', { name: 'FotoFrente', length: 500, nullable: true })
  fotoFrente: string | null;

  @Column('varchar', { name: 'FotoTrasera', length: 500, nullable: true })
  fotoTrasera: string | null;

  @Column('varchar', { name: 'FotoDerecha', length: 500, nullable: true })
  fotoDerecha: string | null;

  @Column('varchar', { name: 'FotoIzquierda', length: 500, nullable: true })
  fotoIzquierda: string | null;

  @Column('varchar', { name: 'FotoExtra', length: 500, nullable: true })
  fotoExtra: string | null;

  @Column('varchar', { name: 'TarjetaCirculacion', length: 500, nullable: true })
  tarjetaCirculacion: string | null;

  @Column('varchar', { name: 'PolizaSeguro', length: 500, nullable: true })
  polizaSeguro: string | null;

  @Column('varchar', { name: 'PermisoConcesion', length: 500, nullable: true })
  permisoConcesion: string | null;

  @Column('varchar', { name: 'InspeccionMecanica', length: 500, nullable: true })
  inspeccionMecanica: string | null;

  @Column('int', { name: 'PasajerosSentados', unsigned: true, nullable: true })
  pasajerosSentados: number | null;

  @Column('int', { name: 'PasajerosParados', unsigned: true, nullable: true })
  pasajerosParados: number | null;

  @Column('bigint', { name: 'IdCombustible', nullable: true })
  idCombustible: number | null;

  @Column('float', { name: 'KM', nullable: true })
  km: number | null;

  @Column('float', { name: 'CapacidadLitros', nullable: true })
  capacidadLitros: number | null;

  @Column('int', { name: 'CantidadAccesos', nullable: true })
  cantidadAccesos: number | null;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;

  @CreateDateColumn({ name: 'FechaCreacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'FechaActualizacion' })
  fechaActualizacion: Date;

  @ManyToOne(() => Clientes, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @ManyToOne(() => CatMarcaVehiculo, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdMarcaVehiculo', referencedColumnName: 'id' }])
  idMarcaVehiculo2: CatMarcaVehiculo;

  @ManyToOne(() => CatModeloVehiculo, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdModeloVehiculo', referencedColumnName: 'id' }])
  idModeloVehiculo2: CatModeloVehiculo;

  @ManyToOne(() => CatTipoCombustible, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdCombustible', referencedColumnName: 'id' }])
  idCombustible2: CatTipoCombustible | null;
}
