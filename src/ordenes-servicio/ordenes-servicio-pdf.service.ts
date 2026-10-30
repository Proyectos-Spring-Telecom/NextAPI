import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import PDFDocument from 'pdfkit';
import { In, Repository } from 'typeorm';
import { EnumModulos, EnumRoles } from 'src/common/estatus.enum';
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
import { MailService } from 'src/mail/mail.service';
import { S3Service } from 'src/s3/s3.service';
import { nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import { ESTATUS_ORDEN, SECCIONES_RESPUESTA, folioDe } from './ordenes-servicio.reglas';
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
  pruebas: 'Pruebas',
};
/** Solo se comparte una orden terminada. */
const ESTATUS_COMPARTIBLES: string[] = [ESTATUS_ORDEN.CERRADA, ESTATUS_ORDEN.NO_CUMPLIDA];
/** Vigencia del enlace del PDF para WhatsApp (máximo de S3 con firma v4). */
const VIGENCIA_ENLACE_S = 7 * 24 * 3600;
const ROLES_ADMIN = new Set<number>([EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN]);
const ROLES_LEEN_TODO = new Set<number>([...ROLES_ADMIN, EnumRoles.JEFE_MONITOREO, EnumRoles.MONITOREO]);

/** Fecha guardada como hora de México en UTC → `DD/MM/AAAA HH:mm`. */
function fecha(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const x = new Date(d);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(x.getUTCDate())}/${p(x.getUTCMonth() + 1)}/${x.getUTCFullYear()} ${p(x.getUTCHours())}:${p(x.getUTCMinutes())}`;
}

/**
 * PDF de la orden de servicio (§13): datos, checklist, pruebas con quién las
 * validó, observaciones y firmas. Se guarda en S3 privado y se comparte por
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
    const orden = await this.ordenVisible(id, user);
    this.exigirTerminada(orden);
    const ruta = await this.rutaVigente(orden, user);
    const key = new URL(ruta).pathname.replace(/^\//, '');
    const url = await this.s3Service.getPresignedUrl(key, VIGENCIA_ENLACE_S);
    const texto = `Orden de servicio ${this.folio(orden)} (${NOMBRE_TIPO[orden.tipoServicio] ?? orden.tipoServicio}): ${url}`;
    const destino = telefono ? telefono.replace(/\D/g, '') : '';
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
    const orden = await this.ordenVisible(id, user);
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
    await this.ordenesRepo.update({ id: orden.id }, { rutaPdf: url, fechaPdf: nowMexicoCityAsUtcDate() });
    return url;
  }

  private exigirTerminada(orden: OrdenesServicio): void {
    if (!ESTATUS_COMPARTIBLES.includes(orden.estatus)) {
      throw new BadRequestException(`La orden está ${orden.estatus}: solo se comparte cerrada o no cumplida`);
    }
  }

  private async ordenVisible(id: number, user: UsuarioToken): Promise<OrdenesServicio> {
    const orden = await this.ordenesRepo.findOne({ where: { id } });
    if (!orden || (!ROLES_LEEN_TODO.has(Number(user.rol)) && Number(orden.idTecnico) !== Number(user.userId))) {
      throw new NotFoundException('Orden de servicio no encontrada');
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
    const vehiculo = orden.idProducto ? await this.vehiculosRepo.findOne({ where: { idProducto: orden.idProducto } }) : null;
    const inst = orden.idInstalacionResultado ?? orden.idInstalacion;
    const instalacion = inst ? await this.instalacionesRepo.findOne({ where: { id: inst } }) : null;
    const idDispositivo = orden.idDispositivoNuevo ?? instalacion?.idDispositivo ?? null;
    const idSim = orden.idSimNuevo ?? instalacion?.idSim ?? null;
    const [dispositivo, sim, motivo] = await Promise.all([
      idDispositivo ? this.dispositivosRepo.findOne({ where: { id: idDispositivo } }) : null,
      idSim ? this.simsRepo.findOne({ where: { id: idSim } }) : null,
      orden.claveMotivo ? this.motivosRepo.findOne({ where: { clave: orden.claveMotivo } }) : null,
    ]);
    const nombre = (x?: { nombre?: string | null; apellidoPaterno?: string | null; apellidoMaterno?: string | null } | null) =>
      x ? [x.nombre, x.apellidoPaterno, x.apellidoMaterno].filter(Boolean).join(' ') : '—';
    const persona = (idU: number | null) => nombre(personas.find((u) => Number(u.id) === Number(idU)));
    const firmas = await Promise.all(
      archivos
        .filter((a) => a.clave.startsWith('firma_'))
        .map(async (a) => ({ clave: a.clave, imagen: await this.descargar(a.ruta) })),
    );

    const doc = new PDFDocument({ size: 'LETTER', margin: 48, info: { Title: `Orden ${this.folio(orden)}` } });
    const partes: Buffer[] = [];
    doc.on('data', (c: Buffer) => partes.push(c));
    const fin = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(partes))));

    const titulo = (t: string) => {
      doc.moveDown(0.6).font('Helvetica-Bold').fontSize(11).fillColor('#1f3b63').text(t).moveDown(0.2);
      doc.font('Helvetica').fontSize(9.5).fillColor('#000');
    };
    const fila = (etiqueta: string, valor: string | number | null | undefined) =>
      doc.font('Helvetica-Bold').text(`${etiqueta}: `, { continued: true }).font('Helvetica').text(String(valor ?? '—'));

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#1f3b63').text('Spring Telecom · Orden de servicio');
    doc.font('Helvetica').fontSize(10).fillColor('#000')
      .text(`${this.folio(orden)} · ${NOMBRE_TIPO[orden.tipoServicio] ?? orden.tipoServicio} · ${orden.estatus.replace('_', ' ')}`);

    titulo('Servicio');
    fila('Cliente', nombre(cliente));
    if (orden.tipoProgramado && orden.tipoProgramado !== orden.tipoServicio) {
      fila('Programado como', NOMBRE_TIPO[orden.tipoProgramado] ?? orden.tipoProgramado);
    }
    fila('Cita', fecha(orden.cita));
    fila('Inicio en campo', fecha(orden.fechaInicio ?? orden.fechaCaptura));
    fila('Cierre', fecha(orden.fechaCierre));
    fila('Técnico', persona(orden.idTecnico));
    fila('Monitorista', orden.idMonitorista ? persona(orden.idMonitorista) : '—');
    if (orden.fechaCodigoValidado) fila('Vehículo confirmado con código', fecha(orden.fechaCodigoValidado));
    if (orden.lat != null && orden.lng != null) fila('Ubicación de captura', `${orden.lat}, ${orden.lng}`);

    titulo('Vehículo y equipo');
    fila('Placa', vehiculo?.placa);
    fila('Número económico', vehiculo?.numeroEconomico);
    fila('Año / color', [vehiculo?.anio, vehiculo?.color].filter(Boolean).join(' / ') || '—');
    fila('Número de serie (VIN)', vehiculo?.numeroSerie);
    fila('Equipo (IMEI / serie)', dispositivo ? `${dispositivo.imei ?? '—'} / ${dispositivo.numeroSerie}` : '—');
    fila('SIM (ICCID / teléfono)', sim ? `${sim.imei ?? '—'} / ${sim.numeroTelefono ?? '—'}` : '—');
    if (orden.autorizacion) {
      fila('Desinstalación de equipo existente', `${orden.autorizacion} por ${orden.nombreAutorizo ?? '—'} (${fecha(orden.fechaAutorizacion)})`);
    }

    for (const seccion of SECCIONES_RESPUESTA) {
      const opciones = catalogo.filter((o) => o.seccion === seccion).sort((a, b) => a.orden - b.orden);
      if (!opciones.length) continue;
      titulo(NOMBRE_SECCION[seccion] ?? seccion);
      for (const o of opciones) {
        const r = respuestas.find((x) => x.seccion === seccion && x.clave === o.clave);
        const valor = r == null ? 'sin respuesta' : Number(r.valor) === 1 ? 'Sí' : 'No';
        const p = seccion === 'pruebas' ? pruebas.find((x) => x.clave === o.clave) : null;
        const validacion = p?.fechaValidacion ? ` · validó ${p.nombreValido ?? '—'} ${fecha(p.fechaValidacion)}` : '';
        doc.text(`• ${o.nombre}: ${valor}${validacion}`);
      }
    }

    if (orden.claveMotivo) {
      titulo('No cumplida / cancelada');
      fila('Motivo', motivo?.nombre ?? orden.claveMotivo);
      fila('Cobrable', orden.cobrable == null ? '—' : Number(orden.cobrable) === 1 ? 'Sí' : 'No');
    }
    if (orden.observaciones) {
      titulo('Observaciones');
      doc.text(orden.observaciones);
    }

    const fotos = archivos.filter((a) => !a.clave.startsWith('firma_'));
    if (fotos.length) {
      titulo('Evidencia fotográfica');
      doc.text(fotos.map((f) => catalogo.find((o) => o.clave === f.clave)?.nombre ?? f.clave).join(', '));
      doc.fontSize(8).fillColor('#555').text('Las fotos se consultan en Next, en el detalle de la orden.').fillColor('#000').fontSize(9.5);
    }

    if (firmas.length) {
      titulo('Firmas');
      const y = doc.y;
      firmas.forEach((f, i) => {
        const x = 48 + i * 260;
        if (f.imagen) {
          try {
            doc.image(f.imagen, x, y, { fit: [220, 90] });
          } catch {
            doc.text('(firma no legible)', x, y);
          }
        }
        doc.text(f.clave === 'firma_cliente' ? 'Cliente' : 'Técnico', x, y + 95, { width: 220, align: 'center' });
      });
      doc.y = y + 115;
      doc.x = 48;
    }

    doc.moveDown(1).fontSize(7.5).fillColor('#777').text(`Generado el ${fecha(nowMexicoCityAsUtcDate())} · Spring Telecom`);
    doc.end();
    return fin;
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
