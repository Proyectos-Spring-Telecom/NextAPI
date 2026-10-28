import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

/** Opciones de cada sección de la orden de servicio (DDL: deploy/sql/OrdenesServicio.sql). */
@applySchema
@Index('UQ_CatOrdenServicioOpciones_SeccionClave', ['seccion', 'clave'], {
  unique: true,
})
@Entity('CatOrdenServicioOpciones')
export class CatOrdenServicioOpciones {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Seccion', length: 32 })
  seccion: string;

  @Column('varchar', { name: 'Clave', length: 40 })
  clave: string;

  @Column('varchar', { name: 'Nombre', length: 120 })
  nombre: string;

  @Column('tinyint', { name: 'Obligatorio', default: () => "'0'" })
  obligatorio: number;

  @Column('int', { name: 'Orden', default: () => "'0'" })
  orden: number;

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;
}
