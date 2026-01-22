import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Modulos } from "./Modulos";
import { Usuarios } from "./Usuarios";
import { applySchema } from "src/common/apply-schema.decorator";

@applySchema
@Index("FK_Bitacora_Usuarios", ["idUsuario"], {})
@Index("FK_Bitacora_Modulos", ["idModulo"], {})
@Entity("Bitacora")
export class Bitacora {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "Modulo", nullable: true, length: 100 })
  modulo: string | null;

  @Column("varchar", { name: "Descripcion", nullable: true, length: 250 })
  descripcion: string | null;

  @Column("varchar", { name: "Accion", nullable: true, length: 45 })
  accion: string | null;

  @Column('json', { name: "Query", nullable: true})
  query: object | null;

  @Column("datetime", {
    name: "FechaCreacion",
    nullable: true,
    default: () => "CURRENT_TIMESTAMP",
  })
  fechaCreacion: Date | null;

  @Column("varchar", { name: "Estatus", nullable: true, length: 20 })
  estatus: string | null;

  @Column("varchar", { name: "Error", nullable: true, length: 1000 })
  error: string | null;

  @Column("bigint", { name: "IdUsuario" })
  idUsuario: number;

  @Column("bigint", { name: "IdModulo" })
  idModulo: number;

  @ManyToOne(() => Modulos, (modulos) => modulos.bitacoras, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdModulo", referencedColumnName: "id" }])
  idModulo2: Modulos;

  @ManyToOne(() => Usuarios, (usuarios) => usuarios.bitacoras, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdUsuario", referencedColumnName: "id" }])
  idUsuario2: Usuarios;
}
