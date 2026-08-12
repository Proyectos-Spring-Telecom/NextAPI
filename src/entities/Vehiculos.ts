import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { CatMarcas } from './CatMarcas';
import { CatModelos } from './CatModelos';
import { CatTipoCombustible } from './CatTipoCombustible';
import { Productos } from './Productos';

@applySchema
@Index('UQ_Vehiculos_Cliente_Placa', ['idCliente', 'placa'], { unique: true })
@Index('FK_Vehiculos_Marca_idx', ['idMarcaVehiculo'])
@Index('FK_Vehiculos_Modelo_idx', ['idModeloVehiculo'])
@Index('FK_Vehiculos_Combustible_idx', ['idCombustible'])
@Index('FK_Vehiculos_Producto', ['idCliente', 'idProducto'])
@Entity('Vehiculos')
export class Vehiculos {
  @PrimaryColumn('bigint', { name: 'IdProducto' })
  idProducto: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('varchar', { name: 'Placa', length: 10 })
  placa: string;

  @Column('varchar', { name: 'NumeroEconomico', length: 50, nullable: true })
  numeroEconomico: string | null;

  @Column('bigint', { name: 'IdMarcaVehiculo', nullable: true })
  idMarcaVehiculo: number | null;

  @Column('bigint', { name: 'IdModeloVehiculo', nullable: true })
  idModeloVehiculo: number | null;

  @Column('int', { name: 'Anio', nullable: true })
  anio: number | null;

  @Column('varchar', { name: 'Color', length: 30, nullable: true })
  color: string | null;

  @Column('varchar', {
    name: 'NumeroSerie',
    length: 20,
    nullable: true,
    comment: 'VIN',
  })
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

  @Column('varchar', { name: 'PermisoCarga', length: 500, nullable: true })
  permisoCarga: string | null;

  @Column('bigint', { name: 'IdCombustible', nullable: true })
  idCombustible: number | null;

  @Column('float', { name: 'KM', nullable: true })
  km: number | null;

  @Column('float', { name: 'CapacidadLitros', nullable: true })
  capacidadLitros: number | null;

  @ManyToOne(() => CatMarcas, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdMarcaVehiculo', referencedColumnName: 'id' }])
  idMarcaVehiculo2: CatMarcas | null;

  @ManyToOne(() => CatModelos, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdModeloVehiculo', referencedColumnName: 'id' }])
  idModeloVehiculo2: CatModelos | null;

  @ManyToOne(() => CatTipoCombustible, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdCombustible', referencedColumnName: 'id' }])
  idCombustible2: CatTipoCombustible | null;

  @OneToOne(() => Productos, {
    onDelete: 'CASCADE',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([
    { name: 'IdCliente', referencedColumnName: 'idCliente' },
    { name: 'IdProducto', referencedColumnName: 'id' },
  ])
  idProducto2: Productos;
}
