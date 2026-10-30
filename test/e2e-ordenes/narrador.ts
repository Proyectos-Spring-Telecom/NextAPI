import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

/** Quién hace cada paso: los mismos actores que en la operación real. */
export type Actor = 'CRM' | 'App' | 'Monitoreo' | 'Operación' | 'Sistema';

interface Paso {
  actor: Actor;
  texto: string;
  resultado?: string;
}

/**
 * Narra cada escenario paso a paso y lo deja en `reportes/<escenario>.md`, para
 * explicar el modelo a los usuarios con lo que de verdad pasó en la corrida.
 */
export class Narrador {
  private readonly escenarios: Array<{ titulo: string; descripcion: string; pasos: Paso[] }> = [];

  escenario(titulo: string, descripcion: string): void {
    this.escenarios.push({ titulo, descripcion, pasos: [] });
  }

  paso(actor: Actor, texto: string, resultado?: string): void {
    const actual = this.escenarios[this.escenarios.length - 1];
    if (!actual) throw new Error('Narrador: falta escenario()');
    actual.pasos.push({ actor, texto, resultado });
  }

  escribir(nombre: string): string {
    const dir = join(__dirname, 'reportes');
    mkdirSync(dir, { recursive: true });
    const md = [
      `# ${nombre}`,
      '',
      `Corrida automática del ${new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}. Cada paso se ejecutó contra NextAPI y crmAPI reales sobre bases de prueba; lo que dice "Resultado" es lo que respondieron.`,
      '',
      ...this.escenarios.flatMap((e, i) => [
        `## ${i + 1}. ${e.titulo}`,
        '',
        e.descripcion,
        '',
        '| # | Quién | Qué hace | Resultado |',
        '|---|-------|----------|-----------|',
        ...e.pasos.map((p, j) => `| ${j + 1} | ${p.actor} | ${p.texto.replace(/\|/g, '\\|')} | ${(p.resultado ?? '').replace(/\|/g, '\\|')} |`),
        '',
      ]),
    ].join('\n');
    const ruta = join(dir, `${nombre.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`);
    writeFileSync(ruta, md);
    return ruta;
  }
}
