import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Modulos } from "./Modulos";
import { Soluciones } from "./Soluciones";
import { UsuariosPermisos } from "./UsuariosPermisos";
import { applySchema } from "src/common/apply-schema.decorator";

@applySchema
@Index("UQ_Permisos_IdModulo_Nombre", ["idModulo", "nombre"], { unique: true })
@Index("FK_Permisos_Modulo", ["idModulo"], {})
@Index("IX_Permisos_IdModulo_Estatus", ["idModulo", "estatus"])
@Index("FK_Permisos_Soluciones", ["idSolucion"])
@Entity("Permisos")
export class Permisos {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "Nombre", length: 100 })
  nombre: string;

  @Column("varchar", { name: "Descripcion", nullable: true, length: 255 })
  descripcion: string | null;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

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

  @Column("bigint", { name: "IdModulo" })
  idModulo: number;

  @Column("bigint", { name: "IdSolucion", nullable: true })
  idSolucion: number | null;

  @ManyToOne(() => Modulos, (modulos) => modulos.permisos, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdModulo", referencedColumnName: "id" }])
  idModulo2: Modulos;

  @ManyToOne(() => Soluciones, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdSolucion", referencedColumnName: "id" }])
  idSolucion2: Soluciones | null;

  @OneToMany(
    () => UsuariosPermisos,
    (usuariosPermisos) => usuariosPermisos.idPermiso2,
  )
  usuariosPermisos: UsuariosPermisos[];
}
