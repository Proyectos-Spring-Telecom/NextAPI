import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Operadores } from './Operadores';

@applySchema
@Index('UQ_Licencias_IdOperador_IdTipoLicencia', ['idOperador', 'idTipoLicencia'], {
  unique: true,
})
@Index('UQ_Licencias_NumeroLicencia', ['numeroLicencia'], { unique: true })
@Index('IX_Licencias_IdOperador', ['idOperador'])
@Entity('Licencias')
export class Licencias {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', {
    name: 'IdOperador',
    comment: 'FK → Operadores.Id',
  })
  idOperador: number;

  @Column('varchar', {
    name: 'NumeroLicencia',
    length: 50,
    comment: 'Número oficial de la licencia',
  })
  numeroLicencia: string;

  @Column('bigint', {
    name: 'IdTipoLicencia',
    comment: 'FK → CatTipoLicencia.Id (Tipo A, B, C, D, E, Federal)',
  })
  idTipoLicencia: number;

  @Column('bigint', {
    name: 'IdCategoriaLicencia',
    comment: 'FK → CatCategoriaLicencia.Id (Permanente, Temporal)',
  })
  idCategoriaLicencia: number;

  @Column('date', { name: 'FechaExpedicion' })
  fechaExpedicion: Date;

  @Column('date', { name: 'FechaVencimiento' })
  fechaVencimiento: Date;

  @Column('varchar', {
    name: 'Licencia',
    length: 500,
    comment: 'URL S3 del documento escaneado',
  })
  licencia: string;

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

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;

  @ManyToOne(() => Operadores, (operador) => operador.licencias, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdOperador', referencedColumnName: 'id' }])
  idOperador2: Operadores;
}
