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
import { Geocercas } from './Geocercas';

@applySchema
@Index('UQ_UsuarioGeocerca_Usuario_Geocerca', ['idUsuario', 'idGeocerca'], {
  unique: true,
})
@Index('IX_UsuarioGeocerca_IdUsuario', ['idUsuario'])
@Index('IX_UsuarioGeocerca_IdGeocerca', ['idGeocerca'])
@Entity('UsuariosGeocerca')
export class UsuariosGeocerca {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdUsuario' })
  idUsuario: number;

  @Column('bigint', { name: 'IdGeocerca' })
  idGeocerca: number;

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

  @ManyToOne(() => Usuarios, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdUsuario', referencedColumnName: 'id' }])
  idUsuario2: Usuarios;

  @ManyToOne(() => Geocercas, (g) => g.usuariosGeocerca, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdGeocerca', referencedColumnName: 'id' }])
  idGeocerca2: Geocercas;
}
