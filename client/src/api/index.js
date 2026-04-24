// ─── 로컬 DB(Dexie) 기반 API — 기존 서버 fetch 대체 ───
// 기존 api.* 시그니처를 그대로 유지해 App.jsx에서는 투명하게 동작합니다.

import { db, ensureSeed } from "./db.js";

// 최초 접근 시 시드 보장 (한 번만 실행)
let seedReady = null;
function ready() {
  if (!seedReady) seedReady = ensureSeed();
  return seedReady;
}

// ─── 날짜 유틸 ───
const pad = (n) => String(n).padStart(2, "0");
const toDateStr = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// ─── 운동 종목 ───
async function getExercises() {
  await ready();
  const rows = await db.exerciseTypes.orderBy("id").toArray();
  const grouped = {};
  for (const r of rows) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push({
      id:             r.id,
      name:           r.name,
      icon:           r.icon,
      defaultReps:    r.defaultReps,
      defaultRestSec: r.defaultRestSec,
    });
  }
  return grouped;
}

async function addExercise(data) {
  await ready();
  const {
    category,
    name,
    icon = "🏃",
    defaultReps = 10,
    defaultRestSec = 60,
  } = data;
  if (!category || !name) throw new Error("category, name 필수");

  const existing = await db.exerciseTypes.where({ category, name }).first();
  if (existing) {
    await db.exerciseTypes.update(existing.id, {
      icon,
      defaultReps,
      defaultRestSec,
    });
    return { ...existing, icon, defaultReps, defaultRestSec };
  }
  const id = await db.exerciseTypes.add({
    category,
    name,
    icon,
    defaultReps,
    defaultRestSec,
  });
  return { id, category, name, icon, defaultReps, defaultRestSec };
}

async function updateExercise(id, data) {
  await ready();
  const patch = {};
  if (data.defaultReps    != null) patch.defaultReps    = data.defaultReps;
  if (data.defaultRestSec != null) patch.defaultRestSec = data.defaultRestSec;
  if (data.icon           != null) patch.icon           = data.icon;
  await db.exerciseTypes.update(id, patch);
  return await db.exerciseTypes.get(id);
}

async function deleteExercise(id) {
  await ready();
  await db.exerciseTypes.delete(id);
  return { ok: true };
}

// ─── 운동 기록 ───
async function getAllWorkouts() {
  await ready();
  const all = await db.workouts.toArray();
  const result = {};
  for (const row of all) {
    if (row.exercises && row.exercises.length) result[row.date] = row.exercises;
  }
  return result;
}

async function getWorkoutByDate(date) {
  await ready();
  const row = await db.workouts.get(date);
  return row?.exercises || [];
}

async function saveWorkout(date, dayLog) {
  await ready();
  if (!Array.isArray(dayLog) || dayLog.length === 0) {
    await db.workouts.delete(date);
    return [];
  }
  // 직렬화 가능한 평범한 객체로 정리 (React state 참조 제거)
  const clean = dayLog.map((ex) => ({
    id:       ex.id,
    name:     ex.name,
    category: ex.category,
    sets: (ex.sets || []).map((s) => ({
      reps:    Number(s.reps)    || 0,
      restSec: Number(s.restSec) || 0,
      done:    !!s.done,
    })),
  }));
  await db.workouts.put({ date, exercises: clean });
  return clean;
}

async function deleteWorkout(date) {
  await ready();
  await db.workouts.delete(date);
  return { ok: true };
}

// ─── 통계 ───
async function getStats() {
  await ready();
  const all = await db.workouts.toArray();

  // totalDays: exercises가 있는 날 수
  const days = all.filter((r) => r.exercises?.length > 0);
  const totalDays = days.length;

  // totalSets / totalReps: done=true 세트 기준
  let totalSets = 0;
  let totalReps = 0;
  const exerciseCount = new Map(); // 종목명 → 등장 일수 (기존 서버 topExercises 로직과 동일)

  for (const day of days) {
    for (const ex of day.exercises) {
      exerciseCount.set(ex.name, (exerciseCount.get(ex.name) || 0) + 1);
      for (const s of ex.sets || []) {
        if (s.done) {
          totalSets += 1;
          totalReps += Number(s.reps) || 0;
        }
      }
    }
  }

  // topExercises: [[name, count], …] 상위 5
  const topExercises = [...exerciseCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  // last7: 오늘 포함 최근 7일별 완료 세트 수
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last7 = [];
  const byDate = new Map(all.map((r) => [r.date, r]));
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = toDateStr(d);
    const row = byDate.get(key);
    let doneSets = 0;
    if (row?.exercises) {
      for (const ex of row.exercises) {
        for (const s of ex.sets || []) if (s.done) doneSets += 1;
      }
    }
    last7.push({ date: key, doneSets });
  }

  return { totalDays, totalSets, totalReps, topExercises, last7 };
}

// ─── 백업 / 복원 ───
async function exportAll() {
  await ready();
  const [exerciseTypes, workouts] = await Promise.all([
    db.exerciseTypes.toArray(),
    db.workouts.toArray(),
  ]);
  return {
    app:         "workout",
    version:     1,
    exportedAt:  new Date().toISOString(),
    exerciseTypes,
    workouts,
  };
}

async function importAll(data) {
  if (!data || typeof data !== "object") throw new Error("잘못된 파일 형식");
  if (!Array.isArray(data.exerciseTypes) || !Array.isArray(data.workouts)) {
    throw new Error("백업 파일 구조가 올바르지 않습니다 (exerciseTypes / workouts 필드 필요)");
  }
  // 각 workout 레코드가 {date, exercises} 구조인지 간단 검증
  for (const w of data.workouts) {
    if (typeof w?.date !== "string" || !Array.isArray(w?.exercises)) {
      throw new Error("workouts 항목 형식 오류");
    }
  }
  await db.transaction("rw", db.exerciseTypes, db.workouts, async () => {
    await db.exerciseTypes.clear();
    await db.workouts.clear();
    if (data.exerciseTypes.length) await db.exerciseTypes.bulkAdd(data.exerciseTypes);
    if (data.workouts.length)      await db.workouts.bulkAdd(data.workouts);
  });
  return {
    exerciseTypes: data.exerciseTypes.length,
    workouts:      data.workouts.length,
  };
}

export const api = {
  // 운동 종목
  getExercises,
  addExercise,
  updateExercise,
  deleteExercise,
  // 운동 기록
  getAllWorkouts,
  getWorkoutByDate,
  saveWorkout,
  deleteWorkout,
  // 통계
  getStats,
  // 백업 / 복원
  exportAll,
  importAll,
};
