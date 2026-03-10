import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { applySchema } from 'src/common/apply-schema.decorator';

@applySchema
@Index('IX_CatTipoAlerta_Estatus', ['estatus'])
@Index('IX_CatTipoAlerta_Severidad', ['severidad'])
@Entity('CatTipoAlerta')
export class CatTipoAlerta {
  @PrimaryGeneratedColumn({ type: 'bigint', name: 'Id' })
  id: number;

  @Column('varchar', { name: 'Nombre', length: 100 })
  nombre: string;

  @Column('varchar', { name: 'Descripcion', length: 255, nullable: true })
  descripcion: string | null;

  @Column('varchar', {
    name: 'Icono',
    length: 100,
    nullable: true,
    comment: 'Nombre o ruta del ícono para la UI',
  })
  icono: string | null;

  @Column('tinyint', {
    name: 'Severidad',
    unsigned: true,
    default: 1,
    comment: '1=Info, 2=Advertencia, 3=Crítica',
  })
  severidad: number;

  @Column('tinyint', { name: 'Estatus', default: 1 })
  estatus: number;
}
