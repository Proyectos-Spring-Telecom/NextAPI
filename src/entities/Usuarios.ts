import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Bitacora } from "./Bitacora";
import { Clientes } from "./Clientes";
import { Roles } from "./Roles";
import { applySchema } from "src/common/apply-schema.decorator";

@applySchema
@Index("UQ_Usuarios_IdCliente_UserName", ["userName", "idCliente"], {
  unique: true,
})
@Index("FK_Usuarios_Roles", ["idRol"], {})
@Index("FK_Usuarios_Clientes", ["idCliente"], {})
@Entity("Usuarios")
export class Usuarios {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("varchar", { name: "UserName", length: 100 })
  userName: string;

  @Column("varchar", { name: "PasswordHash", length: 255 })
  passwordHash: string;

  @Column("varchar", { name: "PinHash", nullable: true, length: 255 })
  pinHash: string | null;

  @Column("tinyint", { name: "EmailConfirmado", default: () => "'0'" })
  emailConfirmado: number;

  @Column("varchar", { name: "Nombre", nullable: true, length: 100 })
  nombre: string | null;

  @Column("varchar", { name: "ApellidoPaterno", nullable: true, length: 100 })
  apellidoPaterno: string | null;

  @Column("varchar", { name: "ApellidoMaterno", nullable: true, length: 100 })
  apellidoMaterno: string | null;

  @Column("varchar", { name: "Telefono", nullable: true, length: 14 })
  telefono: string | null;

  @Column("datetime", { name: "UltimoLogin", nullable: true })
  ultimoLogin: string | null;

  @Column("datetime", { name: "ActualizacionPassword", nullable: true })
  actualizacionPassword: string | null;

  @Column("datetime", { name: "ActualizacionPin", nullable: true })
  actualizacionPin: string | null;

  @Column("varchar", { name: "FotoPerfil", nullable: true, length: 500 })
  fotoPerfil: string | null;

  @Column("datetime", {
    name: "FechaCreacion",
    default: () => "CURRENT_TIMESTAMP",
  })
  fechaCreacion: string;

  @Column("datetime", {
    name: "FechaActualizacion",
    default: () => "CURRENT_TIMESTAMP",
  })
  fechaActualizacion: string;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @Column("bigint", { name: "IdRol" })
  idRol: number;

  @Column("bigint", { name: "IdCliente", nullable: true })
  idCliente: number | null;

  @OneToMany(() => Bitacora, (bitacora) => bitacora.idUsuario2)
  bitacoras: Bitacora[];

  @ManyToOne(() => Roles, (roles) => roles.usuarios, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdRol", referencedColumnName: "id" }])
  idRol2: Roles;

  @ManyToOne(() => Clientes, (clientes) => clientes.usuarios, {
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION',
  })
  @JoinColumn([{ name: 'IdCliente', referencedColumnName: 'id' }])
  cliente2: Clientes;


}
