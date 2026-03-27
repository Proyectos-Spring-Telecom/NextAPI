import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from "typeorm";
import { applySchema } from "src/common/apply-schema.decorator";
import { Usuarios } from "./Usuarios";

@applySchema
@Index("UQ_Clientes_RFC", ["rfc"], { unique: true })
@Index("IX_Clientes_IdPadre", ["idPadre"], {})
@Entity("Clientes")
export class Clientes {
  @PrimaryGeneratedColumn({ type: "bigint", name: "Id" })
  id: number;

  @Column("bigint", { name: "IdPadre", nullable: true })
  idPadre: number | null;

  @Column("varchar", { name: "RFC", unique: true, length: 16 })
  rfc: string;

  @Column("tinyint", { name: "TipoPersona" })
  tipoPersona: number;

  @Column("varchar", { name: "Nombre", nullable: true, length: 100 })
  nombre: string | null;

  @Column("varchar", { name: "ApellidoPaterno", nullable: true, length: 100 })
  apellidoPaterno: string | null;

  @Column("varchar", { name: "ApellidoMaterno", nullable: true, length: 100 })
  apellidoMaterno: string | null;

  @Column("varchar", { name: "Telefono", nullable: true, length: 14 })
  telefono: string | null;

  @Column("varchar", { name: "Correo", nullable: true, length: 100 })
  correo: string | null;

  @Column("varchar", { name: "SitioWeb", nullable: true, length: 100 })
  sitioWeb: string | null;

  @Column("varchar", { name: "Estado", nullable: true, length: 50 })
  estado: string | null;

  @Column("varchar", { name: "Municipio", nullable: true, length: 50 })
  municipio: string | null;

  @Column("varchar", { name: "Colonia", nullable: true, length: 100 })
  colonia: string | null;

  @Column("varchar", { name: "Calle", nullable: true, length: 100 })
  calle: string | null;

  @Column("varchar", { name: "EntreCalles", nullable: true, length: 255 })
  entreCalles: string | null;

  @Column("varchar", { name: "NumeroExterior", nullable: true, length: 20 })
  numeroExterior: string | null;

  @Column("varchar", { name: "NumeroInterior", nullable: true, length: 20 })
  numeroInterior: string | null;

  @Column("varchar", { name: "CP", nullable: true, length: 5 })
  cp: string | null;

  @Column("varchar", { name: "NombreEncargado", nullable: true, length: 255 })
  nombreEncargado: string | null;

  @Column("varchar", { name: "TelefonoEncargado", nullable: true, length: 14 })
  telefonoEncargado: string | null;

  @Column("varchar", { name: "CorreoEncargado", nullable: true, length: 100 })
  correoEncargado: string | null;

  @Column("varchar", {
    name: "ConstanciaSituacionFiscal",
    nullable: true,
    length: 500,
  })
  constanciaSituacionFiscal: string | null;

  @Column("varchar", {
    name: "ComprobanteDomicilio",
    nullable: true,
    length: 500,
  })
  comprobanteDomicilio: string | null;

  @Column("varchar", { name: "ActaConstitutiva", nullable: true, length: 500 })
  actaConstitutiva: string | null;

  @Column("varchar", { name: "Logotipo", nullable: true, length: 500 })
  logotipo: string | null;

  @Column("datetime", {
    name: "FechaCreacion",
    default: () => "CURRENT_TIMESTAMP",
  })
  fechaCreacion: Date;

  @Column("datetime", {
    name: "FechaActualizacion", default: () => "CURRENT_TIMESTAMP", onUpdate: "CURRENT_TIMESTAMP", })
  fechaActualizacion: Date;

  @Column("tinyint", { name: "Estatus", default: () => "'1'" })
  estatus: number;

  @ManyToOne(() => Clientes, (clientes) => clientes.clientes, {
    onDelete: "NO ACTION",
    onUpdate: "NO ACTION",
  })
  @JoinColumn([{ name: "IdPadre", referencedColumnName: "id" }])
  idPadre2: Clientes;

  @OneToMany(() => Clientes, (clientes) => clientes.idPadre2)
  clientes: Clientes[];

  @OneToMany(() => Usuarios, (usuario) => usuario.cliente2)
  usuarios: Usuarios[];

}
