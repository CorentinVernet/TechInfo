import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface Stmt {
  bind(...a: unknown[]): Stmt;
  all<T = any>(): Promise<{ results: T[] }>;
  first<T = any>(): Promise<T | null>;
  run(): Promise<unknown>;
}
export interface Db { prepare(sql: string): Stmt }

/** Interface asynchrone minimale au-dessus de node:sqlite (SQLite intégré à Node 22). */
export function wrap(raw: DatabaseSync): Db {
  const stmt = (sql: string, args: unknown[] = []): Stmt => ({
    bind: (...a) => stmt(sql, a),
    all: async () => ({ results: raw.prepare(sql).all(...(args as any[])) as any[] }),
    first: async () => ((raw.prepare(sql).get(...(args as any[])) as any) ?? null),
    run: async () => { raw.prepare(sql).run(...(args as any[])); return {}; },
  });
  return { prepare: (s) => stmt(s) };
}
/** Applique les fichiers migrations/*.sql pas encore appliqués (suivi par PRAGMA user_version). */
export function migrate(raw: DatabaseSync, dir: string): void {
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const done = Number((raw.prepare("PRAGMA user_version").get() as any).user_version);
  files.slice(done).forEach((f, i) => {
    raw.exec("BEGIN");
    try { raw.exec(readFileSync(join(dir, f), "utf8")); raw.exec(`PRAGMA user_version=${done + i + 1}`); raw.exec("COMMIT"); }
    catch (e) { raw.exec("ROLLBACK"); throw e; }
  });
}
export function openDb(file: string, migrationsDir: string) {
  mkdirSync(dirname(file), { recursive: true });
  const raw = new DatabaseSync(file);
  raw.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA synchronous=NORMAL;");
  migrate(raw, migrationsDir);
  return { raw, db: wrap(raw) };
}
