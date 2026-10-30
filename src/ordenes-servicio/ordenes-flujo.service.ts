import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt, timingSafeEqual } from 'crypto';
import { Brackets, DataSource, EntityManager, In, IsNull, MoreThan, Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ApiCrudResponse, EstatusEnumBitcora } from 'src/common/ApiResponse';
import { EnumModulos, EnumRoles, EstatusEnum } from 'src/common/estatus.enum';
import { CatMotivosOrdenServicio } from 'src/entities/CatMotivosOrdenServicio';
import { CatOrdenServicioOpciones } from 'src/entities/CatOrdenServicioOpciones';
import { Clientes } from 'src/entities/Clientes';
import { Instalaciones } from 'src/entities/Instalaciones';
import { OrdenesServicio } from 'src/entities/OrdenesServicio';
import { OrdenServicioPruebas } from 'src/entities/OrdenServicioPruebas';
import { OrdenServicioRespuestas } from 'src/entities/OrdenServicioRespuestas';
import { Productos } from 'src/entities/Productos';
import { Usuarios } from 'src/entities/Usuarios';
import { Vehiculos } from 'src/entities/Vehiculos';
import { isDuplicateKeyError } from 'src/messaging/core/db-errors.util';
import {
  isoUtcToMexicoCityAsUtcDate,
  nowMexicoCityAsUtcDate,
} from 'src/utils/datetime-mexico.util';
import {
  CambiosOrdenesDto,
  CancelarOrdenDto,
  DecisionAutorizacionDto,
  IniciarOrdenDto,
  MotivoOrdenDto,
  ProgramarOrdenCrmDto,
  ProgramarOrdenDto,
  ReprogramarOrdenDto,
  SolicitarAutorizacionDto,
  SolicitarPruebaDto,
  ValidarCodigoDto,
  ValidarPruebaDto,
} from './dto/flujo-orden-servicio.dto';
import { esAdmin, esTecnicoAsignado, nombreCompleto, puedeEditar } from './ordenes-servicio.acceso';
import { mapOrden } from './ordenes-servicio.map';
import {
  ACTOR_MOTIVO,
  AUTORIZACION,
  ActorMotivo,
  CODIGO,
  ESTATUS_ORDEN,
  ESTATUS_PRUEBA,
  MOTIVO_SIN_AUTORIZACION,
  ORIGEN_ORDEN,
  cambioDeTipoPermitido,
  esEtapa1,
  esMantenimiento,
  estadoCodigo,
  folioDe,
  motivoPermitido,
} from './ordenes-servicio.reglas';
import type { UsuarioToken } from './ordenes-servicio.service';

/** Quién actúa: un usuario de Next (JWT) o el CRM (HMAC). */
export type Actor =
  | { tipo: 'usuario'; user: UsuarioToken }
  | { tipo: 'crm'; nombre: string | null };

/**
 * Escritura que no debe "cambiar" la orden para el CRM: MySQL no aplica
 * ON UPDATE CURRENT_TIMESTAMP si la columna se asigna a sí misma.
 */
const SIN_TOCAR_FECHA = { fechaActualizacion: () => 'FechaActualizacion' } as const;

/**
 * Etapas 2 y 3 de las órdenes de servicio (docs/ordenes-servicio.md §12–§13):
 * órdenes programadas por el CRM o por operación, inicio en campo, código de
 * verificación, autorización de desinstalar, pruebas con el operador, no
 * cumplida y cancelación con motivo, y la consulta de cambios para el CRM.
 *
 * Cada cambio de estado es condicional (`transicion`): si otra petición se
 * adelantó, responde 409 en lugar de pisarla.
 */
@Injectable()
export class OrdenesFlujoService {
  private readonly logger = new Logger(OrdenesFlujoService.name);

  constructor(
    @InjectRepository(OrdenesServicio)
    private readonly ordenesRepo: Repository<OrdenesServicio>,
    @InjectRepository(CatMotivosOrdenServicio)
    private readonly motivosRepo: Repository<CatMotivosOrdenServicio>,
    @InjectRepository(Clientes)
    private readonly clientesRepo: Repository<Clientes>,
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepo: Repository<Instalaciones>,
    @InjectRepository(Productos)
    private readonly productosRepo: Repository<Productos>,
    @InjectRepository(Usuarios)
    private readonly usuariosRepo: Repository<Usuarios>,
    @InjectRepository(Vehiculos)
    private readonly vehiculosRepo: Repository<Vehiculos>,
    private readonly dataSource: DataSource,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly config: ConfigService,
    @InjectRepository(OrdenServicioPruebas)
    private readonly pruebasRepo: Repository<OrdenServicioPruebas>,
    @InjectRepository(OrdenServicioRespuestas)
    private readonly respuestasRepo: Repository<OrdenServicioRespuestas>,
    @InjectRepository(CatOrdenServicioOpciones)
    private readonly catalogoRepo: Repository<CatOrdenServicioOpciones>,
  ) {}

  // ---------------------------------------------------------------- catálogo

  async motivos() {
    const rows = await this.motivosRepo.find({
      where: { estatus: EstatusEnum.ACTIVO },
      order: { orden: 'ASC' },
    });
    return {
      data: rows.map((m) => ({
        clave: m.clave,
        nombre: m.nombre,
        resultado: m.resultado.split(',').map((r) => r.trim()),
        quien: m.quien.split(',').map((q) => q.trim()),
        cobrable: Number(m.cobrable) === 1,
        reprogramable: Number(m.reprogramable) === 1,
        requiereObservaciones: Number(m.requiereObservaciones) === 1,
      })),
    };
  }

  // ------------------------------------------------------------- programar

  /**
   * Crea las órdenes `programada`. Un alta de N unidades son N órdenes
   * independientes (una por vehículo). Desde el CRM es idempotente por
   * (referenciaCrm, unidad): la misma petición, aunque llegue dos veces a la
   * vez, devuelve las mismas órdenes; la referencia usada para otro cliente o
   * tipo responde 409.
   */
  async programar(dto: ProgramarOrdenDto | ProgramarOrdenCrmDto, actor: Actor) {
    const referenciaCrm = actor.tipo === 'crm' ? (dto as ProgramarOrdenCrmDto).referenciaCrm.trim() : null;
    const unidades = dto.unidades ?? 1;
    if (dto.tipo !== 'instalacion' && unidades !== 1) {
      throw new BadRequestException('Un mantenimiento es de un solo vehículo (unidades = 1)');
    }
    if (referenciaCrm) {
      const previa = await this.previasDeReferencia(referenciaCrm, dto, unidades);
      if (previa) return previa;
    }
    await this.validarClienteActivo(dto.idCliente);
    await this.validarTecnico(dto.idTecnico);

    let idInstalacion: number | null = null;
    let idProducto: number | null = null;
    if (esMantenimiento(dto.tipo)) {
      if (dto.idInstalacion == null) {
        throw new BadRequestException('idInstalacion (el vehículo) es obligatorio en un mantenimiento');
      }
      const inst = await this.instalacionVigente(dto.idInstalacion, dto.idCliente);
      idInstalacion = Number(inst.id);
      idProducto = Number(inst.idProducto);
    } else if (dto.idInstalacion != null) {
      throw new BadRequestException('Un alta (instalacion) no lleva idInstalacion');
    }

    if (dto.idOrdenOrigen != null) {
      const origen = await this.ordenesRepo.findOne({ where: { id: dto.idOrdenOrigen } });
      if (
        !origen ||
        Number(origen.idCliente) !== dto.idCliente ||
        ![ESTATUS_ORDEN.NO_CUMPLIDA, ESTATUS_ORDEN.CANCELADA].includes(origen.estatus as never)
      ) {
        throw new BadRequestException('idOrdenOrigen debe ser una orden no cumplida o cancelada del mismo cliente');
      }
    }

    const cita = isoUtcToMexicoCityAsUtcDate(dto.cita);
    const citaFin = dto.citaFin ? isoUtcToMexicoCityAsUtcDate(dto.citaFin) : null;
    const quien = await this.quien(actor);
    const creadas: Array<{ id: number; nombre: string; unidad: number; existia: boolean }> = [];

    try {
      await this.dataSource.transaction(async (manager) => {
        for (let unidad = 1; unidad <= unidades; unidad += 1) {
          if (referenciaCrm) {
            const previa = await manager.findOne(OrdenesServicio, { where: { referenciaCrm, unidad } });
            if (previa) {
              creadas.push({ id: Number(previa.id), nombre: this.folio(previa), unidad, existia: true });
              continue;
            }
          }
          const saved = await manager.save(
            manager.create(OrdenesServicio, {
              claveApp: null,
              tipoServicio: dto.tipo,
              tipoProgramado: dto.tipo,
              estatus: ESTATUS_ORDEN.PROGRAMADA,
              origen: actor.tipo === 'crm' ? ORIGEN_ORDEN.CRM : ORIGEN_ORDEN.NEXT,
              referenciaCrm,
              unidad: referenciaCrm || unidades > 1 ? unidad : null,
              unidadesTotal: referenciaCrm || unidades > 1 ? unidades : null,
              idOrdenOrigen: dto.idOrdenOrigen ?? null,
              idCliente: dto.idCliente,
              idInstalacion,
              idInstalacionProgramada: idInstalacion,
              idProducto,
              idTecnico: dto.idTecnico,
              cita,
              citaFin,
              observaciones: dto.observaciones ?? null,
              idUsuarioProgramo: quien.idUsuario,
              nombreProgramo: quien.nombre,
              fechaCreacion: nowMexicoCityAsUtcDate(),
            }),
          );
          const folio = folioDe(Number(saved.id));
          await manager.update(OrdenesServicio, { id: saved.id }, { folio });
          creadas.push({ id: Number(saved.id), nombre: folio, unidad, existia: false });
        }
      });
    } catch (error) {
      // La misma programación llegó dos veces a la vez: gana la primera.
      if (referenciaCrm && isDuplicateKeyError(error)) {
        const previa = await this.previasDeReferencia(referenciaCrm, dto, unidades);
        if (previa) return previa;
      }
      throw error;
    }

    const nuevas = creadas.filter((c) => !c.existia);
    if (nuevas.length) {
      const folios =
        nuevas.length <= 10 ? nuevas.map((c) => c.nombre).join(', ') : `${nuevas[0].nombre} a ${nuevas[nuevas.length - 1].nombre}`;
      await this.bitacora(
        `Se programaron ${nuevas.length} orden(es) de servicio ${dto.tipo}: ${folios}`,
        'CREATE',
        { dto, origen: actor.tipo },
        actor,
      );
    }
    return {
      status: 'success',
      message: nuevas.length ? 'Órdenes programadas' : 'Las órdenes ya estaban programadas',
      data: creadas,
    };
  }

  /** Órdenes ya programadas con esa referencia (todas las unidades) o null; 409 si son de otro cliente o tipo. */
  private async previasDeReferencia(referenciaCrm: string, dto: ProgramarOrdenDto, unidades: number) {
    const previas = await this.ordenesRepo.find({ where: { referenciaCrm }, order: { unidad: 'ASC' } });
    if (!previas.length) return null;
    if (previas.some((p) => Number(p.idCliente) !== dto.idCliente || (p.tipoProgramado ?? p.tipoServicio) !== dto.tipo)) {
      throw new ConflictException(`La referencia ${referenciaCrm} ya se usó para otro cliente o tipo de servicio`);
    }
    if (previas.length < unidades) return null;
    return {
      status: 'success',
      message: 'Las órdenes ya estaban programadas',
      data: previas.map((p) => ({ id: Number(p.id), nombre: this.folio(p), unidad: Number(p.unidad ?? 1), existia: true })),
    };
  }

  async reprogramar(id: number, dto: ReprogramarOrdenDto, actor: Actor): Promise<ApiCrudResponse> {
    const orden = await this.ordenDelActor(id, actor);
    this.exigirEstatus(orden, [ESTATUS_ORDEN.PROGRAMADA], 'reprogramar');
    const cambios: Partial<OrdenesServicio> = {};
    if (dto.cita !== undefined) cambios.cita = isoUtcToMexicoCityAsUtcDate(dto.cita);
    if (dto.citaFin !== undefined) {
      cambios.citaFin = dto.citaFin == null ? null : isoUtcToMexicoCityAsUtcDate(dto.citaFin);
    }
    if (dto.idTecnico !== undefined) {
      await this.validarTecnico(dto.idTecnico);
      cambios.idTecnico = dto.idTecnico;
    }
    if (dto.idInstalacion !== undefined) {
      if (!esMantenimiento(orden.tipoServicio)) {
        throw new BadRequestException('Un alta (instalacion) no lleva idInstalacion');
      }
      const inst = await this.instalacionVigente(dto.idInstalacion, Number(orden.idCliente));
      cambios.idInstalacion = Number(inst.id);
      cambios.idInstalacionProgramada = Number(inst.id);
      cambios.idProducto = Number(inst.idProducto);
    }
    if (!Object.keys(cambios).length) {
      throw new BadRequestException('No hay nada que reprogramar');
    }
    await this.transicion(orden, { estatus: [ESTATUS_ORDEN.PROGRAMADA] }, cambios, 'reprogramar');
    await this.bitacora(`Se reprogramó la orden ${this.folio(orden)}`, 'UPDATE', { id, dto }, actor);
    return this.ok(orden, 'Orden reprogramada');
  }

  // --------------------------------------------------------- campo (técnico)

  /** El técnico inicia en campo una orden programada: confirma o corrige tipo y vehículo. */
  async iniciar(id: number, dto: IniciarOrdenDto, user: UsuarioToken): Promise<ApiCrudResponse> {
    const orden = await this.ordenEditable(id, user);
    if (orden.estatus === ESTATUS_ORDEN.BORRADOR && orden.claveApp === dto.claveApp) {
      return this.ok(orden, 'La orden ya estaba iniciada');
    }
    this.exigirEstatus(orden, [ESTATUS_ORDEN.PROGRAMADA], 'iniciar');
    const otra = await this.ordenesRepo.findOne({ where: { claveApp: dto.claveApp } });
    if (otra && Number(otra.id) !== Number(orden.id)) {
      throw new ConflictException('La claveApp ya pertenece a otra orden');
    }

    const programado = orden.tipoProgramado ?? orden.tipoServicio;
    const tipo = dto.tipoServicio ?? programado;
    if (!cambioDeTipoPermitido(programado, tipo)) {
      throw new BadRequestException(
        `No se puede cambiar de ${programado} a ${tipo} en campo: operación debe programar otra orden`,
      );
    }

    const cambios: Partial<OrdenesServicio> = {
      estatus: ESTATUS_ORDEN.BORRADOR,
      claveApp: dto.claveApp,
      tipoServicio: tipo,
      fechaInicio: nowMexicoCityAsUtcDate(),
    };
    if (esMantenimiento(tipo)) {
      if (dto.idProducto !== undefined) {
        throw new BadRequestException('En un mantenimiento el vehículo se indica con idInstalacion');
      }
      const idInstalacion = dto.idInstalacion ?? orden.idInstalacionProgramada;
      if (idInstalacion == null) {
        throw new BadRequestException('Falta el vehículo (idInstalacion)');
      }
      const inst = await this.instalacionVigente(Number(idInstalacion), Number(orden.idCliente));
      cambios.idInstalacion = Number(inst.id);
      cambios.idProducto = Number(inst.idProducto);
    } else {
      if (dto.idInstalacion !== undefined) {
        throw new BadRequestException('Un alta (instalacion) no lleva idInstalacion');
      }
      if (dto.idProducto !== undefined) {
        await this.validarProducto(dto.idProducto, Number(orden.idCliente));
        cambios.idProducto = dto.idProducto;
      }
    }
    try {
      // El técnico asignado es parte de la condición: si operación lo reasignó
      // mientras tanto, la orden ya no es suya.
      await this.transicion(orden, { estatus: [ESTATUS_ORDEN.PROGRAMADA], idTecnico: Number(orden.idTecnico) }, cambios, 'iniciar');
    } catch (error) {
      if (isDuplicateKeyError(error)) throw new ConflictException('La claveApp ya pertenece a otra orden');
      throw error;
    }
    await this.bitacora(
      `Se inició la orden ${this.folio(orden)} (${tipo}${tipo !== programado ? `, programada como ${programado}` : ''})`,
      'UPDATE',
      { id, dto },
      { tipo: 'usuario', user },
    );
    return this.ok(orden, 'Orden iniciada');
  }

  // ------------------------------------------------------------------ código

  /**
   * Mantenimientos: el técnico asignado pide el código; lo ve cualquier
   * operador en turno. Hay un tope de códigos por orden y, si el vigente se
   * pidió hace menos de un minuto, se devuelve el mismo.
   */
  async solicitarCodigo(id: number, user: UsuarioToken) {
    const orden = await this.ordenDelTecnicoAsignado(id, user);
    this.exigirEstatus(orden, [ESTATUS_ORDEN.BORRADOR], 'pedir código para');
    if (!esMantenimiento(orden.tipoServicio)) {
      throw new BadRequestException('El código de verificación solo aplica a mantenimientos');
    }
    if (orden.idInstalacion == null) {
      throw new BadRequestException('Falta el vehículo (idInstalacion)');
    }
    if (orden.fechaCodigoValidado) {
      return { ...this.ok(orden, 'El código ya estaba validado'), expira: null };
    }
    const ahora = nowMexicoCityAsUtcDate();
    const vigente = estadoCodigo(orden, ahora) === 'vigente';
    const reciente = vigente && orden.codigoExpira!.getTime() - ahora.getTime() > (CODIGO.VIGENCIA_MIN - 1) * 60_000;
    if (reciente) {
      return { ...this.ok(orden, 'El código ya está en la pantalla del operador'), expira: orden.codigoExpira };
    }
    const codigo = String(randomInt(0, 10 ** CODIGO.DIGITOS)).padStart(CODIGO.DIGITOS, '0');
    const expira = new Date(ahora.getTime() + CODIGO.VIGENCIA_MIN * 60_000);
    const r = await this.ordenesRepo
      .createQueryBuilder()
      .update(OrdenesServicio)
      .set({
        codigo,
        codigoExpira: expira,
        codigoIntentos: 0,
        codigosEmitidos: () => 'CodigosEmitidos + 1',
        idUsuarioCodigo: null,
        fechaCodigoVisto: null,
        ...SIN_TOCAR_FECHA,
      })
      .where('Id = :id AND Estatus = :b AND CodigosEmitidos < :max AND FechaCodigoValidado IS NULL', {
        id: orden.id,
        b: ESTATUS_ORDEN.BORRADOR,
        max: CODIGO.MAX_EMITIDOS,
      })
      .execute();
    if (!r.affected) {
      throw new ConflictException(
        `Se agotaron los ${CODIGO.MAX_EMITIDOS} códigos de esta orden: operación debe revisar el vehículo con el técnico`,
      );
    }
    return { ...this.ok(orden, 'Código generado: el operador en turno lo tiene en su pantalla'), expira };
  }

  /**
   * Operación reinicia el tope de códigos de una orden (p. ej. el técnico se
   * equivocó de vehículo varias veces y ya se aclaró por teléfono).
   */
  async reiniciarCodigos(id: number, user: UsuarioToken): Promise<ApiCrudResponse> {
    const orden = await this.ordenExistente(id);
    await this.transicion(
      orden,
      { estatus: [ESTATUS_ORDEN.BORRADOR] },
      { codigosEmitidos: 0, codigo: null, codigoExpira: null, codigoIntentos: 0 },
      'reiniciar los códigos',
    );
    await this.bitacora(`Se reiniciaron los códigos de ${this.folio(orden)}`, 'UPDATE', { id }, { tipo: 'usuario', user });
    return this.ok(orden, 'Tope de códigos reiniciado: el técnico puede pedir otro');
  }

  /** Códigos vigentes para que el operador en turno los dicte. No incluye el código. */
  async codigosPendientes() {
    const ahora = nowMexicoCityAsUtcDate();
    const ordenes = await this.ordenesRepo.find({
      where: {
        estatus: ESTATUS_ORDEN.BORRADOR,
        codigoExpira: MoreThan(ahora),
        fechaCodigoValidado: IsNull(),
      },
      order: { codigoExpira: 'ASC' },
    });
    const vigentes = ordenes.filter((o) => estadoCodigo(o, ahora) === 'vigente');
    return { data: await this.conContexto(vigentes) };
  }

  /** El operador abre el código para dictarlo; queda registrado quién lo vio. */
  async verCodigo(id: number, user: UsuarioToken) {
    const orden = await this.ordenExistente(id);
    const estado = estadoCodigo(orden, nowMexicoCityAsUtcDate());
    if (orden.estatus !== ESTATUS_ORDEN.BORRADOR || estado !== 'vigente') {
      throw new BadRequestException('La orden no tiene un código vigente');
    }
    await this.ordenesRepo.update(
      { id: orden.id },
      { idUsuarioCodigo: user.userId, fechaCodigoVisto: nowMexicoCityAsUtcDate(), ...SIN_TOCAR_FECHA },
    );
    const [contexto] = await this.conContexto([orden]);
    return { data: [{ ...contexto, codigo: orden.codigo, expira: orden.codigoExpira }] };
  }

  /**
   * Valida el código dictado. Cada intento se descuenta de forma atómica antes
   * de comparar: intentos simultáneos no pasan del límite.
   */
  async validarCodigo(id: number, dto: ValidarCodigoDto, user: UsuarioToken): Promise<ApiCrudResponse> {
    const orden = await this.ordenDelTecnicoAsignado(id, user);
    this.exigirEstatus(orden, [ESTATUS_ORDEN.BORRADOR], 'validar código de');
    if (orden.fechaCodigoValidado) return this.ok(orden, 'El código ya estaba validado');
    const ahora = nowMexicoCityAsUtcDate();
    const turno = await this.ordenesRepo
      .createQueryBuilder()
      .update(OrdenesServicio)
      .set({ codigoIntentos: () => 'CodigoIntentos + 1', ...SIN_TOCAR_FECHA })
      .where(
        'Id = :id AND Estatus = :b AND Codigo IS NOT NULL AND CodigoIntentos < :max AND CodigoExpira > :ahora AND FechaCodigoValidado IS NULL',
        { id: orden.id, b: ESTATUS_ORDEN.BORRADOR, max: CODIGO.INTENTOS, ahora },
      )
      .execute();
    if (!turno.affected) {
      const actual = await this.ordenExistente(id);
      if (actual.fechaCodigoValidado) return this.ok(orden, 'El código ya estaba validado');
      const estado = estadoCodigo(actual, ahora);
      const motivo = { sin_codigo: 'No hay código', vencido: 'El código venció', agotado: 'Se agotaron los intentos', vigente: 'Se agotaron los intentos' }[estado];
      throw new BadRequestException(`${motivo}: pida otro`);
    }
    const actual = await this.ordenExistente(id);
    const a = Buffer.from(dto.codigo);
    const b = Buffer.from(actual.codigo ?? '');
    if (a.length === b.length && timingSafeEqual(a, b)) {
      const r = await this.ordenesRepo.update(
        { id: orden.id, codigo: actual.codigo! },
        { codigo: null, codigoExpira: null, fechaCodigoValidado: nowMexicoCityAsUtcDate() },
      );
      if (!r.affected) throw new ConflictException('Se emitió otro código mientras tanto: captura el nuevo');
      await this.bitacora(`Código validado en la orden ${this.folio(orden)}`, 'UPDATE', { id }, { tipo: 'usuario', user });
      return this.ok(orden, 'Código correcto: vehículo confirmado');
    }
    const intentos = Number(actual.codigoIntentos ?? 0);
    if (intentos >= CODIGO.INTENTOS) {
      await this.ordenesRepo.update({ id: orden.id }, { codigo: null, codigoExpira: null, ...SIN_TOCAR_FECHA });
      throw new BadRequestException('Código incorrecto y se agotaron los intentos: pida otro');
    }
    throw new BadRequestException(`Código incorrecto (quedan ${CODIGO.INTENTOS - intentos} intentos)`);
  }

  // ------------------------------------------------------------ autorización

  /**
   * Alta sobre un vehículo con equipo: el técnico elige el vehículo y avisa. La
   * autorización queda ligada a ese vehículo; al cerrar solo se da de baja la
   * instalación de ese vehículo.
   */
  async solicitarAutorizacion(id: number, dto: SolicitarAutorizacionDto, user: UsuarioToken): Promise<ApiCrudResponse> {
    const orden = await this.ordenEditable(id, user);
    this.exigirEstatus(orden, [ESTATUS_ORDEN.BORRADOR], 'pedir autorización para');
    if (orden.tipoServicio !== 'instalacion') {
      throw new BadRequestException('La autorización de desinstalar solo aplica a un alta (instalacion)');
    }
    if (orden.idProducto == null) {
      throw new BadRequestException('Primero indica el vehículo (idProducto)');
    }
    const conEquipo = await this.instalacionesRepo.findOne({
      where: { idProducto: Number(orden.idProducto), estatus: EstatusEnum.ACTIVO },
    });
    if (!conEquipo) {
      throw new BadRequestException('Ese vehículo no tiene un equipo registrado en Next: no hace falta autorización');
    }
    if (orden.autorizacion === AUTORIZACION.PENDIENTE) return this.ok(orden, 'La autorización ya estaba pedida');
    if (orden.autorizacion === AUTORIZACION.AUTORIZADA) return this.ok(orden, 'La desinstalación ya está autorizada');
    await this.transicion(
      orden,
      { estatus: [ESTATUS_ORDEN.BORRADOR], autorizacionLibre: true },
      {
        autorizacion: AUTORIZACION.PENDIENTE,
        idProductoAutorizacion: Number(orden.idProducto),
        fechaSolicitudAutorizacion: nowMexicoCityAsUtcDate(),
        observaciones: this.agregarNota(orden.observaciones, 'Equipo existente', dto.observaciones),
      },
      'pedir autorización',
    );
    await this.bitacora(`Se pidió autorizar la desinstalación en ${this.folio(orden)}`, 'UPDATE', { id, dto }, { tipo: 'usuario', user });
    return this.ok(orden, 'Autorización pedida a operación');
  }

  async autorizacionesPendientes() {
    const ordenes = await this.ordenesRepo.find({
      where: { estatus: ESTATUS_ORDEN.BORRADOR, autorizacion: AUTORIZACION.PENDIENTE },
      order: { fechaSolicitudAutorizacion: 'ASC' },
    });
    return { data: await this.conContexto(ordenes) };
  }

  /**
   * Operación (front) o el CRM deciden; solo se aplica una decisión. Rechazada:
   * la orden queda no cumplida y cobrable. El CRM solo decide sobre las suyas.
   */
  async decidirAutorizacion(id: number, dto: DecisionAutorizacionDto, actor: Actor): Promise<ApiCrudResponse> {
    const orden = await this.ordenDelActor(id, actor);
    const decision = dto.autorizada ? AUTORIZACION.AUTORIZADA : AUTORIZACION.RECHAZADA;
    if (orden.autorizacion === decision) return this.ok(orden, `La autorización ya estaba ${decision}`);
    if (orden.estatus !== ESTATUS_ORDEN.BORRADOR || orden.autorizacion !== AUTORIZACION.PENDIENTE) {
      throw new ConflictException(
        `La orden no tiene una autorización pendiente (estatus ${orden.estatus}, autorización ${orden.autorizacion ?? 'ninguna'})`,
      );
    }
    const quien = await this.quien(actor);
    const cambios: Partial<OrdenesServicio> = {
      autorizacion: decision,
      idUsuarioAutorizo: quien.idUsuario,
      nombreAutorizo: quien.nombre,
      fechaAutorizacion: nowMexicoCityAsUtcDate(),
      origenAutorizacion: actor.tipo === 'crm' ? ORIGEN_ORDEN.CRM : ORIGEN_ORDEN.NEXT,
      notasInternas: this.agregarNota(orden.notasInternas, `Autorización ${decision}`, dto.observaciones),
    };
    if (!dto.autorizada) {
      const motivo = await this.motivosRepo.findOne({ where: { clave: MOTIVO_SIN_AUTORIZACION } });
      Object.assign(cambios, {
        estatus: ESTATUS_ORDEN.NO_CUMPLIDA,
        claveMotivo: MOTIVO_SIN_AUTORIZACION,
        cobrable: motivo ? Number(motivo.cobrable) : 1,
        fechaCierre: nowMexicoCityAsUtcDate(),
        idUsuarioCierre: quien.idUsuario,
        codigo: null,
        codigoExpira: null,
      });
    }
    await this.dataSource.transaction(async (m) => {
      await this.transicion(
        orden,
        { estatus: [ESTATUS_ORDEN.BORRADOR], autorizacion: AUTORIZACION.PENDIENTE },
        cambios,
        'decidir la autorización',
        m,
      );
      if (!dto.autorizada) await this.anularPruebas(Number(orden.id), m);
    });
    await this.bitacora(`Desinstalación ${decision} en ${this.folio(orden)}`, 'UPDATE', { id, dto }, actor);
    return this.ok(orden, dto.autorizada ? 'Desinstalación autorizada' : 'Desinstalación rechazada: la orden quedó no cumplida');
  }

  // ---------------------------------------------------------------- pruebas

  /**
   * El técnico pide al operador verificar una prueba (transmisión, pánico) o
   * hacer el paro de motor. Volver a pedirla la reabre (p. ej. tras fallar).
   */
  async solicitarPrueba(id: number, clave: string, dto: SolicitarPruebaDto, user: UsuarioToken): Promise<ApiCrudResponse> {
    const orden = await this.ordenEditable(id, user);
    this.exigirEstatus(orden, [ESTATUS_ORDEN.BORRADOR], 'pedir pruebas de');
    await this.validarClavePrueba(clave);
    await this.pruebasRepo.save(
      this.pruebasRepo.create({
        idOrdenServicio: Number(orden.id),
        clave,
        estatus: ESTATUS_PRUEBA.SOLICITADA,
        fechaSolicitud: nowMexicoCityAsUtcDate(),
        idUsuarioSolicito: user.userId,
        notaTecnico: dto.observaciones?.trim() || null,
        fechaValidacion: null,
        idUsuarioValido: null,
        nombreValido: null,
        notaOperador: null,
      }),
    );
    await this.bitacora(`Prueba ${clave} pedida al operador en ${this.folio(orden)}`, 'UPDATE', { id, clave }, { tipo: 'usuario', user });
    return this.ok(orden, clave === 'paro_motor' ? 'Paro de motor pedido al operador' : 'Prueba pedida al operador');
  }

  /** Pruebas que esperan al operador en turno (de órdenes en curso), la más antigua primero. */
  async pruebasPendientes() {
    const pruebas = await this.pruebasRepo
      .createQueryBuilder('p')
      .where('p.estatus = :s', { s: ESTATUS_PRUEBA.SOLICITADA })
      .andWhere('p.idOrdenServicio IN (SELECT o.Id FROM OrdenesServicio o WHERE o.Estatus = :b)', { b: ESTATUS_ORDEN.BORRADOR })
      .orderBy('p.fechaSolicitud', 'ASC')
      .getMany();
    if (!pruebas.length) return { data: [] };
    const ordenes = await this.ordenesRepo.find({ where: { id: In([...new Set(pruebas.map((p) => Number(p.idOrdenServicio)))]) } });
    const contexto = await this.conContexto(ordenes);
    const nombres = await this.catalogoRepo.find({ where: { seccion: 'pruebas' } });
    return {
      data: pruebas
        .map((p) => {
          const orden = contexto.find((c) => c.id === Number(p.idOrdenServicio));
          if (!orden) return null;
          return {
            ...orden,
            prueba: p.clave,
            nombrePrueba: nombres.find((n) => n.clave === p.clave)?.nombre ?? p.clave,
            fechaSolicitud: p.fechaSolicitud,
            notaTecnico: p.notaTecnico,
          };
        })
        .filter(Boolean),
    };
  }

  /**
   * El operador deja el resultado de una prueba pedida (no de una ya validada);
   * también queda como respuesta de la sección pruebas.
   */
  async validarPrueba(id: number, clave: string, dto: ValidarPruebaDto, user: UsuarioToken): Promise<ApiCrudResponse> {
    const orden = await this.ordenExistente(id);
    this.exigirEstatus(orden, [ESTATUS_ORDEN.BORRADOR], 'validar pruebas de');
    const prueba = await this.pruebasRepo.findOne({ where: { idOrdenServicio: Number(orden.id), clave } });
    if (!prueba) throw new BadRequestException(`El técnico no ha pedido la prueba ${clave}`);
    const quien = await this.quien({ tipo: 'usuario', user });
    const estatus = dto.correcta ? ESTATUS_PRUEBA.CORRECTA : ESTATUS_PRUEBA.FALLIDA;
    await this.dataSource.transaction(async (manager) => {
      const r = await manager.update(
        OrdenServicioPruebas,
        { idOrdenServicio: Number(orden.id), clave, estatus: ESTATUS_PRUEBA.SOLICITADA },
        {
          estatus,
          fechaValidacion: nowMexicoCityAsUtcDate(),
          idUsuarioValido: user.userId,
          nombreValido: quien.nombre,
          notaOperador: dto.observaciones?.trim() || null,
        },
      );
      if (!r.affected) {
        throw new ConflictException(`La prueba ${clave} ya está ${prueba.estatus}: el técnico debe volver a pedirla`);
      }
      await manager.upsert(
        OrdenServicioRespuestas,
        [{ idOrdenServicio: Number(orden.id), seccion: 'pruebas', clave, valor: dto.correcta ? 1 : 0 }],
        ['idOrdenServicio', 'seccion', 'clave'],
      );
    });
    await this.bitacora(`Prueba ${clave} ${estatus} en ${this.folio(orden)}`, 'UPDATE', { id, clave, dto }, { tipo: 'usuario', user });
    return this.ok(orden, `Prueba ${estatus}`);
  }

  private async validarClavePrueba(clave: string): Promise<void> {
    const opcion = await this.catalogoRepo.findOne({ where: { seccion: 'pruebas', clave, estatus: EstatusEnum.ACTIVO } });
    if (!opcion) throw new BadRequestException(`La prueba ${clave} no existe en el catálogo`);
  }

  /** Pruebas pedidas que el operador ya no verá (la orden se cerró sin hacer el trabajo). */
  private async anularPruebas(idOrden: number, m: EntityManager): Promise<void> {
    await m.update(OrdenServicioPruebas, { idOrdenServicio: idOrden, estatus: ESTATUS_PRUEBA.SOLICITADA }, { estatus: ESTATUS_PRUEBA.ANULADA });
  }

  // ------------------------------------------------------ no cumplida / cancelar

  /** El técnico (o operación) cierra sin hacer el trabajo, con motivo. */
  async noCumplida(id: number, dto: MotivoOrdenDto, user: UsuarioToken): Promise<ApiCrudResponse> {
    const operacion = esAdmin(user);
    const orden = await this.ordenEditable(id, user);
    this.exigirEstatus(orden, [ESTATUS_ORDEN.BORRADOR], 'marcar como no cumplida');
    const actor: ActorMotivo = operacion ? ACTOR_MOTIVO.OPERACION : ACTOR_MOTIVO.TECNICO;
    const cobrable = await this.validarMotivo(dto, ESTATUS_ORDEN.NO_CUMPLIDA, actor, operacion);
    await this.dataSource.transaction(async (m) => {
      await this.transicion(
        orden,
        { estatus: [ESTATUS_ORDEN.BORRADOR] },
        {
          estatus: ESTATUS_ORDEN.NO_CUMPLIDA,
          claveMotivo: dto.claveMotivo,
          cobrable,
          observaciones: this.agregarNota(orden.observaciones, 'No cumplida', dto.observaciones),
          fechaCierre: nowMexicoCityAsUtcDate(),
          idUsuarioCierre: user.userId,
          codigo: null,
          codigoExpira: null,
        },
        'marcar como no cumplida',
        m,
      );
      await this.anularPruebas(Number(orden.id), m);
    });
    await this.bitacora(`Orden ${this.folio(orden)} no cumplida: ${dto.claveMotivo}`, 'UPDATE', { id, dto }, { tipo: 'usuario', user });
    return this.ok(orden, 'Orden no cumplida');
  }

  /**
   * Cancelar. Programada: operación o el CRM, con motivo. Ya iniciada: solo
   * operación (el CRM recibe 409). Las órdenes de la etapa 1 (sin origen) el
   * técnico las sigue cancelando sin motivo.
   */
  async cancelar(id: number, dto: CancelarOrdenDto, actor: Actor): Promise<ApiCrudResponse & { data: { claveMotivo: string | null } }> {
    const orden = actor.tipo === 'crm' ? await this.ordenDelActor(id, actor) : await this.ordenEditable(id, actor.user);
    // Idempotente: el CRM reintenta si se perdió la respuesta. Devuelve el motivo
    // con el que quedó (pudo cancelarla operación con otro).
    const respuesta = (message: string, claveMotivo: string | null) => {
      const r = this.ok(orden, message);
      return { ...r, data: { ...r.data!, claveMotivo } };
    };
    if (orden.estatus === ESTATUS_ORDEN.CANCELADA) return respuesta('La orden ya estaba cancelada', orden.claveMotivo ?? null);
    const operacion = actor.tipo === 'usuario' && esAdmin(actor.user);
    const etapa1 = esEtapa1(orden) && orden.estatus === ESTATUS_ORDEN.BORRADOR;

    if (!etapa1) {
      if (orden.estatus === ESTATUS_ORDEN.BORRADOR && !operacion) {
        throw new ConflictException(
          actor.tipo === 'crm'
            ? 'La orden ya fue iniciada por el técnico: solo operación puede cerrarla'
            : 'La orden ya está iniciada: use no cumplida con su motivo',
        );
      }
      this.exigirEstatus(orden, [ESTATUS_ORDEN.PROGRAMADA, ESTATUS_ORDEN.BORRADOR], 'cancelar');
      if (actor.tipo === 'usuario' && !operacion) {
        throw new ForbiddenException('Solo operación o el CRM cancelan una orden programada');
      }
      if (!dto.claveMotivo) throw new BadRequestException('claveMotivo es obligatorio');
    } else {
      this.exigirEstatus(orden, [ESTATUS_ORDEN.BORRADOR], 'cancelar');
    }

    const cambios: Partial<OrdenesServicio> = {
      estatus: ESTATUS_ORDEN.CANCELADA,
      codigo: null,
      codigoExpira: null,
    };
    if (dto.claveMotivo) {
      const actorMotivo: ActorMotivo = actor.tipo === 'crm' ? ACTOR_MOTIVO.CRM : operacion ? ACTOR_MOTIVO.OPERACION : ACTOR_MOTIVO.TECNICO;
      cambios.claveMotivo = dto.claveMotivo;
      cambios.cobrable = await this.validarMotivo(
        { claveMotivo: dto.claveMotivo, observaciones: dto.observaciones, cobrable: dto.cobrable },
        ESTATUS_ORDEN.CANCELADA,
        actorMotivo,
        actor.tipo === 'crm' || operacion,
      );
      cambios.notasInternas = this.agregarNota(orden.notasInternas, 'Cancelada', dto.observaciones);
    }
    // Se cancela solo si sigue como se leyó: si el técnico la cerró o la inició
    // mientras tanto, 409.
    await this.dataSource.transaction(async (m) => {
      await this.transicion(orden, { estatus: [orden.estatus] }, cambios, 'cancelar', m);
      await this.anularPruebas(Number(orden.id), m);
    });
    await this.bitacora(`Se canceló la orden ${this.folio(orden)}${dto.claveMotivo ? `: ${dto.claveMotivo}` : ''}`, 'UPDATE', { id, dto }, actor);
    return respuesta('Orden de servicio cancelada', dto.claveMotivo ?? null);
  }

  // ------------------------------------------------------------------ CRM

  /**
   * Órdenes creadas o modificadas, ordenadas por (fechaActualizacion, id). El
   * cursor es compuesto: `desde` (inclusive) + `despuesDe` (id de la última del
   * mismo instante), así nunca se atasca aunque muchas órdenes compartan el
   * segundo. Pasar el `hasta` y `despuesDe` de la respuesta anterior.
   */
  async cambios(dto: CambiosOrdenesDto) {
    const limite = dto.limite ?? 200;
    const desde = dto.desde ? new Date(dto.desde) : new Date(0);
    const despuesDe = dto.despuesDe ?? 0;
    const rows = await this.ordenesRepo
      .createQueryBuilder('o')
      .where(
        new Brackets((w) =>
          w
            .where('o.fechaActualizacion > :desde', { desde })
            .orWhere('o.fechaActualizacion = :desde AND o.id > :despuesDe', { desde, despuesDe }),
        ),
      )
      .orderBy('o.fechaActualizacion', 'ASC')
      .addOrderBy('o.id', 'ASC')
      .take(limite)
      .getMany();
    const ultima = rows[rows.length - 1];
    return {
      data: rows.map((o) => mapOrden(o)),
      hasta: ultima ? ultima.fechaActualizacion : dto.desde ?? null,
      despuesDe: ultima ? Number(ultima.id) : despuesDe,
      hayMas: rows.length === limite,
    };
  }

  /**
   * Estado actual de las órdenes de una referencia del CRM y sus tandas
   * (`OI-12`, `OI-12-2`…). El CRM lo consulta antes de reagendar, para no
   * decidir con un estado viejo.
   */
  async porReferencia(referencia: string) {
    const rows = await this.ordenesRepo
      .createQueryBuilder('o')
      .where('o.referenciaCrm = :r OR o.referenciaCrm LIKE :p', { r: referencia, p: `${referencia}-%` })
      .orderBy('o.id', 'ASC')
      .getMany();
    return { data: rows.map((o) => mapOrden(o)) };
  }

  // --------------------------------------------------------------- apoyo

  /**
   * Cambio de estado condicional: solo se aplica si la orden sigue como se leyó
   * (estatus, autorización, técnico). Si otra petición se adelantó, 409.
   */
  private async transicion(
    orden: OrdenesServicio,
    condicion: { estatus: string[]; autorizacion?: string; autorizacionLibre?: boolean; idTecnico?: number },
    cambios: Partial<OrdenesServicio>,
    accion: string,
    manager: EntityManager = this.ordenesRepo.manager,
  ): Promise<void> {
    const qb = manager
      .createQueryBuilder()
      .update(OrdenesServicio)
      .set(cambios)
      .where('Id = :id', { id: orden.id })
      .andWhere('Estatus IN (:...estatus)', { estatus: condicion.estatus });
    if (condicion.autorizacion) qb.andWhere('Autorizacion = :aut', { aut: condicion.autorizacion });
    if (condicion.autorizacionLibre) qb.andWhere("(Autorizacion IS NULL OR Autorizacion = 'rechazada')");
    if (condicion.idTecnico != null) qb.andWhere('IdTecnico = :tec', { tec: condicion.idTecnico });
    const r = await qb.execute();
    if (!r.affected) {
      throw new ConflictException(`La orden ${this.folio(orden)} cambió mientras tanto; no se pudo ${accion}. Actualiza y vuelve a intentar`);
    }
  }

  private async conContexto(ordenes: OrdenesServicio[]) {
    if (!ordenes.length) return [];
    const idsCliente = [...new Set(ordenes.map((o) => Number(o.idCliente)))];
    const idsProducto = [...new Set(ordenes.map((o) => o.idProducto).filter((v): v is number => v != null).map(Number))];
    const idsTecnico = [...new Set(ordenes.map((o) => Number(o.idTecnico)))];
    const [clientes, vehiculos, tecnicos] = await Promise.all([
      this.clientesRepo.find({ where: { id: In(idsCliente) } }),
      idsProducto.length ? this.vehiculosRepo.find({ where: { idProducto: In(idsProducto) } }) : Promise.resolve([] as Vehiculos[]),
      this.usuariosRepo.find({ where: { id: In(idsTecnico) } }),
    ]);
    return ordenes.map((o) => {
      const v = vehiculos.find((x) => Number(x.idProducto) === Number(o.idProducto));
      return {
        ...mapOrden(o),
        cliente: nombreCompleto(clientes.find((c) => Number(c.id) === Number(o.idCliente))),
        placa: v?.placa ?? null,
        numeroEconomico: v?.numeroEconomico ?? null,
        tecnico: nombreCompleto(tecnicos.find((t) => Number(t.id) === Number(o.idTecnico))),
        codigoExpira: o.codigoExpira,
      };
    });
  }

  /** Valida el motivo y devuelve si es cobrable (el ajuste solo para operación o el CRM). */
  private async validarMotivo(
    dto: { claveMotivo: string; observaciones?: string; cobrable?: boolean },
    resultado: 'no_cumplida' | 'cancelada',
    actor: ActorMotivo,
    puedeAjustarCobro: boolean,
  ): Promise<number> {
    const motivo = await this.motivosRepo.findOne({ where: { clave: dto.claveMotivo } });
    const error = motivoPermitido(motivo, resultado, actor);
    if (error) throw new BadRequestException(error);
    if (Number(motivo!.requiereObservaciones) === 1 && !dto.observaciones?.trim()) {
      throw new BadRequestException(`El motivo ${dto.claveMotivo} requiere observaciones`);
    }
    if (dto.cobrable !== undefined && !puedeAjustarCobro) {
      throw new ForbiddenException('Solo operación o el CRM ajustan si es cobrable');
    }
    return dto.cobrable !== undefined ? (dto.cobrable ? 1 : 0) : Number(motivo!.cobrable);
  }

  private exigirEstatus(orden: OrdenesServicio, permitidos: string[], accion: string): void {
    if (!permitidos.includes(orden.estatus)) {
      throw new ConflictException(`La orden está ${orden.estatus}; no se puede ${accion}`);
    }
  }

  private async ordenExistente(id: number): Promise<OrdenesServicio> {
    const orden = await this.ordenesRepo.findOne({ where: { id } });
    if (!orden) throw new NotFoundException('Orden de servicio no encontrada');
    return orden;
  }

  /** Editar: administración todas; el técnico solo las suyas (404 las ajenas). */
  private async ordenEditable(id: number, user: UsuarioToken): Promise<OrdenesServicio> {
    const orden = await this.ordenExistente(id);
    if (!puedeEditar(orden, user)) throw new NotFoundException('Orden de servicio no encontrada');
    return orden;
  }

  /**
   * Código de verificación: solo el técnico asignado, ni administración. Si
   * otro pudiera pedirlo y validarlo, el código no confirmaría nada.
   */
  private async ordenDelTecnicoAsignado(id: number, user: UsuarioToken): Promise<OrdenesServicio> {
    const orden = await this.ordenExistente(id);
    if (!esTecnicoAsignado(orden, user) || Number(user.rol) !== EnumRoles.TECNICO) {
      throw new NotFoundException('Orden de servicio no encontrada');
    }
    return orden;
  }

  /** El CRM solo toca las órdenes que programó; operación, cualquiera. */
  private async ordenDelActor(id: number, actor: Actor): Promise<OrdenesServicio> {
    const orden = await this.ordenExistente(id);
    if (actor.tipo === 'crm' && orden.origen !== ORIGEN_ORDEN.CRM) {
      throw new NotFoundException('Orden de servicio no encontrada');
    }
    return orden;
  }

  private async quien(actor: Actor): Promise<{ idUsuario: number | null; nombre: string | null }> {
    if (actor.tipo === 'crm') {
      return { idUsuario: null, nombre: `CRM${actor.nombre ? `: ${actor.nombre}` : ''}`.slice(0, 120) };
    }
    const u = await this.usuariosRepo.findOne({ where: { id: actor.user.userId } });
    return { idUsuario: actor.user.userId, nombre: nombreCompleto(u)?.slice(0, 120) ?? null };
  }

  private async validarClienteActivo(idCliente: number): Promise<void> {
    const cliente = await this.clientesRepo.findOne({ where: { id: idCliente } });
    if (!cliente || Number(cliente.estatus) !== EstatusEnum.ACTIVO) {
      throw new BadRequestException('El cliente no existe o no está activo en Next: debe formalizarse antes de programar');
    }
  }

  private async validarTecnico(idTecnico: number): Promise<void> {
    const u = await this.usuariosRepo.findOne({
      where: { id: idTecnico, idRol: EnumRoles.TECNICO, estatus: EstatusEnum.ACTIVO },
    });
    if (!u) throw new BadRequestException('El técnico no existe, no está activo o no tiene rol 8');
  }

  private async instalacionVigente(idInstalacion: number, idCliente: number): Promise<Instalaciones> {
    const inst = await this.instalacionesRepo.findOne({
      where: { id: idInstalacion, idCliente, estatus: EstatusEnum.ACTIVO },
    });
    if (!inst) throw new BadRequestException('La instalación no existe, no es del cliente o no está vigente');
    return inst;
  }

  private async validarProducto(idProducto: number, idCliente: number): Promise<void> {
    const p = await this.productosRepo.findOne({ where: { id: idProducto, idCliente } });
    if (!p) throw new BadRequestException('El vehículo/activo (idProducto) no existe o no es del cliente');
  }

  private agregarNota(actual: string | null, etiqueta: string, nota?: string): string | null {
    if (!nota?.trim()) return actual;
    return [actual, `${etiqueta}: ${nota.trim()}`].filter(Boolean).join('\n');
  }

  private folio(o: OrdenesServicio): string {
    return o.folio ?? folioDe(Number(o.id));
  }

  private ok(o: OrdenesServicio, message: string): ApiCrudResponse {
    return { status: 'success', message, data: { id: Number(o.id), nombre: this.folio(o) } };
  }

  /**
   * Registro en la bitácora. El CRM no es usuario de Next: se registra con
   * CRM_ID_USUARIO si está configurado. Se llama después de confirmar el
   * cambio, así que un fallo aquí se anota en el log y no tumba la respuesta.
   */
  private async bitacora(mensaje: string, accion: string, datos: Record<string, unknown>, actor: Actor): Promise<void> {
    const idUsuario =
      actor.tipo === 'usuario' ? actor.user.userId : Number(this.config.get<string>('CRM_ID_USUARIO')) || null;
    if (!idUsuario) return;
    try {
      await this.bitacoraLogger.logToBitacora(
        'OrdenesServicio',
        mensaje.slice(0, 250),
        accion,
        datos,
        idUsuario,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.SUCCESS,
      );
    } catch (e) {
      this.logger.error(`Bitácora no registrada (${mensaje.slice(0, 80)}): ${(e as Error).message}`);
    }
  }
}
