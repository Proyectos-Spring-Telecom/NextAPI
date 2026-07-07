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

  @ManyToOne(() => Operadores, (operador) => operador.licencias, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdOperador', referencedColumnName: 'id' }])
  idOperador2: Operadores;
}
