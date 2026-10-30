import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomInt, timingSafeEqual } from 'crypto';
import { DataSource, In, IsNull, MoreThan, MoreThanOrEqual, Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ApiCrudResponse, EstatusEnumBitcora } from 'src/common/ApiResponse';
import { EnumModulos, EnumRoles, EstatusEnum } from 'src/common/estatus.enum';
import { CatMotivosOrdenServicio } from 'src/entities/CatMotivosOrdenServicio';
import { Clientes } from 'src/entities/Clientes';
import { Instalaciones } from 'src/entities/Instalaciones';
import { OrdenesServicio } from 'src/entities/OrdenesServicio';
import { Productos } from 'src/entities/Productos';
import { Usuarios } from 'src/entities/Usuarios';
import { Vehiculos } from 'src/entities/Vehiculos';
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
  ValidarCodigoDto,
} from './dto/flujo-orden-servicio.dto';
import { mapOrden } from './ordenes-servicio.map';
import {
  ACTOR_MOTIVO,
  AUTORIZACION,
  ActorMotivo,
  CODIGO,
  ESTATUS_ORDEN,
  MOTIVO_SIN_AUTORIZACION,
  ORIGEN_ORDEN,
  cambioDeTipoPermitido,
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

/** Programan, reprograman, cancelan y cierran por otro: administración. */
const ROLES_OPERACION = new Set<number>([EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN]);
/** Ven y dictan el código: cualquier operador en turno. */
export const ROLES_CODIGO = [
  EnumRoles.SA,
  EnumRoles.DEV,
  EnumRoles.ADMIN,
  EnumRoles.JEFE_MONITOREO,
  EnumRoles.MONITOREO,
];
/** Deciden la autorización de desinstalar: administración y jefe de monitoreo. */
export const ROLES_AUTORIZAN = [EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN, EnumRoles.JEFE_MONITOREO];

/**
 * Etapa 2 de las órdenes de servicio (docs/ordenes-servicio.md §12): órdenes
 * programadas por el CRM o por operación, inicio en campo, código de
 * verificación, autorización de desinstalación, no cumplida y cancelación con
 * motivo, y la consulta de cambios para el CRM.
 */
@Injectable()
export class OrdenesFlujoService {
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
   * (referenciaCrm, unidad).
   */
  async programar(dto: ProgramarOrdenDto | ProgramarOrdenCrmDto, actor: Actor) {
    const referenciaCrm = actor.tipo === 'crm' ? (dto as ProgramarOrdenCrmDto).referenciaCrm.trim() : null;
    const unidades = dto.unidades ?? 1;
    if (dto.tipo !== 'instalacion' && unidades !== 1) {
      throw new BadRequestException('Un mantenimiento es de un solo vehículo (unidades = 1)');
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

    await this.dataSource.transaction(async (manager) => {
      for (let unidad = 1; unidad <= unidades; unidad += 1) {
        if (referenciaCrm) {
          const previa = await manager.findOne(OrdenesServicio, { where: { referenciaCrm, unidad } });
          if (previa) {
            creadas.push({ id: Number(previa.id), nombre: previa.folio ?? folioDe(Number(previa.id)), unidad, existia: true });
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

    const nuevas = creadas.filter((c) => !c.existia);
    if (nuevas.length) {
      await this.bitacora(
        `Se programaron ${nuevas.length} orden(es) de servicio ${dto.tipo}: ${nuevas.map((c) => c.nombre).join(', ')}`,
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
    await this.ordenesRepo.update({ id: orden.id }, cambios);
    await this.bitacora(`Se reprogramó la orden ${this.folio(orden)}`, 'UPDATE', { id, dto }, actor);
    return this.ok(orden, 'Orden reprogramada');
  }

  // --------------------------------------------------------- campo (técnico)

  /** El técnico inicia en campo una orden programada: confirma o corrige tipo y vehículo. */
  async iniciar(id: number, dto: IniciarOrdenDto, user: UsuarioToken): Promise<ApiCrudResponse> {
    const orden = await this.ordenDelTecnico(id, user);
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
    await this.ordenesRepo.update({ id: orden.id }, cambios);
    await this.bitacora(
      `Se inició la orden ${this.folio(orden)} (${tipo}${tipo !== programado ? `, programada como ${programado}` : ''})`,
      'UPDATE',
      { id, dto },
      { tipo: 'usuario', user },
    );
    return this.ok(orden, 'Orden iniciada');
  }

  // ------------------------------------------------------------------ código

  /** Mantenimientos: el técnico pide el código; lo ve cualquier operador en turno. */
  async solicitarCodigo(id: number, user: UsuarioToken) {
    const orden = await this.ordenDelTecnico(id, user);
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
    const codigo = String(randomInt(0, 10 ** CODIGO.DIGITOS)).padStart(CODIGO.DIGITOS, '0');
    const expira = new Date(nowMexicoCityAsUtcDate().getTime() + CODIGO.VIGENCIA_MIN * 60_000);
    await this.ordenesRepo.update(
      { id: orden.id },
      { codigo, codigoExpira: expira, codigoIntentos: 0, idUsuarioCodigo: null, fechaCodigoVisto: null },
    );
    return { ...this.ok(orden, 'Código generado: el operador en turno lo tiene en su pantalla'), expira };
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
    const orden = await this.ordenesRepo.findOne({ where: { id } });
    if (!orden) throw new NotFoundException('Orden de servicio no encontrada');
    const estado = estadoCodigo(orden, nowMexicoCityAsUtcDate());
    if (orden.estatus !== ESTATUS_ORDEN.BORRADOR || estado !== 'vigente') {
      throw new BadRequestException('La orden no tiene un código vigente');
    }
    await this.ordenesRepo.update(
      { id: orden.id },
      { idUsuarioCodigo: user.userId, fechaCodigoVisto: nowMexicoCityAsUtcDate() },
    );
    const [contexto] = await this.conContexto([orden]);
    return { data: [{ ...contexto, codigo: orden.codigo, expira: orden.codigoExpira }] };
  }

  async validarCodigo(id: number, dto: ValidarCodigoDto, user: UsuarioToken): Promise<ApiCrudResponse> {
    const orden = await this.ordenDelTecnico(id, user);
    this.exigirEstatus(orden, [ESTATUS_ORDEN.BORRADOR], 'validar código de');
    if (orden.fechaCodigoValidado) return this.ok(orden, 'El código ya estaba validado');
    const estado = estadoCodigo(orden, nowMexicoCityAsUtcDate());
    if (estado !== 'vigente') {
      const motivo = { sin_codigo: 'No hay código', vencido: 'El código venció', agotado: 'Se agotaron los intentos' }[estado];
      throw new BadRequestException(`${motivo}: pida otro`);
    }
    const a = Buffer.from(dto.codigo);
    const b = Buffer.from(orden.codigo as string);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      await this.ordenesRepo.update(
        { id: orden.id },
        { codigo: null, codigoExpira: null, fechaCodigoValidado: nowMexicoCityAsUtcDate() },
      );
      await this.bitacora(`Código validado en la orden ${this.folio(orden)}`, 'UPDATE', { id }, { tipo: 'usuario', user });
      return this.ok(orden, 'Código correcto: vehículo confirmado');
    }
    const intentos = Number(orden.codigoIntentos ?? 0) + 1;
    const agotado = intentos >= CODIGO.INTENTOS;
    await this.ordenesRepo.update(
      { id: orden.id },
      agotado ? { codigoIntentos: intentos, codigo: null, codigoExpira: null } : { codigoIntentos: intentos },
    );
    throw new BadRequestException(
      agotado
        ? 'Código incorrecto y se agotaron los intentos: pida otro'
        : `Código incorrecto (quedan ${CODIGO.INTENTOS - intentos} intentos)`,
    );
  }

  // ------------------------------------------------------------ autorización

  /** Alta sobre un vehículo con equipo: el técnico avisa y la orden espera la decisión. */
  async solicitarAutorizacion(id: number, dto: SolicitarAutorizacionDto, user: UsuarioToken): Promise<ApiCrudResponse> {
    const orden = await this.ordenDelTecnico(id, user);
    this.exigirEstatus(orden, [ESTATUS_ORDEN.BORRADOR], 'pedir autorización para');
    if (orden.tipoServicio !== 'instalacion') {
      throw new BadRequestException('La autorización de desinstalar solo aplica a un alta (instalacion)');
    }
    if (orden.autorizacion === AUTORIZACION.PENDIENTE) return this.ok(orden, 'La autorización ya estaba pedida');
    if (orden.autorizacion === AUTORIZACION.AUTORIZADA) return this.ok(orden, 'La desinstalación ya está autorizada');
    await this.ordenesRepo.update(
      { id: orden.id },
      {
        autorizacion: AUTORIZACION.PENDIENTE,
        fechaSolicitudAutorizacion: nowMexicoCityAsUtcDate(),
        observaciones: this.agregarNota(orden.observaciones, 'Equipo existente', dto.observaciones),
      },
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

  /** Operación (front) o CRM deciden. Rechazada → la orden queda no cumplida, cobrable. */
  async decidirAutorizacion(id: number, dto: DecisionAutorizacionDto, actor: Actor): Promise<ApiCrudResponse> {
    const orden = await this.ordenesRepo.findOne({ where: { id } });
    if (!orden) throw new NotFoundException('Orden de servicio no encontrada');
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
      observaciones: this.agregarNota(orden.observaciones, `Autorización ${decision}`, dto.observaciones),
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
    await this.ordenesRepo.update({ id: orden.id }, cambios);
    await this.bitacora(`Desinstalación ${decision} en ${this.folio(orden)}`, 'UPDATE', { id, dto }, actor);
    return this.ok(orden, dto.autorizada ? 'Desinstalación autorizada' : 'Desinstalación rechazada: la orden quedó no cumplida');
  }

  // ------------------------------------------------------ no cumplida / cancelar

  /** El técnico (o operación) cierra sin hacer el trabajo, con motivo. */
  async noCumplida(id: number, dto: MotivoOrdenDto, user: UsuarioToken): Promise<ApiCrudResponse> {
    const operacion = ROLES_OPERACION.has(Number(user.rol));
    const orden = operacion ? await this.ordenExistente(id) : await this.ordenDelTecnico(id, user);
    this.exigirEstatus(orden, [ESTATUS_ORDEN.BORRADOR], 'marcar como no cumplida');
    const actor: ActorMotivo = operacion ? ACTOR_MOTIVO.OPERACION : ACTOR_MOTIVO.TECNICO;
    const cobrable = await this.validarMotivo(dto, ESTATUS_ORDEN.NO_CUMPLIDA, actor, operacion);
    await this.ordenesRepo.update(
      { id: orden.id },
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
    );
    await this.bitacora(`Orden ${this.folio(orden)} no cumplida: ${dto.claveMotivo}`, 'UPDATE', { id, dto }, { tipo: 'usuario', user });
    return this.ok(orden, 'Orden no cumplida');
  }

  /**
   * Cancelar. Programada: operación o el CRM, con motivo. Ya iniciada: solo
   * operación (el CRM recibe 409). Las órdenes de la etapa 1 (sin origen) el
   * técnico las sigue cancelando sin motivo.
   */
  async cancelar(id: number, dto: CancelarOrdenDto, actor: Actor): Promise<ApiCrudResponse> {
    const orden = actor.tipo === 'crm' ? await this.ordenDelActor(id, actor) : await this.ordenDelTecnico(id, actor.user);
    const operacion = actor.tipo === 'usuario' && ROLES_OPERACION.has(Number(actor.user.rol));
    const etapa1 = orden.origen == null && orden.estatus === ESTATUS_ORDEN.BORRADOR;

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
        { claveMotivo: dto.claveMotivo, observaciones: dto.observaciones },
        ESTATUS_ORDEN.CANCELADA,
        actorMotivo,
        false,
      );
      cambios.observaciones = this.agregarNota(orden.observaciones, 'Cancelada', dto.observaciones);
    }
    await this.ordenesRepo.update({ id: orden.id }, cambios);
    await this.bitacora(`Se canceló la orden ${this.folio(orden)}${dto.claveMotivo ? `: ${dto.claveMotivo}` : ''}`, 'UPDATE', { id, dto }, actor);
    return this.ok(orden, 'Orden de servicio cancelada');
  }

  // ------------------------------------------------------------------ CRM

  /** Órdenes creadas o modificadas desde `desde` (inclusive), de cualquier origen. */
  async cambios(dto: CambiosOrdenesDto) {
    const limite = dto.limite ?? 200;
    const desde = dto.desde ? new Date(dto.desde) : new Date(0);
    const rows = await this.ordenesRepo.find({
      where: { fechaActualizacion: MoreThanOrEqual(desde) },
      order: { fechaActualizacion: 'ASC', id: 'ASC' },
      take: limite,
    });
    const ultima = rows[rows.length - 1];
    return {
      data: rows.map((o) => mapOrden(o)),
      hasta: ultima ? ultima.fechaActualizacion : dto.desde ?? null,
      hayMas: rows.length === limite,
    };
  }

  // --------------------------------------------------------------- apoyo

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
    const nombre = (x?: { nombre?: string | null; apellidoPaterno?: string | null; apellidoMaterno?: string | null }) =>
      x ? [x.nombre, x.apellidoPaterno, x.apellidoMaterno].filter(Boolean).join(' ') : null;
    return ordenes.map((o) => {
      const v = vehiculos.find((x) => Number(x.idProducto) === Number(o.idProducto));
      return {
        ...mapOrden(o),
        cliente: nombre(clientes.find((c) => Number(c.id) === Number(o.idCliente))),
        placa: v?.placa ?? null,
        numeroEconomico: v?.numeroEconomico ?? null,
        tecnico: nombre(tecnicos.find((t) => Number(t.id) === Number(o.idTecnico))),
        codigoExpira: o.codigoExpira,
      };
    });
  }

  /** Valida el motivo y devuelve si es cobrable (el override solo para operación/CRM). */
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

  /** Técnico: solo las suyas (404 las ajenas). Administración: todas. */
  private async ordenDelTecnico(id: number, user: UsuarioToken): Promise<OrdenesServicio> {
    const orden = await this.ordenExistente(id);
    if (!ROLES_OPERACION.has(Number(user.rol)) && Number(orden.idTecnico) !== Number(user.userId)) {
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
    const nombre = u ? [u.nombre, u.apellidoPaterno, u.apellidoMaterno].filter(Boolean).join(' ') : null;
    return { idUsuario: actor.user.userId, nombre: nombre?.slice(0, 120) ?? null };
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

  /** El CRM no es usuario de Next: se registra con CRM_ID_USUARIO si está configurado. */
  private async bitacora(mensaje: string, accion: string, datos: Record<string, unknown>, actor: Actor): Promise<void> {
    const idUsuario =
      actor.tipo === 'usuario' ? actor.user.userId : Number(this.config.get<string>('CRM_ID_USUARIO')) || null;
    if (!idUsuario) return;
    await this.bitacoraLogger.logToBitacora(
      'OrdenesServicio',
      mensaje,
      accion,
      datos,
      idUsuario,
      EnumModulos.INSTALACIONES,
      EstatusEnumBitcora.SUCCESS,
    );
  }
}
