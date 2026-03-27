import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { applySchema } from "src/common/apply-schema.decorator";

@applySchema
@Index("UQ_Soluciones_Codigo", ["codigo"], { unique: true })
@Index("IX_Soluciones_Nombre", ["nombre"])
@Index("IX_Soluciones_Codigo_Estatus", ["codigo", "estatus"])
@Entity("Soluciones")
export class Soluciones {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "Codigo", length: 20 })
  codigo: string;

  @Column("varchar", { name: "Nombre", length: 100 })
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
    onUpdate: "CURRENT_TIMESTAMP",
  })
  fechaActualizacion: Date;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;
}
