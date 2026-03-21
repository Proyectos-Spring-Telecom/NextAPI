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
import { Operadores } from './Operadores';
import { CatTipoLicencia } from './CatTipoLicencia';
import { CatCategoriaLicencia } from './CatCategoriaLicencia';

@applySchema
@Index('UQ_Licencias_IdOperador_IdTipoLicencia', ['idOperador', 'idTipoLicencia'], {
  unique: true,
})
@Index('UQ_Licencias_NumeroLicencia', ['numeroLicencia'], { unique: true })
@Index('IX_Licencias_IdOperador', ['idOperador'])
@Index('IX_Licencias_Estatus', ['estatus'])
@Entity('Licencias')
export class Licencias {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdOperador' })
  idOperador: number;

  @Column('varchar', { name: 'NumeroLicencia', length: 50 })
  numeroLicencia: string;

  @Column('bigint', { name: 'IdTipoLicencia' })
  idTipoLicencia: number;

  @Column('bigint', { name: 'IdCategoriaLicencia' })
  idCategoriaLicencia: number;

  @Column('date', { name: 'FechaExpedicion' })
  fechaExpedicion: Date;

  @Column('date', { name: 'FechaVencimiento' })
  fechaVencimiento: Date;

  @Column('varchar', { name: 'Licencia', length: 500 })
  licencia: string;

  @CreateDateColumn({ name: 'FechaCreacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'FechaActualizacion' })
  fechaActualizacion: Date;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;

  @ManyToOne(() => Operadores, { onDelete: 'RESTRICT', onUpdate: 'CASCADE' })
  @JoinColumn([{ name: 'IdOperador', referencedColumnName: 'id' }])
  idOperador2: Operadores;

  @ManyToOne(() => CatTipoLicencia, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdTipoLicencia', referencedColumnName: 'id' }])
  idTipoLicencia2: CatTipoLicencia;

  @ManyToOne(() => CatCategoriaLicencia, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdCategoriaLicencia', referencedColumnName: 'id' }])
  idCategoriaLicencia2: CatCategoriaLicencia;
}
