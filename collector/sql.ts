import type { DatabaseSync } from "node:sqlite";
/** Littéral SQL sûr : les apostrophes sont doublées, les NUL retirés. */
export const q = (v: string | number | null | undefined): string =>
  v == null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/\0/g, "").replace(/'/g, "''")}'`;
export interface Sql { query<T = any>(sql: string): T[]; exec(sql: string): void }
export const sqliteSql = (raw: DatabaseSync): Sql => ({
  query: (sql) => raw.prepare(sql).all() as any[],
  exec: (sql) => raw.exec(sql),
});
