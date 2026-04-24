import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { initDB } from "./db/init.js";
import exercisesRouter from "./routes/exercises.js";
import workoutsRouter from "./routes/workouts.js";
import statsRouter from "./routes/stats.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, "../../client/dist");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// API
app.use("/api/exercises", exercisesRouter);
app.use("/api/workouts",  workoutsRouter);
app.use("/api/stats",     statsRouter);
app.get("/health", (req, res) => res.json({ status: "ok" }));

// 정적 파일 (빌드된 PWA) + SPA fallback
if (existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
} else {
  console.warn(`⚠️  ${CLIENT_DIST} 가 없습니다. 'npm run build' (client) 후 다시 시작하세요.`);
}

// 서버 시작 (0.0.0.0 — LAN 접근 허용)
// DB 연결은 best-effort: 실패해도 정적 파일 서빙은 계속
function startServer(dbStatus) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
    console.log(`   ${dbStatus}`);
    console.log(`📱 LAN 접속:    http://<PC-IP>:${PORT}`);
  });
}

initDB()
  .then(() => startServer("✅ Postgres 연결됨 (legacy API 사용 가능)"))
  .catch((err) => {
    console.warn(`⚠️  Postgres 미연결: ${err.message}`);
    startServer("⚪ DB 없이 실행 — 클라이언트는 Dexie 로컬 DB 사용");
  });
