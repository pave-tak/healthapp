import Dexie from "dexie";

// ─── 스키마 ───
// exerciseTypes : 운동 종목 마스터 (기존 exercise_types 대응)
//   { id(auto), category, name, icon, defaultReps, defaultRestSec }
//   unique index: [category+name]
//
// workouts      : 날짜별 운동 기록 (기존 workout_logs + workout_sets 통합)
//   { date(PK, "YYYY-MM-DD"), exercises: [{ id, name, category, sets: [{reps,restSec,done}] }] }
export const db = new Dexie("workout_db");

db.version(1).stores({
  exerciseTypes: "++id, category, name, &[category+name]",
  workouts:      "date",
});

// ─── 기본 시드 데이터 (첫 실행 시 1회 삽입) ───
const DEFAULT_EXERCISES = [
  { category: "상체",   name: "턱걸이",     icon: "💪",   defaultReps: 5,  defaultRestSec: 90 },
  { category: "상체",   name: "푸시업",     icon: "🫸",   defaultReps: 10, defaultRestSec: 60 },
  { category: "상체",   name: "딥스",       icon: "🏋️", defaultReps: 8,  defaultRestSec: 60 },
  { category: "하체",   name: "스쿼트",     icon: "🦵",   defaultReps: 15, defaultRestSec: 60 },
  { category: "하체",   name: "뒷꿈치들기", icon: "🦶",   defaultReps: 20, defaultRestSec: 45 },
  { category: "유산소", name: "달리기",     icon: "🏃",   defaultReps: 1,  defaultRestSec: 0  },
];

export async function ensureSeed() {
  const count = await db.exerciseTypes.count();
  if (count === 0) {
    await db.exerciseTypes.bulkAdd(DEFAULT_EXERCISES);
  }
}

// 개발/리셋용 — 콘솔에서 window.resetDB() 로 호출 가능
if (typeof window !== "undefined") {
  window.resetDB = async () => {
    await db.delete();
    location.reload();
  };
}
