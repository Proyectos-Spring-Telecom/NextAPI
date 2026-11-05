import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import sharp from 'sharp';
import { In, Repository } from 'typeorm';
import { EnumModulos } from 'src/common/estatus.enum';
import { CatMotivosOrdenServicio } from 'src/entities/CatMotivosOrdenServicio';
import { CatOrdenServicioOpciones } from 'src/entities/CatOrdenServicioOpciones';
import { Clientes } from 'src/entities/Clientes';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Instalaciones } from 'src/entities/Instalaciones';
import { OrdenesServicio } from 'src/entities/OrdenesServicio';
import { OrdenServicioArchivos } from 'src/entities/OrdenServicioArchivos';
import { OrdenServicioPruebas } from 'src/entities/OrdenServicioPruebas';
import { OrdenServicioRespuestas } from 'src/entities/OrdenServicioRespuestas';
import { Sims } from 'src/entities/Sims';
import { Usuarios } from 'src/entities/Usuarios';
import { Vehiculos } from 'src/entities/Vehiculos';
import { HistoricoInstalaciones } from 'src/entities/HistoricoInstalaciones';
import { textoDispositivo, textoSim } from './ordenes-servicio.equipos';
import { MailService } from 'src/mail/mail.service';
import { S3Service } from 'src/s3/s3.service';
import { nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import { nombreCompleto, puedeCompartir, puedeVer } from './ordenes-servicio.acceso';
import { dibujarOrden, type Prueba } from './ordenes-servicio-pdf.dibujo';
import { ESTATUS_ORDEN, ESTATUS_PRUEBA, folioDe, pruebaRequerida } from './ordenes-servicio.reglas';
import type { UsuarioToken } from './ordenes-servicio.service';

const NOMBRE_TIPO: Record<string, string> = {
  instalacion: 'Instalación',
  revision: 'Revisión',
  c_sim: 'Cambio de SIM',
  c_equipo: 'Cambio de equipo',
  desinstalacion: 'Desinstalación',
};
const NOMBRE_SECCION: Record<string, string> = {
  vehiculo_cuenta_con: 'Vehículo cuenta con',
  funcionamiento_vehiculo: 'Funcionamiento del vehículo',
  fallas_equipo: 'Fallas del equipo',
};
/** Solo se comparte una orden terminada. */
const ESTATUS_COMPARTIBLES: string[] = [ESTATUS_ORDEN.CERRADA, ESTATUS_ORDEN.NO_CUMPLIDA];
/** Vigencia del enlace del PDF para WhatsApp (máximo de S3 con firma v4). */
const VIGENCIA_ENLACE_S = 7 * 24 * 3600;
/** Notas que el sistema agrega a las observaciones y no son para el cliente. */
const NOTA_INTERNA = /^Autorización (autorizada|rechazada)/;

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Fecha guardada como hora de México en UTC → `mar 27 de oct 2026, 14:43`. */
function fechaLarga(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const x = new Date(d);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${DIAS[x.getUTCDay()]} ${x.getUTCDate()} de ${MESES[x.getUTCMonth()]} ${x.getUTCFullYear()}, ${p(x.getUTCHours())}:${p(x.getUTCMinutes())}`;
}

/** wa.me exige la lada del país: un número de 10 dígitos es de México (52). */
export function telefonoWhatsapp(telefono?: string): string {
  const digitos = (telefono ?? '').replace(/\D/g, '');
  return digitos.length === 10 ? `52${digitos}` : digitos;
}

/** Fecha guardada como hora de México en UTC → `DD/MM/AAAA HH:mm`. */
function fecha(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const x = new Date(d);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(x.getUTCDate())}/${p(x.getUTCMonth() + 1)}/${x.getUTCFullYear()} ${p(x.getUTCHours())}:${p(x.getUTCMinutes())}`;
}

/**
 * PDF de la orden de servicio (§13): datos y fotos del vehículo, checklist,
 * fotos del tablero, equipo, pruebas con quién las validó, observaciones y
 * firmas (dibujo en ordenes-servicio-pdf.dibujo.ts). Se guarda en S3 privado y se comparte por
 * correo (adjunto) o WhatsApp (enlace firmado de 7 días).
 */
@Injectable()
export class OrdenesServicioPdfService {
  private readonly logger = new Logger(OrdenesServicioPdfService.name);

  constructor(
    @InjectRepository(OrdenesServicio) private readonly ordenesRepo: Repository<OrdenesServicio>,
    @InjectRepository(OrdenServicioRespuestas) private readonly respuestasRepo: Repository<OrdenServicioRespuestas>,
    @InjectRepository(OrdenServicioArchivos) private readonly archivosRepo: Repository<OrdenServicioArchivos>,
    @InjectRepository(OrdenServicioPruebas) private readonly pruebasRepo: Repository<OrdenServicioPruebas>,
    @InjectRepository(CatOrdenServicioOpciones) private readonly catalogoRepo: Repository<CatOrdenServicioOpciones>,
    @InjectRepository(CatMotivosOrdenServicio) private readonly motivosRepo: Repository<CatMotivosOrdenServicio>,
    @InjectRepository(Clientes) private readonly clientesRepo: Repository<Clientes>,
    @InjectRepository(Usuarios) private readonly usuariosRepo: Repository<Usuarios>,
    @InjectRepository(Vehiculos) private readonly vehiculosRepo: Repository<Vehiculos>,
    @InjectRepository(Instalaciones) private readonly instalacionesRepo: Repository<Instalaciones>,
    @InjectRepository(Dispositivos) private readonly dispositivosRepo: Repository<Dispositivos>,
    @InjectRepository(Sims) private readonly simsRepo: Repository<Sims>,
    private readonly s3Service: S3Service,
    private readonly mailService: MailService,
  ) {}

  async pdf(id: number, user: UsuarioToken): Promise<{ nombre: string; buffer: Buffer }> {
    const orden = await this.ordenVisible(id, user);
    return { nombre: `${this.folio(orden)}.pdf`, buffer: await this.generar(orden) };
  }

  /** Sube (o reutiliza) el PDF y devuelve un enlace de 7 días y el de WhatsApp. */
  async compartir(id: number, telefono: string | undefined, user: UsuarioToken) {
    const orden = await this.ordenCompartible(id, user);
    this.exigirTerminada(orden);
    const ruta = await this.rutaVigente(orden, user);
    const key = new URL(ruta).pathname.replace(/^\//, '');
    const url = await this.s3Service.getPresignedUrl(key, VIGENCIA_ENLACE_S);
    const texto = `Orden de servicio ${this.folio(orden)} (${NOMBRE_TIPO[orden.tipoServicio] ?? orden.tipoServicio}): ${url}`;
    const destino = telefonoWhatsapp(telefono);
    return {
      data: [
        {
          id: Number(orden.id),
          folio: this.folio(orden),
          url,
          vigenciaHoras: VIGENCIA_ENLACE_S / 3600,
          whatsapp: `https://wa.me/${destino}?text=${encodeURIComponent(texto)}`,
        },
      ],
    };
  }

  async enviarCorreo(id: number, correos: string[], user: UsuarioToken) {
    const orden = await this.ordenCompartible(id, user);
    this.exigirTerminada(orden);
    const buffer = await this.generar(orden);
    const folio = this.folio(orden);
    const tipo = NOMBRE_TIPO[orden.tipoServicio] ?? orden.tipoServicio;
    await this.mailService.enviar({
      para: correos,
      asunto: `Orden de servicio ${folio} — ${tipo}`,
      html:
        `<p>Le compartimos la orden de servicio <b>${folio}</b> (${tipo}).</p>` +
        `<p>El detalle va en el PDF adjunto.</p><p>Spring Telecom</p>`,
      adjuntos: [{ filename: `${folio}.pdf`, content: buffer, contentType: 'application/pdf' }],
    });
    return { status: 'success', message: `Orden enviada a ${correos.join(', ')}`, data: { id: Number(orden.id), nombre: folio } };
  }

  /**
   * Genera el PDF con los datos de este momento y lo sube como archivo nuevo:
   * no se borra el anterior para no romper enlaces que ya se compartieron.
   */
  private async rutaVigente(orden: OrdenesServicio, user: UsuarioToken): Promise<string> {
    const buffer = await this.generar(orden);
    const { url } = await this.s3Service.uploadFile(
      {
        buffer,
        mimetype: 'application/pdf',
        size: buffer.length,
        originalname: `${this.folio(orden)}.pdf`,
      } as Express.Multer.File,
      'ordenes-servicio/pdf',
      user.userId,
      EnumModulos.INSTALACIONES,
    );
    // No "cambia" la orden para el CRM: FechaActualizacion se asigna a sí misma.
    await this.ordenesRepo.update(
      { id: orden.id },
      { rutaPdf: url, fechaPdf: nowMexicoCityAsUtcDate(), fechaActualizacion: () => 'FechaActualizacion' },
    );
    return url;
  }

  private exigirTerminada(orden: OrdenesServicio): void {
    if (!ESTATUS_COMPARTIBLES.includes(orden.estatus)) {
      throw new BadRequestException(`La orden está ${orden.estatus}: solo se comparte cerrada o no cumplida`);
    }
  }

  private async ordenVisible(id: number, user: UsuarioToken): Promise<OrdenesServicio> {
    const orden = await this.ordenesRepo.findOne({ where: { id } });
    if (!orden || !puedeVer(orden, user)) {
      throw new NotFoundException('Orden de servicio no encontrada');
    }
    return orden;
  }

  /** Mandarla al cliente: el técnico que la hizo o administración (monitoreo solo la ve). */
  private async ordenCompartible(id: number, user: UsuarioToken): Promise<OrdenesServicio> {
    const orden = await this.ordenVisible(id, user);
    if (!puedeCompartir(orden, user)) {
      throw new ForbiddenException('Solo el técnico de la orden o administración la envían al cliente');
    }
    return orden;
  }

  async generar(orden: OrdenesServicio): Promise<Buffer> {
    const idOrden = Number(orden.id);
    const [respuestas, archivos, pruebas, catalogo, cliente, personas] = await Promise.all([
      this.respuestasRepo.find({ where: { idOrdenServicio: idOrden } }),
      this.archivosRepo.find({ where: { idOrdenServicio: idOrden } }),
      this.pruebasRepo.find({ where: { idOrdenServicio: idOrden } }),
      this.catalogoRepo.find(),
      this.clientesRepo.findOne({ where: { id: orden.idCliente } }),
      this.usuariosRepo.find({
        where: { id: In([orden.idTecnico, orden.idMonitorista].filter((v) => v != null).map(Number)) },
      }),
    ]);
    const vehiculo = orden.idProducto
      ? await this.vehiculosRepo.findOne({
          where: { idProducto: orden.idProducto },
          relations: { idMarcaVehiculo2: true, idModeloVehiculo2: true, idCombustible2: true },
        })
      : null;
    // Si un cambio posterior archivó la instalación, su versión en el histórico.
    const instalacion = async (id: number | null | undefined) =>
      id
        ? ((await this.instalacionesRepo.findOne({ where: { id } })) ??
          (await this.instalacionesRepo.manager.findOne(HistoricoInstalaciones, { where: { idInstalacionOriginal: id }, order: { id: 'DESC' } })))
        : null;
    // Antes del servicio (la que se cambió o retiró) y después (la que quedó).
    const [antes, despues] = await Promise.all([
      instalacion(orden.idInstalacion),
      instalacion(orden.idInstalacionResultado ?? orden.idInstalacion),
    ]);
    const dispositivo = (id: number | null | undefined) =>
      id ? this.dispositivosRepo.findOne({ where: { id }, relations: { idMarca2: true, idModelo2: true, idTipoDispositivo2: true } }) : null;
    const sim = (id: number | null | undefined) => (id ? this.simsRepo.findOne({ where: { id }, relations: { idTelefonia2: true } }) : null);
    const [equipo, equipoAntes, chip, chipAntes, motivo] = await Promise.all([
      dispositivo(orden.idDispositivoNuevo ?? despues?.idDispositivo),
      dispositivo(antes?.idDispositivo),
      sim(orden.idSimNuevo ?? despues?.idSim),
      sim(antes?.idSim),
      orden.claveMotivo ? this.motivosRepo.findOne({ where: { clave: orden.claveMotivo } }) : null,
    ]);

    const nombre = (x?: Parameters<typeof nombreCompleto>[0]) => nombreCompleto(x) ?? '—';
    const usuario = (idU: number | null) => personas.find((u) => Number(u.id) === Number(idU));
    const tipo = NOMBRE_TIPO[orden.tipoServicio] ?? orden.tipoServicio;
    const opciones = (seccion: string) => catalogo.filter((o) => o.seccion === seccion).sort((a, b) => a.orden - b.orden);
    const respuesta = (seccion: string, clave: string) => respuestas.find((r) => r.seccion === seccion && r.clave === clave);

    // Fotos: las del vehículo vienen de su ficha; las de la orden, de sus archivos.
    const archivo = (clave: string) => archivos.find((a) => a.clave === clave)?.ruta ?? null;
    const fotoOrden = (clave: string) => catalogo.find((o) => o.seccion === 'fotos' && o.clave === clave)?.nombre ?? clave;
    const v = vehiculo;
    const pendientes = {
      principal: v?.foto,
      vehiculo: [
        ['Fotografía frontal', v?.fotoFrente],
        ['Fotografía trasera', v?.fotoTrasera],
        ['Lateral derecha', v?.fotoDerecha],
        ['Lateral izquierda', v?.fotoIzquierda],
        ['Fotografía extra', v?.fotoExtra],
      ],
      documentos: [
        ['Tarjeta de circulación', v?.tarjetaCirculacion],
        ['Póliza de seguro', v?.polizaSeguro],
        ['Permiso de carga', v?.permisoCarga],
      ],
      tablero: ['tablero_inicio', 'tablero_final'].map((c) => [fotoOrden(c), archivo(c)]),
      fallas: ['falla_extra_1', 'falla_extra_2', 'falla_extra_3'].map((c) => [fotoOrden(c), archivo(c)]),
      servicio: archivo('equipo_existente') ? [[fotoOrden('equipo_existente'), archivo('equipo_existente')]] : [],
      firmas: { cliente: archivo('firma_cliente'), tecnico: archivo('firma_tecnico') },
    };
    const fotos = (lista: Array<Array<string | null | undefined>>) =>
      Promise.all(lista.map(async ([n, ruta]) => ({ nombre: n ?? '', imagen: await this.imagen(ruta) })));
    const [principal, fotosVehiculo, documentos, fotosTablero, fotosFallas, fotosServicio, firmaCliente, firmaTecnico] =
      await Promise.all([
        this.imagen(pendientes.principal),
        fotos(pendientes.vehiculo),
        fotos(pendientes.documentos),
        fotos(pendientes.tablero),
        fotos(pendientes.fallas),
        fotos(pendientes.servicio),
        this.imagen(pendientes.firmas.cliente, true),
        this.imagen(pendientes.firmas.tecnico, true),
      ]);

    const casillas = (['vehiculo_cuenta_con', 'funcionamiento_vehiculo', 'fallas_equipo'] as const).map((seccion) => {
      const ops = opciones(seccion).map((o) => ({ nombre: o.nombre, marcada: Number(respuesta(seccion, o.clave)?.valor) === 1 }));
      const marcadas = ops.filter((o) => o.marcada).length;
      return {
        titulo: seccion === 'fallas_equipo' ? 'Fallas encontradas del equipo' : NOMBRE_SECCION[seccion],
        resumen: seccion === 'fallas_equipo' ? (marcadas ? `${marcadas} encontradas` : 'Ninguna') : `${marcadas} de ${ops.length}`,
        opciones: ops,
      };
    });

    const pruebasPdf: Prueba[] = opciones('pruebas').map((o) => {
      if (!pruebaRequerida(o.clave, respuestas)) return { nombre: o.nombre, resultado: 'no_aplica', detalle: 'El vehículo no tiene inmovilizador' };
      const p = pruebas.find((x) => x.clave === o.clave);
      const validada = p?.fechaValidacion ? `Validó ${p.nombreValido ?? '—'} · ${fecha(p.fechaValidacion)}` : undefined;
      if (p?.estatus === ESTATUS_PRUEBA.CORRECTA) return { nombre: o.nombre, resultado: 'correcta', detalle: validada };
      if (p?.estatus === ESTATUS_PRUEBA.FALLIDA) return { nombre: o.nombre, resultado: 'fallida', detalle: validada };
      if (p?.estatus === ESTATUS_PRUEBA.SOLICITADA) return { nombre: o.nombre, resultado: 'pendiente' };
      if (p?.estatus === ESTATUS_PRUEBA.ANULADA) return { nombre: o.nombre, resultado: 'no_realizada' };
      // Sin prueba coordinada (etapa 1 o desinstalación): lo que contestó el técnico.
      return { nombre: o.nombre, resultado: Number(respuesta('pruebas', o.clave)?.valor) === 1 ? 'correcta' : 'no_realizada' };
    });

    // Los mismos textos que el detalle de la orden (ordenes-servicio.equipos.ts).
    const nombreEquipo = (x: Awaited<ReturnType<typeof dispositivo>>) => textoDispositivo(x) ?? '—';
    const nombreSim = (x: Awaited<ReturnType<typeof sim>>) => textoSim(x) ?? '—';
    const filas: Array<[string, string]> = [['Tipo de equipo', equipo?.idTipoDispositivo2?.nombre ?? equipoAntes?.idTipoDispositivo2?.nombre ?? '—']];
    if (orden.tipoServicio === 'c_equipo') filas.push(['Equipo anterior', nombreEquipo(equipoAntes)], ['Equipo nuevo', nombreEquipo(equipo)]);
    else if (orden.tipoServicio === 'desinstalacion') filas.push(['Equipo retirado', nombreEquipo(equipoAntes ?? equipo)]);
    else filas.push(['Dispositivo', nombreEquipo(equipo)]);
    if (orden.tipoServicio === 'c_sim') filas.push(['SIM anterior', nombreSim(chipAntes)], ['SIM nueva', nombreSim(chip)]);
    else filas.push(['SIM', nombreSim(orden.tipoServicio === 'desinstalacion' ? (chipAntes ?? chip) : chip)]);
    const avisos: string[] = [];
    if (orden.tipoProgramado && orden.tipoProgramado !== orden.tipoServicio) {
      avisos.push(`Se programó como ${NOMBRE_TIPO[orden.tipoProgramado] ?? orden.tipoProgramado} y en campo se hizo ${tipo}.`);
    }
    if (orden.autorizacion === 'autorizada') avisos.push(`El equipo existente se retiró con autorización del ${fecha(orden.fechaAutorizacion)}.`);
    if (orden.claveMotivo) avisos.push(`Motivo: ${motivo?.nombre ?? orden.claveMotivo}.`);
    if (orden.fechaCodigoValidado) avisos.push(`Vehículo confirmado con código el ${fecha(orden.fechaCodigoValidado)}.`);

    const tecnico = usuario(orden.idTecnico);
    const nombreCliente = nombre(cliente);
    return dibujarOrden({
      folio: this.folio(orden),
      estatus: orden.estatus,
      generado: fechaLarga(nowMexicoCityAsUtcDate()),
      encabezado: {
        tecnico: nombre(tecnico),
        correoTecnico: tecnico?.userName ?? null,
        cliente: nombreCliente,
        fecha: fechaLarga(orden.fechaInicio ?? orden.fechaCaptura ?? orden.cita),
        cierre: orden.fechaCierre ? fechaLarga(orden.fechaCierre) : null,
        ubicacion: orden.lat != null && orden.lng != null ? `${Number(orden.lat).toFixed(5)}, ${Number(orden.lng).toFixed(5)}` : '—',
        monitorista: orden.idMonitorista ? nombre(usuario(orden.idMonitorista)) : '—',
        tipos: [tipo],
      },
      vehiculo: [
        ['Cliente', nombreCliente],
        ['Placa', v?.placa ?? '—'],
        ['Núm. económico', v?.numeroEconomico ?? '—'],
        ['Marca', v?.idMarcaVehiculo2?.nombre ?? '—'],
        ['Modelo', v?.idModeloVehiculo2?.nombre ?? '—'],
        ['Año', v?.anio ? String(v.anio) : '—'],
        ['Color', v?.color ?? '—'],
        ['Combustible', v?.idCombustible2?.nombre ?? '—'],
        ['Kilometraje', v?.km != null ? `${Number(v.km).toLocaleString('es-MX')} km` : '—'],
        ['Capacidad', v?.capacidadLitros != null ? `${Number(v.capacidadLitros).toLocaleString('es-MX')} L` : '—'],
        ['N.º de serie (VIN)', v?.numeroSerie ?? '—'],
      ],
      imagenPrincipal: principal,
      fotosVehiculo,
      documentos,
      casillas,
      fotosTablero,
      fotosFallas,
      totalFallas: pendientes.fallas.length,
      servicio: { titulo: tipo, filas, avisos, fotos: fotosServicio },
      pruebas: pruebasPdf,
      observaciones: (orden.observaciones ?? '')
        .split('\n')
        .filter((l) => l.trim() && !NOTA_INTERNA.test(l))
        .join('\n'),
      firmas: [
        { nombre: nombreCliente, rol: 'Firma del cliente', imagen: firmaCliente },
        { nombre: nombre(tecnico), rol: 'Firma del técnico', imagen: firmaTecnico },
      ],
    });
  }

  /**
   * Descarga y reduce una imagen para el PDF (las fotos del teléfono pesan
   * megas): JPEG de 1000 px, o PNG para las firmas (fondo transparente).
   */
  private async imagen(ruta: string | null | undefined, firma = false): Promise<Buffer | null> {
    if (!ruta) return null;
    const original = await this.descargar(ruta);
    if (!original) return null;
    try {
      const img = sharp(original).rotate().resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true });
      return await (firma ? img.png() : img.jpeg({ quality: 72 })).toBuffer();
    } catch (e) {
      this.logger.warn(`Imagen no legible ${ruta}: ${(e as Error).message}`);
      return null;
    }
  }

  private async descargar(ruta: string): Promise<Buffer | null> {
    try {
      const key = new URL(ruta).pathname.replace(/^\//, '');
      const r = await fetch(await this.s3Service.getPresignedUrl(key, 60), { signal: AbortSignal.timeout(10000) });
      return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
    } catch (e) {
      this.logger.warn(`No se pudo descargar ${ruta}: ${(e as Error).message}`);
      return null;
    }
  }

  private folio(o: OrdenesServicio): string {
    return o.folio ?? folioDe(Number(o.id));
  }
}
