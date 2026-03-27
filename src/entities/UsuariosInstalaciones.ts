import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Usuarios } from './Usuarios';
import { Instalaciones } from './Instalaciones';

@applySchema
@Entity('UsuariosInstalaciones')
export class UsuariosInstalaciones {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @CreateDateColumn({ name: 'FechaCreacion' })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: 'FechaActualizacion' })
  fechaActualizacion: Date;

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;

  @Column('bigint', { name: 'IdUsuario' })
  idUsuario: number;

  @Column('bigint', { name: 'IdInstalacion' })
  idInstalacion: number;

  @ManyToOne(() => Usuarios, { onDelete: 'NO ACTION', onUpdate: 'NO ACTION' })
  @JoinColumn([{ name: 'IdUsuario', referencedColumnName: 'id' }])
  idUsuario2: Usuarios;

  @ManyToOne(() => Instalaciones, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdInstalacion', referencedColumnName: 'id' }])
  idInstalacion2: Instalaciones;
}
