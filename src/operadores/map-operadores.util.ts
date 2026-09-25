import { Licencias } from 'src/entities/Licencias';

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

/** Licencia plana (sin anidar operador). */
export type LicenciaPlana = {
  idLicencia: number;
  numeroLicencia: string;
  idTipoLicencia: number;
  idCategoriaLicencia: number;
  fechaExpedicion: string | null;
  fechaVencimiento: string | null;
  licencia: string;
  estatusLicencia: number;
  fechaCreacionLicencia: string | null;
  fechaActualizacionLicencia: string | null;
};

/**
 * Operador + datos públicos del usuario (sin hashes/tokens) + licencias planas.
 * Sin objetos anidados tipo `usuario: {}` / `idUsuario2: {}`.
 */
export type OperadorPlano = {
  id: number;
  idCliente: number;
  idUsuario: number;
  fechaNacimiento: string | null;
  curp: string;
  nss: string;
  contactoEmergenciaNombre: string;
  contactoEmergenciaTelefono: string;
  identificacion: string;
  foto: string | null;
  comprobanteDomicilio: string | null;
  certificadoMedico: string | null;
  antecedentesNoPenales: string | null;
  estatus: number;
  fechaCreacion: string | null;
  fechaActualizacion: string | null;

  userName: string | null;
  nombreUsuario: string | null;
  apellidoPaternoUsuario: string | null;
  apellidoMaternoUsuario: string | null;
  telefonoUsuario: string | null;
  fotoPerfilUsuario: string | null;
  emailConfirmadoUsuario: number | null;
  idRolUsuario: number | null;
  nivelAccesoUsuario: number | null;
  estatusUsuario: number | null;
  ultimoLoginUsuario: string | null;

  licencias: LicenciaPlana[];
};

function toDateStr(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime())
      ? value.toISOString().slice(0, 10)
      : null;
  }
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}

function toIso(value: unknown): string | null {
  if (value == null) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function mapLicenciaPlana(lic: Licencias | Record<string, unknown>): LicenciaPlana {
  const row = lic as Record<string, unknown>;
  return {
    idLicencia: Number(row.id ?? row.idLicencia),
    numeroLicencia: String(row.numeroLicencia ?? ''),
    idTipoLicencia: Number(row.idTipoLicencia),
    idCategoriaLicencia: Number(row.idCategoriaLicencia),
    fechaExpedicion: toDateStr(row.fechaExpedicion),
    fechaVencimiento: toDateStr(row.fechaVencimiento),
    licencia: String(row.licencia ?? ''),
    estatusLicencia: Number(row.estatus ?? row.estatusLicencia ?? 1),
    fechaCreacionLicencia: toIso(row.fechaCreacion ?? row.fechaCreacionLicencia),
    fechaActualizacionLicencia: toIso(
      row.fechaActualizacion ?? row.fechaActualizacionLicencia,
    ),
  };
}

/**
 * Mapea fila de operador + usuario (select seguro) + colección de licencias.
 * Nunca incluye passwordHash, pinHash ni tokens.
 */
export function mapOperadorPlano(args: {
  operador: Record<string, unknown>;
  usuario?: Record<string, unknown> | null;
  licencias?: Array<Licencias | Record<string, unknown>>;
}): OperadorPlano {
  const o = args.operador;
  const u = args.usuario ?? {};

  return {
    id: Number(o.id),
    idCliente: Number(o.idCliente),
    idUsuario: Number(o.idUsuario),
    fechaNacimiento: toDateStr(o.fechaNacimiento),
    curp: String(o.curp ?? ''),
    nss: String(o.nss ?? ''),
    contactoEmergenciaNombre: String(o.contactoEmergenciaNombre ?? ''),
    contactoEmergenciaTelefono: String(o.contactoEmergenciaTelefono ?? ''),
    identificacion: String(o.identificacion ?? ''),
    foto: str(o.foto),
    comprobanteDomicilio: str(o.comprobanteDomicilio),
    certificadoMedico: str(o.certificadoMedico),
    antecedentesNoPenales: str(o.antecedentesNoPenales),
    estatus: Number(o.estatus ?? 1),
    fechaCreacion: toIso(o.fechaCreacion),
    fechaActualizacion: toIso(o.fechaActualizacion),

    userName: str(u.userName),
    nombreUsuario: str(u.nombre),
    apellidoPaternoUsuario: str(u.apellidoPaterno),
    apellidoMaternoUsuario: str(u.apellidoMaterno),
    telefonoUsuario: str(u.telefono),
    fotoPerfilUsuario: str(u.fotoPerfil),
    emailConfirmadoUsuario: num(u.emailConfirmado),
    idRolUsuario: num(u.idRol),
    nivelAccesoUsuario: num(u.nivelAcceso),
    estatusUsuario: num(u.estatus),
    ultimoLoginUsuario: toIso(u.ultimoLogin),

    licencias: (args.licencias ?? []).map(mapLicenciaPlana),
  };
}
