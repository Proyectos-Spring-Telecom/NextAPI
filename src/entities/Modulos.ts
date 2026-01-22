import {
  Column,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Bitacora } from "./Bitacora";
import { Permisos } from "./Permisos";
import { applySchema } from "src/common/apply-schema.decorator";

@applySchema
@Index("UQ_Modulos_Nombre", ["nombre"], { unique: true })
@Entity("Modulos")
export class Modulos {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "Nombre", unique: true, length: 100 })
  nombre: string;

  @Column("varchar", { name: "Descripcion", nullable: true, length: 255 })
  descripcion: string | null;

  @Column("datetime", {
    name: "FechaCreacion",
    default: () => "CURRENT_TIMESTAMP",
  })
  fechaCreacion: Date;

  @Column("datetime", {
    name: "FechaActualizacion",
    default: () => "CURRENT_TIMESTAMP",
  })
  fechaActualizacion: Date;

  @Column("tinyint", { name: "Estatus", nullable: true })
  estatus: number | null;

  @OneToMany(() => Bitacora, (bitacora) => bitacora.idModulo2)
  bitacoras: Bitacora[];

  @OneToMany(() => Permisos, (permisos) => permisos.idModulo2)
  permisos: Permisos[];
}
