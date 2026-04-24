import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, ChevronLeft, ChevronRight, Dumbbell, Clock, RotateCcw, Check, X, Edit3, ListPlus, Calendar, TrendingUp, Home, History, Settings } from "lucide-react";

// ─── 기본 맨몸운동 데이터 ───
const DEFAULT_EXERCISES = {
  "상체": [
    { name: "턱걸이", icon: "💪", defaultReps: 5, defaultRestSec: 90 },
    { name: "푸시업", icon: "🫸", defaultReps: 10, defaultRestSec: 60 },
    { name: "딥스", icon: "🏋️", defaultReps: 8, defaultRestSec: 60 },
  ],
  "하체": [
    { name: "스쿼트", icon: "🦵", defaultReps: 15, defaultRestSec: 60 },
    { name: "뒷꿈치들기", icon: "🦶", defaultReps: 20, defaultRestSec: 45 },
  ],
  "유산소": [
    { name: "달리기", icon: "🏃", defaultReps: 1, defaultRestSec: 0 },
  ],
};

// ─── 유틸리티 함수 ───
const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const formatDateKor = (dateStr) => {
  const d = new Date(dateStr);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
};

const generateId = () => Math.random().toString(36).substr(2, 9);

// ─── 메인 앱 ───
export default function WorkoutApp() {
  const [tab, setTab] = useState("home");
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [exercises, setExercises] = useState(DEFAULT_EXERCISES);
  const [workoutLog, setWorkoutLog] = useState({});
  const [currentWorkout, setCurrentWorkout] = useState(null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState("상체");
  const [restTimer, setRestTimer] = useState(null);
  const [restSeconds, setRestSeconds] = useState(0);
  const timerRef = useRef(null);
  const [editingSet, setEditingSet] = useState(null);
  const [showStats, setShowStats] = useState(false);

  // 휴식 타이머
  useEffect(() => {
    if (restTimer !== null && restTimer > 0) {
      timerRef.current = setInterval(() => {
        setRestTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [restTimer]);

  const todayLog = workoutLog[selectedDate] || [];

  // 운동의 기본값 조회
  const getExerciseDefaults = (exerciseName) => {
    for (const cat of Object.values(exercises)) {
      const found = cat.find((e) => e.name === exerciseName);
      if (found) return { reps: found.defaultReps || 10, restSec: found.defaultRestSec || 60 };
    }
    return { reps: 10, restSec: 60 };
  };

  // 운동 추가
  const addExerciseToLog = (exerciseName, category) => {
    const defaults = getExerciseDefaults(exerciseName);
    const newEntry = {
      id: generateId(),
      name: exerciseName,
      category,
      sets: [{ reps: defaults.reps, restSec: defaults.restSec, done: false }],
    };
    setWorkoutLog((prev) => ({
      ...prev,
      [selectedDate]: [...(prev[selectedDate] || []), newEntry],
    }));
    setShowExercisePicker(false);
  };

  // 운동 삭제
  const removeExercise = (exerciseId) => {
    setWorkoutLog((prev) => ({
      ...prev,
      [selectedDate]: (prev[selectedDate] || []).filter((e) => e.id !== exerciseId),
    }));
  };

  // 세트 추가
  const addSet = (exerciseId) => {
    setWorkoutLog((prev) => {
      const updated = { ...prev };
      const dayLog = [...(updated[selectedDate] || [])];
      const idx = dayLog.findIndex((e) => e.id === exerciseId);
      if (idx >= 0) {
        const lastSet = dayLog[idx].sets[dayLog[idx].sets.length - 1];
        dayLog[idx] = {
          ...dayLog[idx],
          sets: [...dayLog[idx].sets, { reps: lastSet?.reps || 10, restSec: lastSet?.restSec || 60, done: false }],
        };
      }
      updated[selectedDate] = dayLog;
      return updated;
    });
  };

  // 세트 삭제
  const removeSet = (exerciseId, setIdx) => {
    setWorkoutLog((prev) => {
      const updated = { ...prev };
      const dayLog = [...(updated[selectedDate] || [])];
      const idx = dayLog.findIndex((e) => e.id === exerciseId);
      if (idx >= 0 && dayLog[idx].sets.length > 1) {
        const newSets = dayLog[idx].sets.filter((_, i) => i !== setIdx);
        dayLog[idx] = { ...dayLog[idx], sets: newSets };
      }
      updated[selectedDate] = dayLog;
      return updated;
    });
  };

  // 세트 업데이트
  const updateSet = (exerciseId, setIdx, field, value) => {
    setWorkoutLog((prev) => {
      const updated = { ...prev };
      const dayLog = [...(updated[selectedDate] || [])];
      const idx = dayLog.findIndex((e) => e.id === exerciseId);
      if (idx >= 0) {
        const newSets = [...dayLog[idx].sets];
        newSets[setIdx] = { ...newSets[setIdx], [field]: value };
        dayLog[idx] = { ...dayLog[idx], sets: newSets };
      }
      updated[selectedDate] = dayLog;
      return updated;
    });
  };

  // 세트 완료 토글
  const toggleSetDone = (exerciseId, setIdx) => {
    setWorkoutLog((prev) => {
      const updated = { ...prev };
      const dayLog = [...(updated[selectedDate] || [])];
      const idx = dayLog.findIndex((e) => e.id === exerciseId);
      if (idx >= 0) {
        const newSets = [...dayLog[idx].sets];
        const wasDone = newSets[setIdx].done;
        newSets[setIdx] = { ...newSets[setIdx], done: !wasDone };
        dayLog[idx] = { ...dayLog[idx], sets: newSets };
        if (!wasDone && newSets[setIdx].restSec > 0) {
          setRestTimer(newSets[setIdx].restSec);
          setRestSeconds(newSets[setIdx].restSec);
        }
      }
      updated[selectedDate] = dayLog;
      return updated;
    });
  };

  // 커스텀 운동 추가
  const addCustomExercise = () => {
    if (!customName.trim()) return;
    setExercises((prev) => ({
      ...prev,
      [customCategory]: [...(prev[customCategory] || []), { name: customName.trim(), icon: "🏃" }],
    }));
    setCustomName("");
    setShowAddCustom(false);
  };

  // 날짜 이동
  const moveDate = (days) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(formatDate(d));
  };

  // 통계 계산
  const getStats = () => {
    const dates = Object.keys(workoutLog).sort();
    const totalDays = dates.length;
    let totalSets = 0;
    let totalReps = 0;
    const exerciseCount = {};

    dates.forEach((date) => {
      workoutLog[date].forEach((ex) => {
        exerciseCount[ex.name] = (exerciseCount[ex.name] || 0) + 1;
        ex.sets.forEach((s) => {
          if (s.done) {
            totalSets++;
            totalReps += s.reps;
          }
        });
      });
    });

    const topExercises = Object.entries(exerciseCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { totalDays, totalSets, totalReps, topExercises, dates };
  };

  // 오늘 완료율
  const getTodayProgress = () => {
    if (todayLog.length === 0) return 0;
    let total = 0, done = 0;
    todayLog.forEach((ex) => {
      ex.sets.forEach((s) => { total++; if (s.done) done++; });
    });
    return total > 0 ? Math.round((done / total) * 100) : 0;
  };

  // ─── 휴식 타이머 오버레이 ───
  const RestTimerOverlay = () => {
    if (restTimer === null || restTimer <= 0) return null;
    const pct = ((restSeconds - restTimer) / restSeconds) * 100;
    return (
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.85)", zIndex: 100,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        color: "white",
      }}>
        <Clock size={48} style={{ marginBottom: 16, opacity: 0.7 }} />
        <div style={{ fontSize: 18, opacity: 0.8, marginBottom: 8 }}>휴식 시간</div>
        <div style={{ fontSize: 72, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
          {Math.floor(restTimer / 60)}:{String(restTimer % 60).padStart(2, "0")}
        </div>
        <div style={{
          width: 200, height: 6, background: "rgba(255,255,255,0.2)",
          borderRadius: 3, marginTop: 24, overflow: "hidden",
        }}>
          <div style={{
            width: `${pct}%`, height: "100%",
            background: "linear-gradient(90deg, #4ade80, #22c55e)",
            borderRadius: 3, transition: "width 1s linear",
          }} />
        </div>
        <button
          onClick={() => { setRestTimer(null); clearInterval(timerRef.current); }}
          style={{
            marginTop: 32, padding: "12px 32px", borderRadius: 12,
            background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
            color: "white", fontSize: 16, cursor: "pointer",
          }}
        >건너뛰기</button>
      </div>
    );
  };

  // ─── 홈 탭 ───
  const HomeTab = () => {
    const progress = getTodayProgress();
    const isToday = selectedDate === formatDate(new Date());
    return (
      <div style={{ padding: "0 16px 100px" }}>
        {/* 날짜 선택 */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 0", marginBottom: 8,
        }}>
          <button onClick={() => moveDate(-1)} style={navBtnStyle}>
            <ChevronLeft size={20} />
          </button>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#1e293b" }}>
              {formatDateKor(selectedDate)}
            </div>
            {isToday && <div style={{ fontSize: 12, color: "#22c55e", fontWeight: 600 }}>오늘</div>}
          </div>
          <button onClick={() => moveDate(1)} style={navBtnStyle}>
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 진행률 */}
        {todayLog.length > 0 && (
          <div style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            borderRadius: 16, padding: 20, marginBottom: 16, color: "white",
          }}>
            <div style={{ fontSize: 14, opacity: 0.9, marginBottom: 4 }}>오늘의 진행률</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 36, fontWeight: 800 }}>{progress}%</div>
              <div style={{
                flex: 1, height: 8, background: "rgba(255,255,255,0.3)",
                borderRadius: 4, overflow: "hidden",
              }}>
                <div style={{
                  width: `${progress}%`, height: "100%",
                  background: "white", borderRadius: 4,
                  transition: "width 0.3s ease",
                }} />
              </div>
            </div>
            <div style={{ fontSize: 13, opacity: 0.8, marginTop: 6 }}>
              {todayLog.length}개 운동 · {todayLog.reduce((a, e) => a + e.sets.length, 0)}세트
            </div>
          </div>
        )}

        {/* 운동 목록 */}
        {todayLog.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "60px 20px", color: "#94a3b8",
          }}>
            <Dumbbell size={48} style={{ margin: "0 auto 16px", opacity: 0.4 }} />
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>아직 운동이 없습니다</div>
            <div style={{ fontSize: 14 }}>아래 버튼으로 운동을 추가해보세요</div>
          </div>
        ) : (
          todayLog.map((exercise) => (
            <div key={exercise.id} style={{
              background: "white", borderRadius: 16, marginBottom: 12,
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden",
            }}>
              {/* 운동 헤더 */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px", borderBottom: "1px solid #f1f5f9",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, color: "#64748b", background: "#f1f5f9", borderRadius: 8, padding: "2px 8px" }}>
                    {exercise.category}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#1e293b" }}>{exercise.name}</span>
                </div>
                <button onClick={() => removeExercise(exercise.id)} style={{
                  background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 4,
                }}>
                  <Trash2 size={18} />
                </button>
              </div>

              {/* 세트 헤더 */}
              <div style={{
                display: "grid", gridTemplateColumns: "40px 1fr 1fr 50px 36px",
                padding: "8px 16px", fontSize: 12, color: "#94a3b8", fontWeight: 600,
                gap: 8, alignItems: "center",
              }}>
                <div>세트</div>
                <div>횟수</div>
                <div>휴식(초)</div>
                <div style={{ textAlign: "center" }}>완료</div>
                <div></div>
              </div>

              {/* 세트 목록 */}
              {exercise.sets.map((set, si) => (
                <div key={si} style={{
                  display: "grid", gridTemplateColumns: "40px 1fr 1fr 50px 36px",
                  padding: "6px 16px", gap: 8, alignItems: "center",
                  background: set.done ? "#f0fdf4" : "transparent",
                  transition: "background 0.2s",
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: set.done ? "#22c55e" : "#e2e8f0",
                    color: set.done ? "white" : "#64748b",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700,
                  }}>{si + 1}</div>
                  <input
                    type="number"
                    value={set.reps}
                    onChange={(e) => updateSet(exercise.id, si, "reps", Math.max(0, parseInt(e.target.value) || 0))}
                    style={inputStyle}
                  />
                  <input
                    type="number"
                    value={set.restSec}
                    onChange={(e) => updateSet(exercise.id, si, "restSec", Math.max(0, parseInt(e.target.value) || 0))}
                    style={inputStyle}
                  />
                  <div style={{ textAlign: "center" }}>
                    <button
                      onClick={() => toggleSetDone(exercise.id, si)}
                      style={{
                        width: 36, height: 36, borderRadius: 10, border: "none",
                        background: set.done ? "#22c55e" : "#e2e8f0",
                        color: set.done ? "white" : "#94a3b8",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <Check size={18} />
                    </button>
                  </div>
                  <button
                    onClick={() => removeSet(exercise.id, si)}
                    style={{
                      background: "none", border: "none", color: "#cbd5e1",
                      cursor: "pointer", padding: 4,
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}

              {/* 세트 추가 버튼 */}
              <button
                onClick={() => addSet(exercise.id)}
                style={{
                  width: "100%", padding: "10px", border: "none",
                  background: "#f8fafc", color: "#64748b", fontSize: 14,
                  cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 6,
                }}
              >
                <Plus size={16} /> 세트 추가
              </button>
            </div>
          ))
        )}

        {/* 운동 추가 버튼 */}
        <button
          onClick={() => setShowExercisePicker(true)}
          style={{
            width: "100%", padding: "16px", borderRadius: 16,
            border: "2px dashed #cbd5e1", background: "white",
            color: "#64748b", fontSize: 16, fontWeight: 600,
            cursor: "pointer", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 8, marginTop: 8,
          }}
        >
          <Plus size={20} /> 운동 추가
        </button>
      </div>
    );
  };

  // ─── 기록 탭 ───
  const HistoryTab = () => {
    const dates = Object.keys(workoutLog).sort().reverse();
    return (
      <div style={{ padding: "16px 16px 100px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1e293b", marginBottom: 16 }}>운동 기록</h2>
        {dates.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "#94a3b8" }}>
            <History size={48} style={{ margin: "0 auto 16px", opacity: 0.4 }} />
            <div style={{ fontSize: 16 }}>아직 기록이 없습니다</div>
          </div>
        ) : (
          dates.map((date) => {
            const log = workoutLog[date];
            const totalSets = log.reduce((a, e) => a + e.sets.length, 0);
            const doneSets = log.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0);
            return (
              <div key={date} style={{
                background: "white", borderRadius: 14, padding: 16,
                marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                cursor: "pointer",
              }} onClick={() => { setSelectedDate(date); setTab("home"); }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "#1e293b" }}>
                    {formatDateKor(date)}
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: doneSets === totalSets && totalSets > 0 ? "#22c55e" : "#f59e0b",
                  }}>
                    {doneSets}/{totalSets} 세트
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {log.map((ex) => (
                    <span key={ex.id} style={{
                      background: "#f1f5f9", borderRadius: 8, padding: "4px 10px",
                      fontSize: 13, color: "#475569",
                    }}>
                      {ex.name} ({ex.sets.length}세트)
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  // ─── 통계 탭 ───
  const StatsTab = () => {
    const stats = getStats();
    // 최근 7일 운동일 계산
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = formatDate(d);
      last7.push({
        date: ds,
        day: ["일", "월", "화", "수", "목", "금", "토"][d.getDay()],
        hasWorkout: !!workoutLog[ds],
        sets: workoutLog[ds]?.reduce((a, e) => a + e.sets.filter((s) => s.done).length, 0) || 0,
      });
    }
    const maxSets = Math.max(...last7.map((d) => d.sets), 1);

    return (
      <div style={{ padding: "16px 16px 100px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1e293b", marginBottom: 16 }}>통계</h2>

        {/* 요약 카드 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { label: "운동 일수", value: stats.totalDays, color: "#667eea" },
            { label: "총 세트", value: stats.totalSets, color: "#22c55e" },
            { label: "총 횟수", value: stats.totalReps, color: "#f59e0b" },
          ].map((s) => (
            <div key={s.label} style={{
              background: "white", borderRadius: 14, padding: 16,
              textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* 주간 차트 */}
        <div style={{
          background: "white", borderRadius: 14, padding: 16,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: 20,
        }}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "#1e293b" }}>최근 7일</div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", height: 120, gap: 8 }}>
            {last7.map((d) => (
              <div key={d.date} style={{ flex: 1, textAlign: "center" }}>
                <div style={{
                  height: d.sets > 0 ? Math.max(20, (d.sets / maxSets) * 90) : 4,
                  background: d.hasWorkout
                    ? "linear-gradient(180deg, #667eea, #764ba2)"
                    : "#e2e8f0",
                  borderRadius: 6, marginBottom: 6,
                  transition: "height 0.3s ease",
                }} />
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  color: d.date === formatDate(new Date()) ? "#667eea" : "#94a3b8",
                }}>{d.day}</div>
                {d.sets > 0 && (
                  <div style={{ fontSize: 10, color: "#64748b" }}>{d.sets}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 자주 하는 운동 */}
        {stats.topExercises.length > 0 && (
          <div style={{
            background: "white", borderRadius: 14, padding: 16,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: "#1e293b" }}>자주 하는 운동</div>
            {stats.topExercises.map(([name, count], i) => (
              <div key={name} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: i < stats.topExercises.length - 1 ? "1px solid #f1f5f9" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: ["#667eea", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"][i],
                    color: "white", fontSize: 13, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{i + 1}</div>
                  <span style={{ fontSize: 15, fontWeight: 600, color: "#334155" }}>{name}</span>
                </div>
                <span style={{ fontSize: 14, color: "#94a3b8" }}>{count}회</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── 설정 탭 ───
  const SettingsTab = () => {
    const updateExerciseDefault = (category, exIdx, field, value) => {
      setExercises((prev) => {
        const updated = { ...prev };
        const catList = [...updated[category]];
        catList[exIdx] = { ...catList[exIdx], [field]: Math.max(1, parseInt(value) || 1) };
        updated[category] = catList;
        return updated;
      });
    };

    return (
      <div style={{ padding: "16px 16px 100px" }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#1e293b", marginBottom: 6 }}>설정</h2>
        <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 20 }}>
          운동별 기본 횟수와 휴식시간을 설정합니다. 새 세트 추가 시 이 값이 적용됩니다.
        </p>

        {Object.entries(exercises).map(([category, exList]) => (
          <div key={category} style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 14, fontWeight: 700, color: "#64748b",
              marginBottom: 10, paddingLeft: 4,
            }}>{category}</div>

            {exList.map((ex, ei) => (
              <div key={ex.name} style={{
                background: "white", borderRadius: 14, padding: 16,
                marginBottom: 8, boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
              }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", marginBottom: 12 }}>
                  {ex.icon} {ex.name}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>기본 횟수</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        onClick={() => updateExerciseDefault(category, ei, "defaultReps", (ex.defaultReps || 10) - 1)}
                        style={stepBtnStyle}
                      >−</button>
                      <input
                        type="number"
                        value={ex.defaultReps || 10}
                        onChange={(e) => updateExerciseDefault(category, ei, "defaultReps", e.target.value)}
                        style={{ ...settingsInputStyle, flex: 1 }}
                      />
                      <button
                        onClick={() => updateExerciseDefault(category, ei, "defaultReps", (ex.defaultReps || 10) + 1)}
                        style={stepBtnStyle}
                      >+</button>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 600 }}>휴식(초)</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button
                        onClick={() => updateExerciseDefault(category, ei, "defaultRestSec", (ex.defaultRestSec || 60) - 5)}
                        style={stepBtnStyle}
                      >−</button>
                      <input
                        type="number"
                        value={ex.defaultRestSec || 60}
                        onChange={(e) => updateExerciseDefault(category, ei, "defaultRestSec", e.target.value)}
                        style={{ ...settingsInputStyle, flex: 1 }}
                      />
                      <button
                        onClick={() => updateExerciseDefault(category, ei, "defaultRestSec", (ex.defaultRestSec || 60) + 5)}
                        style={stepBtnStyle}
                      >+</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const stepBtnStyle = {
    width: 36, height: 36, borderRadius: 10, border: "1px solid #e2e8f0",
    background: "#f8fafc", fontSize: 18, fontWeight: 700, color: "#475569",
    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  };

  const settingsInputStyle = {
    width: "100%", padding: "8px 6px", borderRadius: 10,
    border: "1px solid #e2e8f0", fontSize: 16, textAlign: "center",
    outline: "none", fontVariantNumeric: "tabular-nums", background: "white",
  };

  // ─── 운동 선택 모달 ───
  const ExercisePicker = () => {
    if (!showExercisePicker) return null;
    return (
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.5)", zIndex: 50,
        display: "flex", flexDirection: "column", justifyContent: "flex-end",
      }}>
        <div style={{
          background: "white", borderRadius: "20px 20px 0 0",
          maxHeight: "80vh", overflow: "auto", padding: "20px 16px",
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginBottom: 16,
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "#1e293b" }}>운동 선택</h3>
            <button onClick={() => setShowExercisePicker(false)} style={{
              background: "#f1f5f9", border: "none", borderRadius: 10,
              width: 36, height: 36, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}>
              <X size={18} />
            </button>
          </div>

          {Object.entries(exercises).map(([category, exList]) => (
            <div key={category} style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 14, fontWeight: 700, color: "#64748b",
                marginBottom: 8, paddingLeft: 4,
              }}>{category}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {exList.map((ex) => (
                  <button
                    key={ex.name}
                    onClick={() => addExerciseToLog(ex.name, category)}
                    style={{
                      padding: "10px 16px", borderRadius: 12,
                      border: "1px solid #e2e8f0", background: "white",
                      fontSize: 14, cursor: "pointer", color: "#334155",
                      fontWeight: 500,
                      transition: "all 0.15s",
                    }}
                    onMouseDown={(e) => { e.currentTarget.style.background = "#f1f5f9"; }}
                    onMouseUp={(e) => { e.currentTarget.style.background = "white"; }}
                  >
                    {ex.icon} {ex.name}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* 커스텀 운동 추가 */}
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 16, marginTop: 8 }}>
            {!showAddCustom ? (
              <button
                onClick={() => setShowAddCustom(true)}
                style={{
                  width: "100%", padding: 14, borderRadius: 12,
                  border: "2px dashed #cbd5e1", background: "transparent",
                  color: "#64748b", fontSize: 15, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 8,
                }}
              >
                <ListPlus size={18} /> 직접 추가
              </button>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="운동 이름 입력"
                  style={{
                    padding: "12px 16px", borderRadius: 12,
                    border: "1px solid #e2e8f0", fontSize: 15,
                    outline: "none",
                  }}
                  autoFocus
                />
                <div style={{ display: "flex", gap: 8 }}>
                  {Object.keys(exercises).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCustomCategory(cat)}
                      style={{
                        padding: "8px 16px", borderRadius: 10, border: "none",
                        background: customCategory === cat ? "#667eea" : "#f1f5f9",
                        color: customCategory === cat ? "white" : "#64748b",
                        fontSize: 14, fontWeight: 600, cursor: "pointer",
                      }}
                    >{cat}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addCustomExercise} style={{
                    flex: 1, padding: 12, borderRadius: 12, border: "none",
                    background: "#22c55e", color: "white", fontSize: 15,
                    fontWeight: 600, cursor: "pointer",
                  }}>추가</button>
                  <button onClick={() => setShowAddCustom(false)} style={{
                    padding: "12px 20px", borderRadius: 12, border: "none",
                    background: "#f1f5f9", color: "#64748b", fontSize: 15,
                    cursor: "pointer",
                  }}>취소</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── 스타일 ───
  const navBtnStyle = {
    background: "#f1f5f9", border: "none", borderRadius: 10,
    width: 40, height: 40, display: "flex", alignItems: "center",
    justifyContent: "center", cursor: "pointer", color: "#475569",
  };

  const inputStyle = {
    width: "100%", padding: "8px 10px", borderRadius: 10,
    border: "1px solid #e2e8f0", fontSize: 15, textAlign: "center",
    outline: "none", fontVariantNumeric: "tabular-nums",
    background: "#f8fafc",
  };

  // ─── 렌더링 ───
  return (
    <div style={{
      maxWidth: 480, margin: "0 auto", minHeight: "100vh",
      background: "#f8fafc", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      position: "relative",
    }}>
      {/* 헤더 */}
      <div style={{
        background: "white", padding: "16px 20px",
        borderBottom: "1px solid #f1f5f9",
        position: "sticky", top: 0, zIndex: 30,
      }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #667eea, #764ba2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Dumbbell size={20} color="white" />
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1e293b" }}>운동 관리</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>매일 조금씩, 꾸준하게</div>
          </div>
        </div>
      </div>

      {/* 콘텐츠 */}
      {tab === "home" && <HomeTab />}
      {tab === "history" && <HistoryTab />}
      {tab === "stats" && <StatsTab />}
      {tab === "settings" && <SettingsTab />}

      {/* 하단 탭바 */}
      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
        width: "100%", maxWidth: 480,
        background: "white", borderTop: "1px solid #f1f5f9",
        display: "flex", justifyContent: "space-around",
        padding: "8px 0 20px", zIndex: 30,
      }}>
        {[
          { id: "home", label: "오늘", icon: Home },
          { id: "history", label: "기록", icon: Calendar },
          { id: "stats", label: "통계", icon: TrendingUp },
          { id: "settings", label: "설정", icon: Settings },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center",
              gap: 4, padding: "4px 16px", color: tab === t.id ? "#667eea" : "#94a3b8",
              transition: "color 0.2s",
            }}
          >
            <t.icon size={22} />
            <span style={{ fontSize: 11, fontWeight: 600 }}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* 모달 */}
      <ExercisePicker />
      <RestTimerOverlay />
    </div>
  );
}