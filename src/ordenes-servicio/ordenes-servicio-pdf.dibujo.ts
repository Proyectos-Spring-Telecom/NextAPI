import { join } from 'path';
import PDFDocument from 'pdfkit';

/**
 * Dibujo del PDF de la orden de servicio (diseño del front, docs/ordenes-servicio.md §13).
 * Solo pinta: los datos y las imágenes ya vienen resueltos por OrdenesServicioPdfService.
 */

export type Imagen = Buffer | null;
export interface Foto {
  nombre: string;
  imagen: Imagen;
}
export interface Casillas {
  titulo: string;
  /** "2 de 5", "Ninguna"… */
  resumen: string;
  opciones: Array<{ nombre: string; marcada: boolean }>;
}
export type ResultadoPrueba = 'correcta' | 'fallida' | 'pendiente' | 'no_realizada' | 'no_aplica';
export interface Prueba {
  nombre: string;
  resultado: ResultadoPrueba;
  detalle?: string;
}
export interface DatosPdfOrden {
  folio: string;
  estatus: string;
  generado: string;
  encabezado: {
    tecnico: string;
    correoTecnico?: string | null;
    cliente: string;
    fecha: string;
    cierre?: string | null;
    ubicacion: string;
    monitorista: string;
    tipos: string[];
  };
  vehiculo: Array<[string, string]>;
  imagenPrincipal: Imagen;
  fotosVehiculo: Foto[];
  documentos: Foto[];
  casillas: Casillas[];
  fotosTablero: Foto[];
  fotosFallas: Foto[];
  totalFallas: number;
  servicio: { titulo: string; filas: Array<[string, string]>; avisos: string[]; fotos: Foto[] };
  pruebas: Prueba[];
  observaciones: string;
  firmas: Array<{ nombre: string; rol: string; imagen: Imagen }>;
}

const C = {
  marino: '#0f2a6b',
  vino: '#7a1d34',
  azul: '#6ea8e8',
  tinta: '#1d2433',
  suave: '#667085',
  tenue: '#98a2b3',
  linea: '#dfe4ec',
  fondo: '#f4f6fa',
  placa: '#e4eaf5',
  verde: '#127a46',
  verdeFondo: '#e3f5ea',
  rojo: '#b42318',
  ambar: '#b54708',
};
const ESTATUS: Record<string, { texto: string; color: string; fondo: string }> = {
  cerrada: { texto: 'Cerrada', color: C.verde, fondo: C.verdeFondo },
  no_cumplida: { texto: 'No cumplida', color: C.ambar, fondo: '#fef0c7' },
  cancelada: { texto: 'Cancelada', color: C.rojo, fondo: '#fee4e2' },
  borrador: { texto: 'Borrador', color: C.suave, fondo: C.fondo },
  programada: { texto: 'Programada', color: C.marino, fondo: C.placa },
};
const RESULTADO: Record<ResultadoPrueba, { texto: string; color: string }> = {
  correcta: { texto: 'Correcta', color: C.verde },
  fallida: { texto: 'Fallida', color: C.rojo },
  pendiente: { texto: 'Sin validar', color: C.ambar },
  no_realizada: { texto: 'No realizada', color: C.suave },
  no_aplica: { texto: 'No aplica', color: C.tenue },
};

const FUENTES = join(__dirname, '..', 'assets', 'fonts');
const ANCHO = 612;
const ALTO = 792;
const M = 42;
const UTIL = ANCHO - 2 * M;
/** Lo que no se puede usar al pie de cada hoja. */
const LIMITE = ALTO - 80;

export function dibujarOrden(d: DatosPdfOrden): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'LETTER',
    margin: 0,
    bufferPages: true,
    info: { Title: `Orden de servicio ${d.folio}`, Author: 'Spring Telecom' },
  });
  doc.registerFont('r', join(FUENTES, 'Inter-Regular.ttf'));
  doc.registerFont('m', join(FUENTES, 'Inter-Medium.ttf'));
  doc.registerFont('s', join(FUENTES, 'Inter-SemiBold.ttf'));
  doc.registerFont('b', join(FUENTES, 'Inter-Bold.ttf'));
  const partes: Buffer[] = [];
  doc.on('data', (c: Buffer) => partes.push(c));
  const fin = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(partes))));

  let y = 0;
  const texto = (t: string, x: number, yy: number, o: { f?: string; t?: number; c?: string; w?: number; align?: 'left' | 'right' | 'center' } = {}) => {
    doc.font(o.f ?? 'r').fontSize(o.t ?? 9.5).fillColor(o.c ?? C.tinta);
    doc.text(t, x, yy, { width: o.w, align: o.align ?? 'left', lineBreak: o.w != null });
  };
  const alto = (t: string, w: number, f = 'r', t2 = 9.5) => doc.font(f).fontSize(t2).heightOfString(t, { width: w });
  const logo = (x: number, yy: number, grande: boolean) => {
    const t = grande ? 17 : 10;
    doc.font('b').fontSize(t).fillColor(C.tinta).text('SPRING', x, yy, { lineBreak: false });
    const w = doc.widthOfString('SPRING');
    doc.font('Courier').fontSize(t * 0.62).fillColor(C.azul).text('telecom', x + w + 4, yy + t * 0.33, { lineBreak: false });
  };
  const nuevaHoja = () => {
    doc.addPage();
    logo(M, 22, false);
    texto(`Orden de Servicio · Folio ${d.folio}`, M, 23, { f: 's', t: 9, c: C.marino, w: UTIL, align: 'right' });
    y = 52;
  };
  const cabe = (h: number) => {
    if (y + h > LIMITE) nuevaHoja();
  };
  const pastilla = (t: string, x: number, yy: number, color: string, fondo: string, f = 's', tam = 8.5) => {
    doc.font(f).fontSize(tam);
    const w = doc.widthOfString(t) + 16;
    doc.roundedRect(x, yy, w, tam + 8, (tam + 8) / 2).fillAndStroke(fondo, color);
    texto(t, x + 8, yy + 4, { f, t: tam, c: color });
    return w;
  };
  const seccion = (num: string | null, titulo: string, h: number) => {
    cabe(28 + h);
    let x = M;
    if (num) {
      texto(num, x, y, { f: 'b', t: 12, c: C.vino });
      doc.moveTo(x + 22, y + 1).lineTo(x + 22, y + 14).lineWidth(0.8).stroke(C.linea);
      x += 32;
    }
    texto(titulo, x, y, { f: 'b', t: 12.5, c: C.marino });
    const fin2 = x + doc.font('b').fontSize(12.5).widthOfString(titulo) + 10;
    doc.moveTo(fin2, y + 8).lineTo(M + UTIL, y + 8).lineWidth(0.6).stroke(C.linea);
    y += 26;
  };
  const subtitulo = (t: string, derecha?: string) => {
    texto(t, M, y, { f: 'b', t: 10.5, c: C.marino });
    if (derecha) {
      doc.font('s').fontSize(8);
      const w = doc.widthOfString(derecha) + 16;
      pastilla(derecha, M + UTIL - w, y - 2, C.marino, '#fff', 's', 8);
    }
    y += 20;
  };
  /** Pares etiqueta/valor; `dos` los acomoda en dos columnas. */
  const datos = (filas: Array<[string, string]>, dos: boolean) => {
    const col = dos ? (UTIL - 20) / 2 : UTIL;
    const et = 92;
    const renglon = (fila: Array<[string, string]>) => {
      const h = Math.max(...fila.map(([, v]) => alto(v || '—', col - et))) + 10;
      cabe(h);
      fila.forEach(([e, v], i) => {
        const x = M + i * (col + 20);
        texto(e, x, y + 5, { f: 's', t: 8, c: C.marino, w: et - 6 });
        texto(v || '—', x + et, y + 4, { w: col - et });
        doc.moveTo(x, y + h).lineTo(x + col, y + h).lineWidth(0.6).stroke(C.linea);
      });
      y += h;
    };
    if (!dos) return filas.forEach((f) => renglon([f]));
    for (let i = 0; i < filas.length; i += 2) renglon(filas.slice(i, i + 2));
  };
  const caja = (titulo: string, cuerpo: string) => {
    const h = alto(cuerpo, UTIL - 28) + 36;
    cabe(h);
    doc.roundedRect(M, y, UTIL, h, 6).fillAndStroke(C.fondo, C.linea);
    texto(titulo, M + 14, y + 11, { f: 's', t: 8.5, c: C.marino });
    texto(cuerpo, M + 14, y + 25, { w: UTIL - 28 });
    y += h + 12;
  };
  const marco = (x: number, yy: number, w: number, h: number, imagen: Imagen) => {
    if (imagen) {
      doc.save();
      doc.roundedRect(x, yy, w, h, 6).clip();
      doc.rect(x, yy, w, h).fill(C.placa);
      try {
        doc.image(imagen, x, yy, { cover: [w, h], align: 'center', valign: 'center' });
      } catch {
        texto('Imagen no legible', x, yy + h / 2 - 5, { t: 8.5, c: C.suave, w, align: 'center' });
      }
      doc.restore();
      doc.roundedRect(x, yy, w, h, 6).lineWidth(0.6).stroke(C.linea);
    } else {
      doc.roundedRect(x, yy, w, h, 6).fill(C.fondo);
      doc.roundedRect(x, yy, w, h, 6).dash(3, { space: 3 }).lineWidth(0.7).stroke(C.tenue).undash();
      texto('Sin fotografía', x, yy + h / 2 - 5, { f: 'm', t: 8.5, c: C.suave, w, align: 'center' });
    }
  };
  /** Rejilla de fotos de tres columnas; `extra` ocupa la siguiente celda libre. */
  const rejilla = (fotos: Foto[], h = 78, extra?: (x: number, yy: number, w: number, h: number) => void) => {
    const w = (UTIL - 2 * 12) / 3;
    const celdas = fotos.length + (extra ? 1 : 0);
    for (let i = 0; i < celdas; i += 3) {
      cabe(h + 32);
      for (let j = i; j < Math.min(i + 3, celdas); j++) {
        const x = M + (j - i) * (w + 12);
        const f = fotos[j];
        if (f) {
          marco(x, y, w, h, f.imagen);
          texto(f.nombre, x, y + h + 6, { f: 's', t: 8.5, w });
        } else extra?.(x, y, w, h);
      }
      y += h + 32;
    }
  };

  // ── Hoja 1: encabezado ────────────────────────────────────────────────
  logo(M, 52, true);
  texto('Orden de Servicio', M, 34, { f: 'b', t: 19, c: C.marino, w: UTIL, align: 'right' });
  const est = ESTATUS[d.estatus] ?? { texto: d.estatus, color: C.suave, fondo: C.fondo };
  doc.font('s').fontSize(9);
  const wEst = doc.widthOfString(est.texto) + 16;
  const xEst = M + UTIL - wEst;
  pastilla(est.texto, xEst, 60, est.color, est.fondo, 's', 9);
  texto('Estatus', xEst - 50, 63, { t: 9, c: C.suave });
  doc.moveTo(xEst - 60, 61).lineTo(xEst - 60, 76).lineWidth(0.6).stroke(C.linea);
  doc.font('b').fontSize(10.5);
  const wFolio = doc.widthOfString(d.folio);
  texto(d.folio, xEst - 72 - wFolio, 62, { f: 'b', t: 10.5 });
  texto('Folio', xEst - 72 - wFolio - 30, 63, { t: 9, c: C.suave });
  doc.rect(M, 92, UTIL * 0.86, 3).fill(C.marino);
  doc.rect(M + UTIL * 0.86, 92, UTIL * 0.09, 3).fill(C.vino);
  doc.rect(M + UTIL * 0.95, 92, UTIL * 0.05, 3).fill(C.azul);

  y = 108;
  const e = d.encabezado;
  const celdas: Array<[string, string, string | null | undefined]> = [
    ['Técnico', e.tecnico, e.correoTecnico],
    ['Cliente', e.cliente, null],
    ['Fecha y hora', e.fecha, e.cierre ? `Cierre: ${e.cierre}` : null],
    ['Ubicación', e.ubicacion, null],
    ['Monitorista', e.monitorista, null],
    ['Tipo(s) de servicio', '', null],
  ];
  const wc = (UTIL - 28) / 3;
  doc.roundedRect(M, y, UTIL, 98, 8).fillAndStroke(C.fondo, C.linea);
  celdas.forEach(([et, v, sub], i) => {
    const x = M + 14 + (i % 3) * wc;
    const yy = y + 12 + Math.floor(i / 3) * 46;
    texto(et, x, yy, { f: 's', t: 8.5, c: C.marino });
    if (et === 'Tipo(s) de servicio') {
      let xx = x;
      for (const t of e.tipos) xx += pastilla(t, xx, yy + 13, C.marino, '#fff', 's', 8) + 4;
    } else {
      texto(v, x, yy + 13, { f: 's', t: 10, w: wc - 10 });
      if (sub) texto(sub, x, yy + 27, { t: 8, c: C.suave, w: wc - 10 });
    }
  });
  y += 116;

  // ── 01 Datos del vehículo ─────────────────────────────────────────────
  seccion('01', 'Datos del vehículo', 60);
  datos(d.vehiculo.slice(0, 1), false);
  datos(d.vehiculo.slice(1), true);
  y += 14;
  const hPrincipal = Math.min(300, LIMITE - y - 20);
  if (hPrincipal >= 150) {
    marco(M, y, UTIL, hPrincipal, d.imagenPrincipal);
    texto('Imagen principal', M, y + hPrincipal + 6, { f: 's', t: 8.5 });
    y += hPrincipal + 28;
  } else {
    rejilla([{ nombre: 'Imagen principal', imagen: d.imagenPrincipal }], 150);
  }

  const conFoto = (f: Foto[]) => f.filter((x) => x.imagen).length;
  cabe(130);
  subtitulo('Fotografías del vehículo', `${conFoto(d.fotosVehiculo)}/${d.fotosVehiculo.length}`);
  rejilla(d.fotosVehiculo);
  cabe(130);
  subtitulo('Documentos del vehículo', `${conFoto(d.documentos)}/${d.documentos.length} opcionales`);
  rejilla(d.documentos);

  // ── 02 Revisión del vehículo ──────────────────────────────────────────
  const n = d.casillas.length;
  const wCol = (UTIL - (n - 1) * 12) / n;
  const hOpcion = (t: string) => Math.max(19, alto(t, wCol - 36, 's', 8.8) + 8);
  const hCas = Math.max(...d.casillas.map((c) => c.opciones.reduce((t, o) => t + hOpcion(o.nombre), 0))) + 46;
  seccion('02', 'Tipo de servicio', hCas);
  d.casillas.forEach((c, i) => {
    const x = M + i * (wCol + 12);
    doc.roundedRect(x, y, wCol, hCas, 6).lineWidth(0.6).stroke(C.linea);
    texto(c.titulo, x + 11, y + 10, { f: 'b', t: 9, c: C.marino, w: wCol - 20 });
    texto(c.resumen, x + 11, y + 23, { t: 8.5, c: C.suave });
    let yy = y + 42 - 19;
    let previo = '';
    c.opciones.forEach((o) => {
      yy += previo ? hOpcion(previo) : 19;
      previo = o.nombre;
      if (o.marcada) {
        doc.roundedRect(x + 11, yy, 10, 10, 2).fill(C.marino);
        doc.moveTo(x + 13.5, yy + 5.2).lineTo(x + 15.4, yy + 7.2).lineTo(x + 18.6, yy + 3).lineWidth(1.3).stroke('#fff');
      } else {
        doc.roundedRect(x + 11, yy, 10, 10, 2).lineWidth(0.6).stroke(C.tenue);
        doc.moveTo(x + 13.5, yy + 5).lineTo(x + 18.5, yy + 5).lineWidth(0.8).stroke(C.tenue);
      }
      texto(o.nombre, x + 27, yy, { f: o.marcada ? 's' : 'r', t: 8.8, c: o.marcada ? C.tinta : C.suave, w: wCol - 36 });
    });
  });
  y += hCas + 18;

  cabe(130);
  subtitulo('Fotografías del tablero', `${conFoto(d.fotosTablero)}/${d.fotosTablero.length}`);
  const fallas = d.fotosFallas.filter((f) => f.imagen);
  rejilla(d.fotosTablero, 78, fallas.length ? undefined : (x, yy, w, h) => {
    doc.roundedRect(x, yy, w, h, 6).dash(3, { space: 3 }).lineWidth(0.7).stroke(C.tenue).undash();
    texto('Imágenes extras de fallas', x, yy + h / 2 - 12, { f: 's', t: 9, c: C.marino, w, align: 'center' });
    texto(`0/${d.totalFallas} · Ninguna`, x, yy + h / 2 + 3, { t: 8.5, c: C.suave, w, align: 'center' });
  });
  if (fallas.length) {
    cabe(130);
    subtitulo('Imágenes extras de fallas', `${fallas.length}/${d.totalFallas}`);
    rejilla(fallas);
  }

  // ── 03 El servicio ────────────────────────────────────────────────────
  seccion('03', d.servicio.titulo, 60);
  datos(d.servicio.filas, false);
  y += 12;
  for (const a of d.servicio.avisos) caja('Nota', a);
  if (d.servicio.fotos.length) rejilla(d.servicio.fotos);

  // ── 04 Pruebas ────────────────────────────────────────────────────────
  if (d.pruebas.length) {
    const hFila = 30;
    seccion('04', 'Pruebas generadas', 30 + hFila);
    const xRes = M + UTIL * 0.66;
    const encab = () => {
      doc.save().roundedRect(M, y, UTIL, 26, 6).clip().rect(M, y, UTIL, 26).fill('#eaf0f9').restore();
      texto('Prueba', M + 14, y + 9, { f: 's', t: 8.5, c: C.marino });
      texto('Resultado', xRes, y + 9, { f: 's', t: 8.5, c: C.marino });
      y += 26;
    };
    const y0 = y;
    encab();
    let inicio = y0;
    d.pruebas.forEach((p, i) => {
      if (y + hFila > LIMITE) {
        doc.roundedRect(M, inicio, UTIL, y - inicio, 6).lineWidth(0.6).stroke(C.linea);
        nuevaHoja();
        inicio = y;
        encab();
      }
      const r = RESULTADO[p.resultado];
      texto(p.nombre, M + 14, y + 9, { t: 9.5, w: xRes - M - 24 });
      doc.circle(xRes + 5, y + 14, 5).lineWidth(1).stroke(r.color);
      if (p.resultado === 'correcta') doc.moveTo(xRes + 2.6, y + 14.2).lineTo(xRes + 4.4, y + 16).lineTo(xRes + 7.5, y + 12).lineWidth(1).stroke(r.color);
      else doc.moveTo(xRes + 2.8, y + 14).lineTo(xRes + 7.2, y + 14).lineWidth(1).stroke(r.color);
      texto(r.texto, xRes + 15, y + 8, { f: 's', t: 9.5, c: r.color });
      if (p.detalle) texto(p.detalle, xRes + 15, y + 20, { t: 7, c: C.suave, w: M + UTIL - xRes - 20 });
      if (i < d.pruebas.length - 1) doc.moveTo(M, y + hFila).lineTo(M + UTIL, y + hFila).lineWidth(0.6).stroke(C.linea);
      y += hFila;
    });
    doc.roundedRect(M, inicio, UTIL, y - inicio, 6).lineWidth(0.6).stroke(C.linea);
    y += 14;
  }
  caja('Observaciones', d.observaciones || 'Sin observaciones');

  // ── Firmas ────────────────────────────────────────────────────────────
  if (d.firmas.length) {
    const hFirma = 118;
    seccion(null, 'Firmas de conformidad', hFirma + 40);
    const w = (UTIL - 14) / 2;
    d.firmas.forEach((f, i) => {
      const x = M + i * (w + 14);
      doc.roundedRect(x, y, w, hFirma, 8).lineWidth(0.6).stroke(C.linea);
      if (f.imagen) {
        try {
          doc.image(f.imagen, x + 20, y + 10, { fit: [w - 40, hFirma - 34], align: 'center', valign: 'center' });
        } catch {
          texto('Firma no legible', x, y + 50, { t: 8.5, c: C.suave, w, align: 'center' });
        }
      } else texto('Sin firma', x, y + 50, { t: 8.5, c: C.suave, w, align: 'center' });
      doc.moveTo(x + 20, y + hFirma - 22).lineTo(x + w - 20, y + hFirma - 22).lineWidth(0.8).stroke(C.tinta);
      texto(f.nombre, x, y + hFirma + 10, { f: 's', t: 9.5, w });
      texto(f.rol, x, y + hFirma + 24, { t: 8.5, c: C.suave, w });
    });
    y += hFirma + 44;
  }

  // ── Pie de cada hoja ──────────────────────────────────────────────────
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i++) {
    doc.switchToPage(i);
    doc.moveTo(M, ALTO - 62).lineTo(M + UTIL, ALTO - 62).lineWidth(0.6).stroke(C.linea);
    texto('Documento generado automáticamente por Spring Telecom', M, ALTO - 52, { t: 8, c: C.suave });
    texto(`Folio ${d.folio} · Generado el ${d.generado}`, M, ALTO - 40, { t: 8, c: C.suave });
    texto(`Página ${i - start + 1} de ${count}`, M, ALTO - 52, { f: 's', t: 8.5, c: C.marino, w: UTIL, align: 'right' });
  }
  doc.end();
  return fin;
}
