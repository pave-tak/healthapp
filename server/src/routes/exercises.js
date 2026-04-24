import { Router } from "express";
import pool from "../db/index.js";

const router = Router();

// GET /api/exercises  → 카테고리별 운동 목록
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM exercise_types ORDER BY category, id"
    );
    // { 상체: [...], 하체: [...], ... } 형식으로 변환
    const result = {};
    for (const row of rows) {
      if (!result[row.category]) result[row.category] = [];
      result[row.category].push({
        id:             row.id,
        name:           row.name,
        icon:           row.icon,
        defaultReps:    row.default_reps,
        defaultRestSec: row.default_rest_sec,
      });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exercises  → 운동 추가
router.post("/", async (req, res) => {
  const { category, name, icon = "🏃", defaultReps = 10, defaultRestSec = 60 } = req.body;
  if (!category || !name) return res.status(400).json({ error: "category, name 필수" });
  try {
    const { rows } = await pool.query(
      `INSERT INTO exercise_types (category, name, icon, default_reps, default_rest_sec)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (category, name) DO UPDATE
         SET icon=$3, default_reps=$4, default_rest_sec=$5
       RETURNING *`,
      [category, name, icon, defaultReps, defaultRestSec]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/exercises/:id  → 기본값 수정
router.put("/:id", async (req, res) => {
  const { id } = req.params;
  const { defaultReps, defaultRestSec, icon } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE exercise_types
       SET default_reps=$1, default_rest_sec=$2, icon=COALESCE($3, icon)
       WHERE id=$4 RETURNING *`,
      [defaultReps, defaultRestSec, icon, id]
    );
    if (!rows.length) return res.status(404).json({ error: "없음" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/exercises/:id
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM exercise_types WHERE id=$1", [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
