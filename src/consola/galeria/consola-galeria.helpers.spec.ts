import {
  canalesActivosDesdeFila,
  escaparLike,
  etiquetaInstalacion,
  extraerFotosPosicion,
  normalizarBusquedaGaleria,
  rangoPorDefectoMesActual,
  resolverCanalFoto,
  validarRangoGaleria,
} from './consola-galeria.helpers';

describe('consola-galeria.helpers', () => {
  describe('extraerFotosPosicion', () => {
    it('toma los 4 slots con id y url, en orden de canal', () => {
      const fotos = extraerFotosPosicion({
        idFoto0: '10',
        rutaFoto0: 'https://x/10.jpeg',
        idFoto1: null,
        rutaFoto1: null,
        idFoto2: 12,
        rutaFoto2: ' https://x/12.jpeg ',
        idFoto3: 13,
        rutaFoto3: 'https://x/13.jpeg',
      });
      expect(fotos).toEqual([
        { id: 10, canal: 0, url: 'https://x/10.jpeg' },
        { id: 12, canal: 2, url: 'https://x/12.jpeg' },
        { id: 13, canal: 3, url: 'https://x/13.jpeg' },
      ]);
    });

    it('omite slots con id pero sin URL (fila de Fotos inexistente)', () => {
      expect(
        extraerFotosPosicion({ idFoto1: 5, rutaFoto1: null, idFoto2: 6, rutaFoto2: '' }),
      ).toEqual([]);
    });
  });

  describe('etiquetaInstalacion', () => {
    const base = { placas: null, economico: null, descripcion: null, imei: '123' };
    it('prioriza placa, luego económico, descripción e IMEI', () => {
      expect(etiquetaInstalacion({ ...base, placas: 'ABC', economico: '18' })).toBe('ABC');
      expect(etiquetaInstalacion({ ...base, economico: '18' })).toBe('Eco 18');
      expect(etiquetaInstalacion({ ...base, descripcion: 'Montacargas' })).toBe('Montacargas');
      expect(etiquetaInstalacion(base)).toBe('123');
    });
  });

  describe('validarRangoGaleria', () => {
    it('acepta un rango válido dentro del máximo', () => {
      expect(validarRangoGaleria('2026-10-01 00:00:00', '2026-10-31 23:59:59')).toBeNull();
    });

    it('rechaza inicio posterior al final', () => {
      expect(validarRangoGaleria('2026-10-02 00:00:00', '2026-10-01 00:00:00')).toMatch(
        /posterior/,
      );
    });

    it('rechaza rangos mayores al máximo', () => {
      expect(validarRangoGaleria('2026-09-01 00:00:00', '2026-10-15 00:00:00')).toMatch(
        /31 días/,
      );
    });
  });

  describe('normalizarBusquedaGaleria', () => {
    it('solo dígitos (con espacios o guiones) → IMEI sin separadores', () => {
      expect(normalizarBusquedaGaleria(' 8664-9607 4989 ')).toEqual({
        tipo: 'imei',
        valor: '866496074989',
      });
    });

    it('con letras → texto (placa / económico)', () => {
      expect(normalizarBusquedaGaleria('  raw  daw3545 ')).toEqual({
        tipo: 'texto',
        valor: 'raw daw3545',
      });
    });
  });

  describe('canalesActivosDesdeFila', () => {
    it('regresa solo los canales 1..3 con bandera 1', () => {
      expect(canalesActivosDesdeFila({ canal1Activo: 1, canal2Activo: '0', canal3Activo: '1' })).toEqual([1, 3]);
      expect(canalesActivosDesdeFila({})).toEqual([]);
    });
  });

  describe('resolverCanalFoto', () => {
    it('slot 0 es la foto principal histórica', () => {
      expect(resolverCanalFoto(0, 5, [1, 2])).toEqual({ canalReal: null, etiquetaCanal: 'Foto Principal' });
    });

    it('TrackCam: el slot N es el N-ésimo canal activo', () => {
      expect(resolverCanalFoto(1, 5, [2, 3])).toEqual({ canalReal: 2, etiquetaCanal: 'Vista Adentro' });
      expect(resolverCanalFoto(2, 5, [2, 3])).toEqual({ canalReal: 3, etiquetaCanal: 'Cámara 3' });
    });

    it('TrackCam sin configuración de canales: slot = canal', () => {
      expect(resolverCanalFoto(1, 5, [])).toEqual({ canalReal: 1, etiquetaCanal: 'Vista Afuera' });
    });

    it('AVL u otros: "Cámara N" sin suponer vista', () => {
      expect(resolverCanalFoto(2, 3, [1, 2])).toEqual({ canalReal: 2, etiquetaCanal: 'Cámara 2' });
      expect(resolverCanalFoto(1, null, [])).toEqual({ canalReal: 1, etiquetaCanal: 'Cámara 1' });
    });
  });

  describe('escaparLike', () => {
    it('escapa comodines de LIKE', () => {
      expect(escaparLike(String.raw`a%b_c\d`)).toBe(String.raw`a\%b\_c\\d`);
    });
  });

  describe('rangoPorDefectoMesActual', () => {
    it('día 1 del mes a 00:00:00 hasta hoy a 23:59:59', () => {
      expect(rangoPorDefectoMesActual(new Date(2026, 9, 23))).toEqual({
        fechaInicio: '2026-10-01 00:00:00',
        fechaFinal: '2026-10-23 23:59:59',
      });
    });

    it('si hoy es el día 1, inicio y fin caen el mismo día', () => {
      expect(rangoPorDefectoMesActual(new Date(2026, 0, 1))).toEqual({
        fechaInicio: '2026-01-01 00:00:00',
        fechaFinal: '2026-01-01 23:59:59',
      });
    });
  });
});
