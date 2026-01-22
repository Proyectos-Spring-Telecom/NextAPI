export async function horaDesfasada(): Promise<{
  fechaDesfasada: Date;
  fechaActualSola: string;
  fechaActual: string;
}> {
  function pad(n: number) {
    return n < 10 ? '0' + n : n;
  }

  const ahora = new Date();
  const desfaseMs = -6 * 60 * 60 * 1000;
  const fechaDesfasada = new Date(ahora.getTime() + desfaseMs);

  const fechaActual = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())} ${pad(fechaDesfasada.getHours())}:${pad(fechaDesfasada.getMinutes())}:${pad(fechaDesfasada.getSeconds())}`;
  const fechaActualSola = `${fechaDesfasada.getFullYear()}-${pad(fechaDesfasada.getMonth() + 1)}-${pad(fechaDesfasada.getDate())}`;

  return { fechaDesfasada, fechaActualSola, fechaActual };
}
