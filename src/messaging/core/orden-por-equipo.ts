/**
 * Serializa el trabajo por llave (equipo): lo de una misma llave corre en el
 * orden en que llegó, una cosa a la vez; llaves distintas corren en paralelo.
 *
 * Las reglas de ingesta dependen de la posición anterior del equipo (tiempo
 * detenido, inicio de alerta, geocerca): con prefetch > 1 dos posiciones del
 * mismo equipo no deben procesarse a la vez ni al revés. NextAPI corre en una
 * sola instancia, así que basta con hacerlo en memoria.
 */
export class OrdenPorEquipo {
  private readonly colas = new Map<string, Promise<unknown>>();

  /** Corre `trabajo` después de lo pendiente de la misma llave. Sin llave, corre de inmediato. */
  run<T>(llave: string | null | undefined, trabajo: () => Promise<T>): Promise<T> {
    if (!llave) return trabajo();
    const anterior = this.colas.get(llave) ?? Promise.resolve();
    // Un fallo del anterior no detiene al siguiente (cada mensaje maneja su error).
    const actual = anterior.catch(() => undefined).then(trabajo);
    const cola = actual.catch(() => undefined);
    this.colas.set(llave, cola);
    void cola.then(() => {
      if (this.colas.get(llave) === cola) this.colas.delete(llave);
    });
    return actual;
  }

  /** Llaves con trabajo en curso (métrica / pruebas). */
  get activas(): number {
    return this.colas.size;
  }
}
