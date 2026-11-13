import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { EstatusEnumBitcora } from 'src/common/ApiResponse';
import { EnumModulos } from 'src/common/estatus.enum';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { nowMexicoCityMysql } from 'src/utils/datetime-mexico.util';
import { generarLlave, llaveCoincide, prefijoDe } from './llaves-api.util';

/** Lo que una llave válida le da a la petición. */
export type LlaveValida = { idLlave: number; idCliente: number; idUsuario: number };

type Usuario = { idClienteToken: number; rol: number; idUsuario: number };

/** Validaciones en memoria: una revocación tarda hasta este tiempo en aplicar. */
const CACHE_MS = 60_000;
/** `UltimoUso` se escribe a lo más una vez por minuto por llave. */
const USO_MS = 60_000;

/**
 * Llaves de API por cliente (docs/fis-fiber, ruta del back §3.6). Solo se
 * guarda el SHA-256; la llave completa se devuelve una vez, al crearla.
 */
@Injectable()
export class LlavesApiService {
  private readonly logger = new Logger(LlavesApiService.name);
  private readonly cache = new Map<
    string,
    { llave: LlaveValida | null; hasta: number }
  >();
  private readonly ultimoUso = new Map<number, number>();

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantFilter: TenantFilterService,
    private readonly bitacora: BitacoraLoggerService,
  ) {}

  /** La llave si es válida, vigente y no revocada; null si no. */
  async validar(llave: string): Promise<LlaveValida | null> {
    const prefijo = prefijoDe(llave);
    if (!prefijo) return null;
    const ahora = Date.now();
    const enCache = this.cache.get(llave);
    if (enCache && enCache.hasta > ahora) return enCache.llave;

    const [fila]: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT Id AS id, IdCliente AS idCliente, IdUsuario AS idUsuario, Hash AS hash
         FROM LlavesApi
        WHERE Prefijo = ? AND Estatus = 1 AND FechaRevocacion IS NULL
          AND (FechaExpiracion IS NULL OR FechaExpiracion > ?)`,
      [prefijo, nowMexicoCityMysql()],
    );
    const valida =
      fila && llaveCoincide(llave, String(fila.hash))
        ? {
            idLlave: Number(fila.id),
            idCliente: Number(fila.idCliente),
            idUsuario: Number(fila.idUsuario),
          }
        : null;
    if (this.cache.size > 1000) this.cache.clear();
    this.cache.set(llave, { llave: valida, hasta: ahora + CACHE_MS });
    if (valida) this.marcarUso(valida.idLlave, ahora);
    return valida;
  }

  async crear(
    dto: { idCliente: number; nombre: string; expiraEn?: string },
    usuario: Usuario,
  ) {
    await this.assertClienteEnAlcance(dto.idCliente, usuario);
    const ahora = nowMexicoCityMysql();
    const expira = dto.expiraEn ? `${dto.expiraEn} 23:59:59` : null;
    if (expira && expira <= ahora)
      throw new BadRequestException('expiraEn debe ser una fecha futura');
    const { llave, prefijo, hash } = generarLlave();
    const r = await this.dataSource.query(
      `INSERT INTO LlavesApi (IdCliente, Nombre, Prefijo, Hash, IdUsuario, FechaCreacion, FechaExpiracion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [dto.idCliente, dto.nombre.trim(), prefijo, hash, usuario.idUsuario, ahora, expira],
    );
    const id = Number(r?.insertId);
    await this.bitacora.logToBitacora(
      'LlavesApi',
      `Llave de API ${prefijo} creada para el cliente ${dto.idCliente} (${dto.nombre.trim()}).`,
      'CREATE',
      {
        id,
        idCliente: dto.idCliente,
        nombre: dto.nombre.trim(),
        prefijo,
        expiraEn: expira,
      },
      usuario.idUsuario,
      EnumModulos.CLIENTES,
      EstatusEnumBitcora.SUCCESS,
    );
    return {
      data: {
        id,
        idCliente: dto.idCliente,
        nombre: dto.nombre.trim(),
        prefijo,
        fechaExpiracion: expira,
        llave,
        aviso: 'Guarda la llave ahora: no se vuelve a mostrar.',
      },
    };
  }

  async listar(idCliente: number | undefined, usuario: Usuario) {
    const scope = await this.tenantFilter.idsClientePermitidos(
      usuario.rol,
      usuario.idClienteToken,
    );
    if (idCliente != null) await this.assertClienteEnAlcance(idCliente, usuario);
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT l.Id AS id, l.IdCliente AS idCliente, l.Nombre AS nombre, l.Prefijo AS prefijo,
              DATE_FORMAT(l.FechaCreacion, '%Y-%m-%d %H:%i:%s') AS fechaCreacion,
              DATE_FORMAT(l.FechaExpiracion, '%Y-%m-%d %H:%i:%s') AS fechaExpiracion,
              DATE_FORMAT(l.UltimoUso, '%Y-%m-%d %H:%i:%s') AS ultimoUso,
              DATE_FORMAT(l.FechaRevocacion, '%Y-%m-%d %H:%i:%s') AS fechaRevocacion,
              l.Estatus AS estatus
         FROM LlavesApi l
        WHERE ${idCliente != null ? 'l.IdCliente = ?' : '1 = 1'}
        ORDER BY l.Id DESC`,
      idCliente != null ? [idCliente] : [],
    );
    const visibles = filas.filter((f) =>
      this.tenantFilter.clienteVisibleEnScope(scope, Number(f.idCliente)),
    );
    return {
      data: visibles.map((f) => ({
        ...f,
        id: Number(f.id),
        idCliente: Number(f.idCliente),
        activa: Number(f.estatus) === 1 && f.fechaRevocacion == null,
      })),
    };
  }

  async revocar(id: number, usuario: Usuario) {
    const [fila]: Array<{ idCliente: number; prefijo: string }> =
      await this.dataSource.query(
        'SELECT IdCliente AS idCliente, Prefijo AS prefijo FROM LlavesApi WHERE Id = ?',
        [id],
      );
    if (!fila) throw new NotFoundException('Llave no encontrada');
    await this.assertClienteEnAlcance(Number(fila.idCliente), usuario);
    await this.dataSource.query(
      'UPDATE LlavesApi SET Estatus = 0, FechaRevocacion = ? WHERE Id = ? AND FechaRevocacion IS NULL',
      [nowMexicoCityMysql(), id],
    );
    this.cache.clear();
    await this.bitacora.logToBitacora(
      'LlavesApi',
      `Llave de API ${fila.prefijo} revocada.`,
      'UPDATE',
      { id, idCliente: Number(fila.idCliente), prefijo: fila.prefijo },
      usuario.idUsuario,
      EnumModulos.CLIENTES,
      EstatusEnumBitcora.SUCCESS,
    );
    return { data: { id, revocada: true } };
  }

  private async assertClienteEnAlcance(
    idCliente: number,
    usuario: Usuario,
  ): Promise<void> {
    const scope = await this.tenantFilter.idsClientePermitidos(
      usuario.rol,
      usuario.idClienteToken,
    );
    if (!this.tenantFilter.clienteVisibleEnScope(scope, idCliente)) {
      throw new ForbiddenException('El cliente no es de tu alcance');
    }
  }

  private marcarUso(idLlave: number, ahora: number): void {
    if ((this.ultimoUso.get(idLlave) ?? 0) + USO_MS > ahora) return;
    this.ultimoUso.set(idLlave, ahora);
    this.dataSource
      .query('UPDATE LlavesApi SET UltimoUso = ? WHERE Id = ?', [
        nowMexicoCityMysql(),
        idLlave,
      ])
      .catch((e) =>
        this.logger.warn(
          `No se pudo marcar el uso de la llave ${idLlave}: ${(e as Error).message}`,
        ),
      );
  }
}
