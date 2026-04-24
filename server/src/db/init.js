import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import pool from "./index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function initDB() {
  const sql = readFileSync(join(__dirname, "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("✅ DB 초기화 완료");
}
