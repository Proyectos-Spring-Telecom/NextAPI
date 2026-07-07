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
import { Usuarios } from './Usuarios';
import { PanelAlarma } from './PanelAlarma';

@applySchema
@Index('UQ_UsuarioPanelAlarma_Usuario_Panel', ['idUsuario', 'idPanelAlarma'], {
  unique: true,
})
@Index('IX_UsuarioPanelAlarma_IdUsuario_Estatus', ['idUsuario', 'estatus'])
@Index('FK_UsuarioPanelAlarma_PanelAlarma', ['idPanelAlarma'])
@Entity('UsuarioPanelAlarma')
export class UsuarioPanelAlarma {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdUsuario' })
  idUsuario: number;

  @Column('bigint', { name: 'IdPanelAlarma' })
  idPanelAlarma: number;

  @CreateDateColumn({ name: 'FechaCreacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'FechaActualizacion' })
  fechaActualizacion: Date;

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;

  @ManyToOne(() => Usuarios, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn([{ name: 'IdUsuario', referencedColumnName: 'id' }])
  idUsuario2: Usuarios;

  @ManyToOne(() => PanelAlarma, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdPanelAlarma', referencedColumnName: 'id' }])
  idPanelAlarma2: PanelAlarma;
}
