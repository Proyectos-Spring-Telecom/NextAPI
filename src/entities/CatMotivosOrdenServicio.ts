import { Column, Entity, PrimaryColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

/**
 * Motivos homologados de no cumplida o cancelación, compartidos por la app,
 * el front y el CRM (DDL: deploy/sql/OrdenesServicioEtapa2.sql).
 */
@applySchema
@Entity('CatMotivosOrdenServicio')
export class CatMotivosOrdenServicio {
  @PrimaryColumn('varchar', { name: 'Clave', length: 40 })
  clave: string;

  @Column('varchar', { name: 'Nombre', length: 120 })
  nombre: string;

  /** `no_cumplida`, `cancelada` o ambos separados por coma. */
  @Column('varchar', { name: 'Resultado', length: 30 })
  resultado: string;

  /** `tecnico`, `operacion`, `crm` separados por coma. */
  @Column('varchar', { name: 'Quien', length: 40 })
  quien: string;

  /** Valor por defecto; operación o el CRM lo pueden cambiar. */
  @Column('tinyint', { name: 'Cobrable', default: () => "'0'" })
  cobrable: number;

  @Column('tinyint', { name: 'Reprogramable', default: () => "'1'" })
  reprogramable: number;

  @Column('tinyint', { name: 'RequiereObservaciones', default: () => "'0'" })
  requiereObservaciones: number;

  @Column('int', { name: 'Orden', default: () => "'0'" })
  orden: number;

  @Column('tinyint', { name: 'Estatus', default: () => "'1'" })
  estatus: number;
}
