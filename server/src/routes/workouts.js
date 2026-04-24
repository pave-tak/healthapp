import { Router } from "express";
import pool from "../db/index.js";

const router = Router();

// ─── 헬퍼: 날짜 → 운동 목록 조회 ───
async function getLogByDate(date) {
  const { rows: logs } = await pool.query(
    `SELECT wl.id, wl.local_id, wl.exercise_name, wl.category
     FROM workout_logs wl
     WHERE wl.log_date = $1
     ORDER BY wl.id`,
    [date]
  );
  if (!logs.length) return [];

  const logIds = logs.map((l) => l.id);
  const { rows: sets } = await pool.query(
    `SELECT * FROM workout_sets WHERE workout_log_id = ANY($1) ORDER BY workout_log_id, set_number`,
    [logIds]
  );

  return logs.map((log) => ({
    id:       log.local_id || String(log.id),
    name:     log.exercise_name,
    category: log.category,
    sets:     sets
      .filter((s) => s.workout_log_id === log.id)
      .map((s) => ({ reps: s.reps, restSec: s.rest_sec, done: s.done })),
  }));
}

// GET /api/workouts  → 전체 기록 { "2024-01-01": [...] }
router.get("/", async (req, res) => {
  try {
    const { rows: logs } = await pool.query(
      `SELECT wl.id, wl.local_id, wl.exercise_name, wl.category,
              TO_CHAR(wl.log_date, 'YYYY-MM-DD') AS log_date
       FROM workout_logs wl ORDER BY wl.log_date, wl.id`
    );
    if (!logs.length) return res.json({});

    const logIds = logs.map((l) => l.id);
    const { rows: sets } = await pool.query(
      `SELECT * FROM workout_sets WHERE workout_log_id = ANY($1) ORDER BY workout_log_id, set_number`,
      [logIds]
    );

    const result = {};
    for (const log of logs) {
      const date = log.log_date;
      if (!result[date]) result[date] = [];
      result[date].push({
        id:       log.local_id || String(log.id),
        name:     log.exercise_name,
        category: log.category,
        sets:     sets
          .filter((s) => s.workout_log_id === log.id)
          .map((s) => ({ reps: s.reps, restSec: s.rest_sec, done: s.done })),
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/workouts/:date
router.get("/:date", async (req, res) => {
  try {
    const data = await getLogByDate(req.params.date);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/workouts/:date  → 해당 날짜 전체 저장 (upsert)
router.post("/:date", async (req, res) => {
  const { date } = req.params;
  const dayLog = req.body; // [{ id, name, category, sets: [{reps,restSec,done}] }]

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 기존 날짜 데이터 삭제
    await client.query(
      `DELETE FROM workout_logs WHERE log_date = $1`,
      [date]
    );

    // 새 데이터 삽입
    for (const exercise of dayLog) {
      const { rows } = await client.query(
        `INSERT INTO workout_logs (log_date, exercise_name, category, local_id)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [date, exercise.name, exercise.category, exercise.id]
      );
      const logId = rows[0].id;

      for (let i = 0; i < exercise.sets.length; i++) {
        const s = exercise.sets[i];
        await client.query(
          `INSERT INTO workout_sets (workout_log_id, set_number, reps, rest_sec, done)
           VALUES ($1,$2,$3,$4,$5)`,
          [logId, i + 1, s.reps, s.restSec, s.done]
        );
      }
    }

    await client.query("COMMIT");
    const result = await getLogByDate(date);
    res.json(result);
  } catch (err) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// DELETE /api/workouts/:date
router.delete("/:date", async (req, res) => {
  try {
    await pool.query("DELETE FROM workout_logs WHERE log_date = $1", [req.params.date]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
