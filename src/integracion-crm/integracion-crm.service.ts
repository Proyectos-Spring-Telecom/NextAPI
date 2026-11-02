import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ClientesService } from 'src/clientes/clientes.service';
import { CreateClienteDto } from 'src/clientes/dto/create-cliente.dto';
import { InstalacionesService } from 'src/instalaciones/instalaciones.service';
import { FechaInstalacionCrmDto } from './dto/fecha-instalacion-crm.dto';

/**
 * Lo que el CRM consulta de Next (docs/ordenes-servicio.md §14): antes lo leía
 * directo de la base con un usuario de solo lectura; ahora por API firmada.
 * Las consultas son las mismas que tenía el CRM, para no cambiar sus resultados.
 */
@Injectable()
export class IntegracionCrmService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly clientesService: ClientesService,
    private readonly config: ConfigService,
    private readonly instalacionesService: InstalacionesService,
  ) {}

  /** Usuario de Next con el que actúa el CRM (bitácora y evidencia). */
  private usuarioCrm(para: string): number {
    const idUsuario = Number(this.config.get<string>('CRM_ID_USUARIO'));
    if (!idUsuario) {
      throw new ServiceUnavailableException(`Falta CRM_ID_USUARIO: usuario de Next con el que el CRM ${para}`);
    }
    return idUsuario;
  }

  /** Clientes (sin la cuenta raíz) con sus unidades activas. */
  clientes() {
    return this.dataSource.query(
      `SELECT c.Id AS id,
              TRIM(CONCAT_WS(' ', c.Nombre, c.ApellidoPaterno, c.ApellidoMaterno)) AS nombre,
              c.RFC AS rfc, c.Correo AS correo,
              (SELECT COUNT(*) FROM Instalaciones i WHERE i.IdCliente = c.Id AND i.Estatus = 1 AND i.EstatusInstalacion = 1) AS unidades
         FROM Clientes c
        WHERE c.IdPadre IS NOT NULL AND c.Estatus = 1
        ORDER BY nombre`,
    ).then((filas: Array<Record<string, unknown>>) => filas.map((f) => ({ ...f, id: Number(f.id), unidades: Number(f.unidades) })));
  }

  async cliente(id: number) {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT c.Id AS id, c.TipoPersona AS tipoPersona,
              TRIM(CONCAT_WS(' ', c.Nombre, c.ApellidoPaterno, c.ApellidoMaterno)) AS nombre,
              c.RFC AS rfc, c.Correo AS correo, c.Telefono AS telefono,
              NULLIF(TRIM(CONCAT_WS(', ',
                NULLIF(TRIM(CONCAT_WS(' ', c.Calle, c.NumeroExterior, IF(c.NumeroInterior <> '', CONCAT('int. ', c.NumeroInterior), NULL))), ''),
                NULLIF(c.Colonia, ''), NULLIF(c.Municipio, ''), NULLIF(c.Estado, ''))), '') AS direccion,
              c.CP AS codigoPostal, NULLIF(c.NombreEncargado, '') AS contacto,
              NULLIF(c.CorreoEncargado, '') AS correoContacto, NULLIF(c.TelefonoEncargado, '') AS telefonoContacto
         FROM Clientes c
        WHERE c.Id = ? AND c.IdPadre IS NOT NULL AND c.Estatus = 1`,
      [id],
    );
    if (!filas.length) throw new NotFoundException('Cliente no encontrado en Next');
    return { ...filas[0], id: Number(filas[0].id), tipoPersona: Number(filas[0].tipoPersona) };
  }

  /**
   * Alta del cliente formalizado. Si el RFC ya existe responde 409 con su Id,
   * para que el CRM lo ligue en lugar de duplicarlo.
   */
  async crearCliente(dto: CreateClienteDto) {
    const idUsuario = this.usuarioCrm('da de alta clientes');
    const existente: Array<{ id: string }> = await this.dataSource.query('SELECT Id AS id FROM Clientes WHERE RFC = ? LIMIT 1', [dto.rfc]);
    if (existente.length) {
      throw new ConflictException({ message: `Ya existe un cliente con RFC ${dto.rfc}`, idCliente: Number(existente[0].id) });
    }
    return this.clientesService.createCliente(dto, idUsuario);
  }

  /** Técnicos: usuarios activos con rol 8. */
  tecnicos() {
    return this.dataSource.query(
      `SELECT u.Id AS id,
              TRIM(CONCAT_WS(' ', u.Nombre, u.ApellidoPaterno, u.ApellidoMaterno)) AS nombre,
              NULLIF(u.Telefono, '') AS telefono
         FROM Usuarios u
        WHERE u.IdRol = 8 AND u.Estatus = 1
        ORDER BY nombre`,
    ).then((filas: Array<Record<string, unknown>>) => filas.map((f) => ({ ...f, id: Number(f.id) })));
  }

  /**
   * Unidades activas de los clientes indicados. `ordenFolio`: la orden de
   * servicio (alta o cambio de equipo) que dejó la instalación vigente; con ella,
   * `instalada` es la fecha real y el CRM no la corrige a mano.
   */
  unidades(idsCliente: number[]) {
    if (!idsCliente.length) return Promise.resolve([]);
    return this.dataSource.query(
      `SELECT i.Id AS idInstalacion, i.IdCliente AS idClienteNext,
              p.Nombre AS producto, tp.Nombre AS tipoProducto,
              i.IdProducto AS idProducto, v.Placa AS placa, v.NumeroEconomico AS economico,
              CAST(d.Imei AS CHAR) AS imei, d.NumeroSerie AS serie, td.Nombre AS dispositivo,
              i.Clase AS clase,
              DATE_FORMAT(i.VigenteDesde, '%Y-%m-%d') AS instalada,
              (SELECT o.Folio FROM OrdenesServicio o
                WHERE o.IdInstalacionResultado = i.Id AND o.Estatus = 'cerrada'
                  AND o.TipoServicio IN ('instalacion', 'c_equipo')
                ORDER BY o.FechaCierre DESC LIMIT 1) AS ordenFolio
         FROM Instalaciones i
         LEFT JOIN Productos p ON p.Id = i.IdProducto
         LEFT JOIN CatTipoProducto tp ON tp.Id = p.IdTipoProducto
         LEFT JOIN Vehiculos v ON v.IdProducto = i.IdProducto
         LEFT JOIN Dispositivos d ON d.Id = i.IdDispositivo
         LEFT JOIN CatTipoDispositivo td ON td.Id = d.IdTipoDispositivo
        WHERE i.Estatus = 1 AND i.EstatusInstalacion = 1 AND i.IdCliente IN (?)
        ORDER BY i.VigenteDesde`,
      [idsCliente],
    ).then((filas: Array<Record<string, unknown>>) =>
      filas.map((f) => ({
        ...f,
        idInstalacion: Number(f.idInstalacion),
        idClienteNext: Number(f.idClienteNext),
        idProducto: Number(f.idProducto),
      })),
    );
  }

  /**
   * Una fila por equipo activo de todos los clientes: el vehículo (`idProducto`)
   * y la clase (AVL, TRACKCAM, PANEL, RELOJ). Con esto el CRM cuenta según cada
   * contrato: vehículos distintos o equipos, solo de las clases que cubre.
   */
  resumen() {
    return this.dataSource
      .query(
        `SELECT IdCliente AS idClienteNext, IdProducto AS idProducto, Clase AS clase
           FROM Instalaciones WHERE Estatus = 1 AND EstatusInstalacion = 1`,
      )
      .then((filas: Array<{ idClienteNext: string; idProducto: string; clase: string | null }>) =>
        filas.map((f) => ({
          idClienteNext: Number(f.idClienteNext),
          idProducto: Number(f.idProducto),
          clase: f.clase || 'AVL',
        })),
      );
  }

  /**
   * Fecha real de instalación capturada en el CRM (equipos migrados o dados de
   * alta en Next después de instalarse). Se guarda en Next como `VigenteDesde`
   * con las mismas reglas que la consola: solo hacia atrás, sin traslaparse con
   * otro periodo del equipo o la SIM, y queda en CorreccionesInstalacion con
   * origen `crm`. El mismo día que ya tiene = sin cambio.
   */
  async fechaInstalacion(id: number, dto: FechaInstalacionCrmDto) {
    const idUsuario = this.usuarioCrm('corrige fechas de instalación');
    const filas: Array<{ idCliente: string; estatus: number; dia: string }> = await this.dataSource.query(
      `SELECT IdCliente AS idCliente, Estatus AS estatus, DATE_FORMAT(VigenteDesde, '%Y-%m-%d') AS dia
         FROM Instalaciones WHERE Id = ?`,
      [id],
    );
    const inst = filas[0];
    if (!inst || Number(inst.idCliente) !== dto.idClienteNext) {
      throw new NotFoundException('La instalación no es de ese cliente en Next');
    }
    if (Number(inst.estatus) !== 1) {
      throw new BadRequestException('Solo se corrige la fecha de una instalación activa.');
    }
    if (dto.fecha === inst.dia) {
      return { status: 'success', message: 'La instalación ya tiene esa fecha.', data: { id, vigenteDesde: inst.dia, sinCambio: true } };
    }
    if (dto.fecha > inst.dia) {
      throw new BadRequestException(`La fecha de instalación solo se corrige hacia atrás: en Next es ${inst.dia}.`);
    }
    const quien = dto.usuario?.trim() ? ` (${dto.usuario.trim()})` : '';
    const r = await this.instalacionesService.corregirVigenteDesde(
      id,
      { vigenteDesde: `${dto.fecha} 00:00:00`, motivo: `CRM${quien}: ${dto.motivo.trim()}`.slice(0, 500) },
      idUsuario,
      'crm',
    );
    return { ...r, data: { ...r.data, sinCambio: false } };
  }

  /** Unidades activas por cliente. */
  conteo() {
    return this.dataSource.query(
      'SELECT IdCliente AS id, COUNT(*) AS n FROM Instalaciones WHERE Estatus = 1 AND EstatusInstalacion = 1 GROUP BY IdCliente',
    ).then((filas: Array<{ id: string; n: string }>) => filas.map((f) => ({ id: Number(f.id), n: Number(f.n) })));
  }

  /** SIMs con su instalación vigente, para conciliar el reporte del carrier. `iccid` = Sims.IMEI. */
  sims() {
    return this.dataSource.query(
      `SELECT s.Id AS idSim, s.IMEI AS iccid, s.NumeroTelefono AS telefono,
              i.Id AS idInstalacion, i.EstatusInstalacion AS estatusInstalacion, i.IdCliente AS idCliente,
              TRIM(CONCAT_WS(' ', c.Nombre, c.ApellidoPaterno, c.ApellidoMaterno)) AS cliente,
              CAST(d.Imei AS CHAR) AS imeiEquipo, v.NumeroEconomico AS economico, v.Placa AS placa
         FROM Sims s
         LEFT JOIN Instalaciones i ON i.IdSim = s.Id AND i.Estatus = 1
         LEFT JOIN Clientes c ON c.Id = i.IdCliente
         LEFT JOIN Dispositivos d ON d.Id = i.IdDispositivo
         LEFT JOIN Vehiculos v ON v.IdProducto = i.IdProducto`,
    );
  }

  /**
   * Órdenes de servicio terminadas (una por unidad atendida) con técnico y
   * cliente; `pagables` suma las no cumplidas cobrables (el técnico cobra la visita).
   */
  realizadas(f: { idTecnicos?: number[]; idClientes?: number[]; desde?: string; tipo?: string; pagables?: boolean }) {
    const donde = [
      f.pagables
        ? "(o.Estatus = 'cerrada' OR (o.Estatus = 'no_cumplida' AND o.Cobrable = 1))"
        : "o.Estatus = 'cerrada'",
    ];
    const params: unknown[] = [];
    if (f.idTecnicos) {
      if (!f.idTecnicos.length) return Promise.resolve([]);
      donde.push('o.IdTecnico IN (?)');
      params.push(f.idTecnicos);
    }
    if (f.idClientes) {
      if (!f.idClientes.length) return Promise.resolve([]);
      donde.push('o.IdCliente IN (?)');
      params.push(f.idClientes);
    }
    if (f.desde) {
      donde.push('o.FechaCierre >= ?');
      params.push(f.desde);
    }
    if (f.tipo) {
      donde.push('o.TipoServicio = ?');
      params.push(f.tipo);
    }
    return this.dataSource.query(
      `SELECT o.Id AS id, o.Folio AS folio, o.TipoServicio AS tipo,
              o.IdCliente AS idClienteNext,
              TRIM(CONCAT_WS(' ', c.Nombre, c.ApellidoPaterno, c.ApellidoMaterno)) AS cliente,
              o.IdTecnico AS idTecnico,
              TRIM(CONCAT_WS(' ', u.Nombre, u.ApellidoPaterno, u.ApellidoMaterno)) AS tecnico,
              DATE_FORMAT(o.FechaCierre, '%Y-%m-%d %H:%i:%s') AS fechaCierre,
              o.Estatus AS estatus, o.ClaveMotivo AS motivo, o.ReferenciaCrm AS referenciaCrm
         FROM OrdenesServicio o
         LEFT JOIN Clientes c ON c.Id = o.IdCliente
         LEFT JOIN Usuarios u ON u.Id = o.IdTecnico
        WHERE ${donde.join(' AND ')}
        ORDER BY o.FechaCierre, o.Id`,
      params,
    ).then((filas: Array<Record<string, unknown>>) =>
      filas.map((r) => ({ ...r, id: Number(r.id), idClienteNext: Number(r.idClienteNext), idTecnico: Number(r.idTecnico) })),
    );
  }
}
