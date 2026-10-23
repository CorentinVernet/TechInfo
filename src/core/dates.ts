/** ISO UTC ou null si absente/invalide/aberrante (avant 2000 ou plus d'un jour dans le futur). */
export function parseDate(v: unknown, now = new Date()): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const t = Date.parse(v.trim());
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  if (d.getUTCFullYear() < 2000 || t > now.getTime() + 864e5) return null;
  return d.toISOString();
}
export function parisDay(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
export function parisHour(d: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "numeric", hourCycle: "h23" }).format(d));
}
