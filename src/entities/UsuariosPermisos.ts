import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Permisos } from "./Permisos";
import { Soluciones } from "./Soluciones";
import { applySchema } from "src/common/apply-schema.decorator";

@applySchema
@Index("UQ_UsuariosPermisos_IdUsuario_IdPermiso", ["idUsuario", "idPermiso"], {
  unique: true,
})
@Index("FK_UsuariosPermisos_Usuarios", ["idUsuario"], {})
@Index("FK_UsuariosPermisos_Permisos", ["idPermiso"], {})
@Index("IX_UsuariosPermisos_IdUsuario_IdSolucion", [
  "idUsuario",
  "idSolucion",
])
@Entity("UsuariosPermisos")
export class UsuariosPermisos {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

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

  @Column("bigint", { name: "IdUsuario" })
  idUsuario: number;

  @Column("bigint", { name: "IdPermiso" })
  idPermiso: number;

  @Column("bigint", { name: "IdSolucion", nullable: true })
  idSolucion: number | null;

  @ManyToOne(() => Permisos, (permisos) => permisos.usuariosPermisos, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdPermiso", referencedColumnName: "id" }])
  idPermiso2: Permisos;

  @ManyToOne(() => Soluciones, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdSolucion", referencedColumnName: "id" }])
  idSolucion2: Soluciones | null;
}
