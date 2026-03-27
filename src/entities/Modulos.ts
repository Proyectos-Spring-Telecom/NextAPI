import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Bitacora } from "./Bitacora";
import { Permisos } from "./Permisos";
import { Soluciones } from "./Soluciones";
import { applySchema } from "src/common/apply-schema.decorator";

@applySchema
@Index("UQ_Modulos_Nombre", ["nombre", "idSolucion"], { unique: true })
@Index("FK_Modulos_Soluciones", ["idSolucion"])
@Entity("Modulos")
export class Modulos {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "Nombre", length: 100 })
  nombre: string;

  @Column("varchar", { name: "Descripcion", nullable: true, length: 255 })
  descripcion: string | null;

  @Column("bigint", { name: "IdSolucion", nullable: true })
  idSolucion: number | null;

  @Column("datetime", {
    name: "FechaActualizacion",
    default: () => "CURRENT_TIMESTAMP",
    onUpdate: "CURRENT_TIMESTAMP",
  })
  fechaActualizacion: Date;

  @Column("datetime", {
    name: "FechaCreacion",
    default: () => "CURRENT_TIMESTAMP",
  })
  fechaCreacion: Date;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @ManyToOne(() => Soluciones, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdSolucion", referencedColumnName: "id" }])
  idSolucion2: Soluciones | null;

  @OneToMany(() => Bitacora, (bitacora) => bitacora.idModulo2)
  bitacoras: Bitacora[];

  @OneToMany(() => Permisos, (permisos) => permisos.idModulo2)
  permisos: Permisos[];
}
