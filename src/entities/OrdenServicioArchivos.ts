import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

/** Foto o firma de la orden en S3 (privada; se lee con URL firmada). */
@applySchema
@Index('UQ_OrdenServicioArchivos_OrdenClave', ['idOrdenServicio', 'clave'], {
  unique: true,
})
@Entity('OrdenServicioArchivos')
export class OrdenServicioArchivos {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', { name: 'IdOrdenServicio' })
  idOrdenServicio: number;

  @Column('varchar', { name: 'Clave', length: 40 })
  clave: string;

  @Column('varchar', { name: 'Ruta', length: 500 })
  ruta: string;

  @Column('datetime', {
    name: 'FechaCreacion',
    default: () => 'CURRENT_TIMESTAMP',
  })
  fechaCreacion: Date;
}
