import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Clientes } from './Clientes';
import { CatMarcas } from './CatMarcas';
import { CatModelos } from './CatModelos';
import { CatTipoDispositivo } from './CatTipoDispositivo';
import { UltimaPosicion } from './UltimaPosicion';

@applySchema
@Index('UQ_Dispositivos_Cliente_Id', ['idCliente', 'id'], { unique: true })
@Index('UQ_Dispositivos_NumeroSerie', ['numeroSerie'], { unique: true })
@Index('UQ_Dispositivos_Imei', ['imei'], { unique: true })
@Index('IX_Dispositivos_Cliente_Tipo', [
  'idCliente',
  'idTipoDispositivo',
  'estatus',
])
@Index('FK_Dispositivos_CatMarcas_idx', ['idMarca'])
@Index('FK_Dispositivos_CatModelos_idx', ['idModelo'])
@Index('FK_Dispositivos_Tipo', ['idTipoDispositivo'])
@Entity('Dispositivos')
export class Dispositivos {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('bigint', { name: 'IdTipoDispositivo' })
  idTipoDispositivo: number;

  @Column('varchar', { name: 'NumeroSerie', length: 100 })
  numeroSerie: string;

  @Column('bigint', {
    name: 'Imei',
    nullable: true,
    comment: 'IMEI del equipo (clave de telemetría); string en app para no perder precisión',
    transformer: {
      to: (value: string | null) => value,
      from: (value: string | number | null) =>
        value == null || value === '' ? null : String(value),
    },
  })
  imei: string | null;

  @Column('varchar', {
    name: 'Eco',
    length: 50,
    nullable: true,
    comment: 'Número económico',
  })
  eco: string | null;

  @Column('bigint', { name: 'IdMarca', nullable: true })
  idMarca: number | null;

  @Column('bigint', { name: 'IdModelo', nullable: true })
  idModelo: number | null;

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

  @ManyToOne(() => Clientes, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @ManyToOne(() => CatMarcas, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdMarca', referencedColumnName: 'id' }])
  idMarca2: CatMarcas | null;

  @ManyToOne(() => CatModelos, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdModelo', referencedColumnName: 'id' }])
  idModelo2: CatModelos | null;

  @ManyToOne(() => CatTipoDispositivo, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdTipoDispositivo', referencedColumnName: 'id' }])
  idTipoDispositivo2: CatTipoDispositivo;

  @OneToOne(() => UltimaPosicion, (up) => up.imei2)
  ultimaPosicion: UltimaPosicion | null;
}
