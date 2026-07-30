import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Usuarios } from './Usuarios';

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

  @Column('tinyint', {
    name: 'Estatus',
    default: () => "'1'",
    comment: '1=acceso activo, 0=acceso pausado/revocado',
  })
  estatus: number;

  @ManyToOne(() => Usuarios, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn([{ name: 'IdUsuario', referencedColumnName: 'id' }])
  idUsuario2: Usuarios;
}
