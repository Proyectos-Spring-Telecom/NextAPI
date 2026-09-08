import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';
import { Clientes } from './Clientes';
import { Instalaciones } from './Instalaciones';
import { UsuariosGeocerca } from './UsuariosGeocerca';

@applySchema
@Index('IX_Geocercas_IdCliente', ['idCliente'])
@Index('IX_Geocercas_IdInstalacion', ['idInstalacion'])
@Index('IX_Geocercas_Cliente_Estatus', ['idCliente', 'estatus'])
@Index('FK_Geocercas_Instalaciones', ['idCliente', 'idInstalacion'])
@Entity('Geocercas')
export class Geocercas {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdCliente' })
  idCliente: number;

  @Column('bigint', { name: 'IdInstalacion', nullable: true })
  idInstalacion: number | null;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('varchar', {
    name: 'Descripcion',
    length: 500,
    nullable: true,
  })
  descripcion: string | null;

  /** GeoJSON / polígono de la geocerca */
  @Column('json', { name: 'Geocerca' })
  geocerca: Record<string, unknown> | unknown[];

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
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  idCliente2: Clientes;

  @ManyToOne(() => Instalaciones, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn([
    { name: 'IdCliente', referencedColumnName: 'idCliente' },
    { name: 'IdInstalacion', referencedColumnName: 'id' },
  ])
  idInstalacion2: Instalaciones | null;

  @OneToMany(() => UsuariosGeocerca, (ug) => ug.idGeocerca2)
  usuariosGeocerca: UsuariosGeocerca[];
}
