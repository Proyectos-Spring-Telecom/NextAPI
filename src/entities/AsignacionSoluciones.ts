import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { applySchema } from "src/common/apply-schema.decorator";
import { Usuarios } from "./Usuarios";
import { Soluciones } from "./Soluciones";

@applySchema
@Index("UQ_AsigSoluc_IdUsuario_IdSolucion", ["idUsuario", "idSolucion"], {
  unique: true,
})
@Index("IX_AsigSoluc_IdUsua_IdSoluc", ["idUsuario", "idSolucion"])
@Index("IX_AsigSoluc_IdUsua_Estatus", ["idUsuario", "estatus"])
@Index("IX_AsigSoluc_IdSoluc_Estatus", ["idSolucion", "estatus"])
@Index("IX_AsigSoluc_IdUsuario", ["idUsuario"])
@Index("IX_AsigSoluc_IdSolucion", ["idSolucion"])
@Entity("AsignacionSoluciones")
export class AsignacionSoluciones {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdUsuario" })
  idUsuario: number;

  @Column("bigint", { name: "IdSolucion" })
  idSolucion: number;

  @CreateDateColumn({ name: "FechaCreacion" })
  fechaCreacion: Date;

  @UpdateDateColumn({ name: "FechaActualizacion" })
  fechaActualizacion: Date;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @ManyToOne(() => Usuarios, { onDelete: "NO ACTION", onUpdate: "NO ACTION" })
  @JoinColumn([{ name: "IdUsuario", referencedColumnName: "id" }])
  idUsuario2: Usuarios;

  @ManyToOne(() => Soluciones, { onDelete: "NO ACTION", onUpdate: "NO ACTION" })
  @JoinColumn([{ name: "IdSolucion", referencedColumnName: "id" }])
  idSolucion2: Soluciones;
}
