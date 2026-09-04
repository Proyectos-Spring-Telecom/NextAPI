import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Entity('Videos')
export class Videos {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('bigint', {
    name: 'Imei',
    nullable: true,
    transformer: {
      to: (value: string | null) => value,
      from: (value: string | number | null) =>
        value == null || value === '' ? null : String(value),
    },
  })
  imei: string | null;

  /** URL pública */
  @Column('varchar', { name: 'Ruta', length: 500, nullable: true })
  ruta: string | null;

  /** Ruta física en disco (ops; no usar en UI) */
  @Column('varchar', { name: 'RutaServidor', length: 500, nullable: true })
  rutaServidor: string | null;

  @Column('datetime', { name: 'FechaHora', nullable: true })
  fechaHora: Date | null;
}
