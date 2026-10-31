import { Column, Entity, PrimaryColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

/** Horas sin transmitir antes de avisar, por tipo de equipo (docs/motor-activos.md §7b). */
@applySchema
@Entity('VigilanciaTransmisionTipo')
export class VigilanciaTransmisionTipo {
  @PrimaryColumn('bigint', { name: 'IdTipoDispositivo' })
  idTipoDispositivo: number;

  @Column('smallint', { name: 'HorasSinTransmitir' })
  horasSinTransmitir: number;
}
