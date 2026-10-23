import { DatabaseSync } from "node:sqlite";
import { migrate } from "../src/server/db";
export function memDb() {
  const db = new DatabaseSync(":memory:");
  migrate(db, "migrations");
  db.exec("INSERT INTO sources(id,name,feed_url) VALUES (1,'Src A','https://a.example/feed'),(2,'Src B','https://b.example/feed')");
  return db;
}
