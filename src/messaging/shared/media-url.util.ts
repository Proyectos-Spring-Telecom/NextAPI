/** Solo URLs públicas http(s); ignora paths absolutos del gateway. */
export function isPublicHttpUrl(value: string | null | undefined): boolean {
  const v = value?.trim();
  if (!v) return false;
  return /^https?:\/\//i.test(v);
}
