import { Router } from "express";
import pool from "../db/index.js";

const router = Router();

// GET /api/stats
router.get("/", async (req, res) => {
  try {
    // 총 운동 일수
    const { rows: days } = await pool.query(
      `SELECT COUNT(DISTINCT log_date) AS total_days FROM workout_logs`
    );

    // 총 완료 세트 / 총 완료 횟수
    const { rows: sets } = await pool.query(
      `SELECT COUNT(*) AS total_sets, COALESCE(SUM(reps),0) AS total_reps
       FROM workout_sets WHERE done = true`
    );

    // 자주 하는 운동 TOP5
    const { rows: top } = await pool.query(
      `SELECT exercise_name AS name, COUNT(*) AS cnt
       FROM workout_logs
       GROUP BY exercise_name
       ORDER BY cnt DESC
       LIMIT 5`
    );

    // 최근 7일 일별 완료 세트 수
    const { rows: week } = await pool.query(
      `SELECT TO_CHAR(wl.log_date,'YYYY-MM-DD') AS log_date,
              COUNT(ws.id) AS done_sets
       FROM generate_series(
         CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, '1 day'
       ) AS gs(d)
       LEFT JOIN workout_logs wl ON wl.log_date = gs.d
       LEFT JOIN workout_sets ws ON ws.workout_log_id = wl.id AND ws.done = true
       GROUP BY gs.d, wl.log_date
       ORDER BY gs.d`
    );

    res.json({
      totalDays:  Number(days[0].total_days),
      totalSets:  Number(sets[0].total_sets),
      totalReps:  Number(sets[0].total_reps),
      topExercises: top.map((r) => [r.name, Number(r.cnt)]),
      last7: week.map((r) => ({
        date:     r.log_date,
        doneSets: Number(r.done_sets),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
