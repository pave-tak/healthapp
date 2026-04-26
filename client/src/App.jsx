import { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Trash2, ChevronLeft, ChevronRight, Dumbbell,
  Clock, Check, X, ListPlus, Calendar, TrendingUp,
  Home, History, Settings,
} from "lucide-react";
import { api } from "./api/index.js";

// ─── 유틸 ───
const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};
const formatDateKor = (dateStr) => {
  const d = new Date(dateStr + "T00:00:00");
  const days = ["일","월","화","수","목","금","토"];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
};
const genId = () => Math.random().toString(36).substr(2, 9);

// 알람용 PCM WAV(beep) 를 base64 data URI 로 생성. WebAudio 가 막히는 환경에서
// HTMLAudioElement 백업 채널로 사용한다.
function makeBeepDataUri({ freq = 880, ms = 700, vol = 0.7, sampleRate = 22050 } = {}) {
  const samples = Math.floor((ms / 1000) * sampleRate);
  const buf = new ArrayBuffer(44 + samples * 2);
  const dv  = new DataView(buf);
  let p = 0;
  const writeStr = (s) => { for (let i = 0; i < s.length; i++) dv.setUint8(p++, s.charCodeAt(i)); };
  writeStr("RIFF"); dv.setUint32(p, 36 + samples * 2, true); p += 4;
  writeStr("WAVEfmt "); dv.setUint32(p, 16, true); p += 4;
  dv.setUint16(p, 1, true); p += 2;
  dv.setUint16(p, 1, true); p += 2;
  dv.setUint32(p, sampleRate, true); p += 4;
  dv.setUint32(p, sampleRate * 2, true); p += 4;
  dv.setUint16(p, 2, true); p += 2;
  dv.setUint16(p, 16, true); p += 2;
  writeStr("data"); dv.setUint32(p, samples * 2, true); p += 4;
  const beepLen = Math.floor(sampleRate * 0.18);
  const gapLen  = Math.floor(sampleRate * 0.08);
  for (let i = 0; i < samples; i++) {
    const cycle  = beepLen + gapLen;
    const phase  = i % cycle;
    let v = 0;
    if (phase < beepLen) {
      const env = Math.min(1, phase / 200, (beepLen - phase) / 800);
      v = Math.sin(2 * Math.PI * freq * (i / sampleRate)) * vol * env;
    }
    dv.setInt16(p, Math.max(-1, Math.min(1, v)) * 32767, true); p += 2;
  }
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return "data:audio/wav;base64," + btoa(bin);
}
const ALARM_DATA_URI = makeBeepDataUri({ freq: 880, ms: 1100, vol: 0.7 });

// 숫자 입력: 타이핑 중에는 외부 상태를 갱신하지 않고, 포커스가 빠질 때(blur) 한 번만
// 반영한다. 빈 문자열로 끝나면 이전 값으로 되돌린다.
function NumberField({ value, onChange, min = 0, style }) {
  const [text, setText] = useState(String(value ?? ""));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setText(String(value ?? ""));
  }, [value]);

  return (
    <input
      type="number"
      inputMode="numeric"
      enterKeyHint="done"
      value={text}
      onFocus={() => { focusedRef.current = true; }}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur(); // 키보드의 완료/엔터 → blur 강제 → commit
        }
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        const raw = e.target.value;
        if (raw === "" || isNaN(parseInt(raw, 10))) {
          setText(String(value ?? ""));
          return;
        }
        const n = Math.max(min, parseInt(raw, 10));
        setText(String(n));
        if (n !== value) onChange(n);
      }}
      style={style}
    />
  );
}

// ─── 다크 테마 팔레트 ───
const T = {
  surface:      "rgba(30,41,59,0.7)",      // 카드 배경 (반투명)
  surfaceSolid: "#1e293b",                 // 카드 배경 (불투명)
  surfaceAlt:   "#334155",                 // 칩/버튼 비활성 배경
  inputBg:      "#0f172a",                 // 인풋 배경
  border:       "rgba(148,163,184,0.18)",  // 기본 테두리
  borderStrong: "#334155",                 // 강한 테두리
  text:         "#f1f5f9",                 // 기본 텍스트
  textDim:      "#cbd5e1",                 // 보조 텍스트
  textMuted:    "#94a3b8",                 // 희미한 텍스트
  accent:       "#a5b4fc",                 // 포인트 (인디고-300)
  accentStrong: "#818cf8",                 // 인디고-400
  doneRow:      "rgba(34,197,94,0.12)",    // 완료 행 배경
};

// ─── 스타일 상수 ───
const S = {
  navBtn:    { background:T.surfaceAlt, border:"none", borderRadius:10, width:40, height:40, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:T.textDim },
  input:     { width:"100%", padding:"8px 10px", borderRadius:10, border:`1px solid ${T.borderStrong}`, fontSize:15, textAlign:"center", outline:"none", fontVariantNumeric:"tabular-nums", background:T.inputBg, color:T.text },
  stepBtn:   { width:36, height:36, borderRadius:10, border:`1px solid ${T.borderStrong}`, background:T.inputBg, fontSize:18, fontWeight:700, color:T.textDim, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" },
  settInput: { width:"100%", padding:"8px 6px", borderRadius:10, border:`1px solid ${T.borderStrong}`, fontSize:16, textAlign:"center", outline:"none", fontVariantNumeric:"tabular-nums", background:T.inputBg, color:T.text },
  // 세트 행 인라인 스테퍼 ( [-] input [+] )
  stepper:   { display:"flex", alignItems:"stretch", minWidth:0, border:`1px solid ${T.borderStrong}`, borderRadius:10, overflow:"hidden", background:T.inputBg, height:36 },
  stepSide:  { width:32, background:"rgba(99,102,241,0.18)", border:"none", cursor:"pointer", fontSize:20, fontWeight:700, color:T.accent, padding:0, lineHeight:1, flexShrink:0, touchAction:"manipulation", userSelect:"none" },
  stepInput: { flex:1, width:0, minWidth:0, padding:"0 2px", border:"none", fontSize:14, textAlign:"center", outline:"none", fontVariantNumeric:"tabular-nums", fontWeight:600, background:T.inputBg, color:T.text },
  card:      { background:T.surface, borderRadius:16, boxShadow:"0 4px 20px rgba(0,0,0,0.25)", border:`1px solid ${T.border}`, backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)" },
};

export default function App() {
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [tab, setTab]                 = useState("home");
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [exercises, setExercises]     = useState({});
  const [workoutLog, setWorkoutLog]   = useState({});
  const [showPicker, setShowPicker]   = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName]   = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [restTimer, setRestTimer]     = useState(null);
  const [restSeconds, setRestSeconds] = useState(0);
  const timerRef    = useRef(null);
  const audioCtxRef = useRef(null);
  const alarmAudioRef = useRef(null);
  const audioUnlockedRef = useRef(false);
  const saveTimerRef = useRef(null);
  const savingRef   = useRef(false);
  const dateInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const openDatePicker = () => {
    const el = dateInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") el.showPicker();
    else el.click();
  };

  // ─── 백업 / 복원 ───
  const handleExport = async () => {
    try {
      const data = await api.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url  = URL.createObjectURL(blob);
      const ts = new Date().toISOString().replace(/[:-]/g, "").replace(/\..+/, "").replace("T", "-");
      const a = document.createElement("a");
      a.href = url;
      a.download = `workout-backup-${ts}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      alert("백업 실패: " + err.message);
    }
  };

  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 다시 선택 허용
    if (!file) return;
    let data;
    try {
      const text = await file.text();
      data = JSON.parse(text);
    } catch {
      alert("JSON 파일이 아닙니다.");
      return;
    }
    const exCount = Array.isArray(data?.exerciseTypes) ? data.exerciseTypes.length : 0;
    const wkCount = Array.isArray(data?.workouts)      ? data.workouts.length      : 0;
    const ok = window.confirm(
      `현재 기기의 모든 데이터가 이 백업으로 덮어써집니다.\n\n` +
      `· 운동 종목: ${exCount}개\n· 운동 기록: ${wkCount}일\n\n계속하시겠습니까?`
    );
    if (!ok) return;
    try {
      await api.importAll(data);
      alert("복원 완료! 페이지를 새로고침합니다.");
      location.reload();
    } catch (err) {
      alert("복원 실패: " + err.message);
    }
  };

  // ─── 초기 데이터 로드 ───
  useEffect(() => {
    (async () => {
      try {
        const [exData, logData] = await Promise.all([
          api.getExercises(),
          api.getAllWorkouts(),
        ]);
        setExercises(exData);
        setWorkoutLog(logData);
        const cats = Object.keys(exData);
        if (cats.length) setCustomCategory(cats[0]);
      } catch (err) {
        setError("서버에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // ─── workoutLog 변경 시 자동 저장 (디바운스 500ms) ───
  const lastSavedRef = useRef({});
  useEffect(() => {
    if (loading) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      for (const [date, dayLog] of Object.entries(workoutLog)) {
        const key = JSON.stringify(dayLog);
        if (lastSavedRef.current[date] === key) continue;
        try {
          await api.saveWorkout(date, dayLog);
          lastSavedRef.current[date] = key;
        } catch (err) {
          console.error("저장 실패:", err);
        }
      }
    }, 500);
  }, [workoutLog, loading]);

  // ─── 오디오(비프) / 진동 유틸 ───
  // 첫 재생은 반드시 사용자 제스처 안에서 getAudioCtx() 를 한 번 호출해 context 를
  // 깨워야 한다(모바일 자동재생 정책). toggleDone 에서 arming 한다.
  const getAudioCtx = () => {
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) audioCtxRef.current = new Ctx();
    }
    const c = audioCtxRef.current;
    if (c && c.state === "suspended") c.resume();
    return c;
  };
  const beep = (freq = 880, duration = 0.15, gain = 0.3) => {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(g); g.connect(ctx.destination);
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.start(t0);
    osc.stop(t0 + duration);
  };
  const vibrate = (p) => { if (navigator.vibrate) navigator.vibrate(p); };

  // 안드로이드 WebView 등에서 WebAudio 가 막히는 경우를 위한 백업: HTMLAudioElement 로
  // WAV data URI 를 재생. 첫 사용자 제스처에서 unlock(짧게 play→pause)해 둬야 한다.
  const getAlarmAudio = () => {
    if (!alarmAudioRef.current) {
      const a = new Audio(ALARM_DATA_URI);
      a.preload = "auto";
      alarmAudioRef.current = a;
    }
    return alarmAudioRef.current;
  };
  const unlockAudio = () => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    const a = getAlarmAudio();
    a.muted = true;
    const p = a.play();
    if (p && typeof p.then === "function") {
      p.then(() => { a.pause(); a.currentTime = 0; a.muted = false; })
       .catch(() => { a.muted = false; audioUnlockedRef.current = false; });
    } else {
      a.pause(); a.currentTime = 0; a.muted = false;
    }
  };
  const playAlarm = () => {
    const a = getAlarmAudio();
    try { a.currentTime = 0; } catch { /* noop */ }
    const p = a.play();
    if (p && typeof p.catch === "function") p.catch(() => { /* 정책 차단 등 무시 */ });
  };

  // ─── 휴식 타이머 ───
  useEffect(() => {
    if (restTimer !== null && restTimer > 0) {
      timerRef.current = setInterval(() => {
        setRestTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            // 완료 알람: WebAudio 비프 4연속 + HTMLAudio 백업 알람 + 진동
            beep(880, 0.18, 0.6);
            setTimeout(() => beep(880, 0.18, 0.6), 230);
            setTimeout(() => beep(880, 0.18, 0.6), 460);
            setTimeout(() => beep(1320, 0.6,  0.6), 760);
            playAlarm();
            vibrate([250, 120, 250, 120, 250, 120, 500]);
            // 1.8초간 "완료!" 표시 후 자동 닫힘
            setTimeout(() => setRestTimer(null), 1800);
            return 0;
          }
          // 마지막 3초(3,2,1 표시) 카운트다운 비프 — 더 또렷하게
          if (prev >= 2 && prev <= 4) beep(660, 0.12, 0.45);
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [restTimer]);

  const todayLog = workoutLog[selectedDate] || [];

  const getDefaults = (name) => {
    for (const cat of Object.values(exercises)) {
      const f = cat.find((e) => e.name === name);
      if (f) return { reps: f.defaultReps || 10, restSec: f.defaultRestSec || 60 };
    }
    return { reps: 10, restSec: 60 };
  };

  // ─── 운동 조작 ───
  const addExercise = (name, category) => {
    const def = getDefaults(name);
    setWorkoutLog((prev) => ({
      ...prev,
      [selectedDate]: [...(prev[selectedDate] || []),
        { id: genId(), name, category, sets: [{ reps: def.reps, restSec: def.restSec, done: false }] }],
    }));
    setShowPicker(false);
  };

  const removeExercise = (id) => {
    setWorkoutLog((prev) => ({
      ...prev,
      [selectedDate]: (prev[selectedDate] || []).filter((e) => e.id !== id),
    }));
  };

  const addSet = (exerciseId) => {
    setWorkoutLog((prev) => {
      const u = { ...prev };
      const dl = [...(u[selectedDate] || [])];
      const i = dl.findIndex((e) => e.id === exerciseId);
      if (i >= 0) {
        const ls = dl[i].sets[dl[i].sets.length - 1];
        dl[i] = { ...dl[i], sets: [...dl[i].sets, { reps: ls?.reps || 10, restSec: ls?.restSec || 60, done: false }] };
      }
      u[selectedDate] = dl;
      return u;
    });
  };

  const removeSet = (exerciseId, si) => {
    setWorkoutLog((prev) => {
      const u = { ...prev };
      const dl = [...(u[selectedDate] || [])];
      const i = dl.findIndex((e) => e.id === exerciseId);
      if (i >= 0 && dl[i].sets.length > 1)
        dl[i] = { ...dl[i], sets: dl[i].sets.filter((_, j) => j !== si) };
      u[selectedDate] = dl;
      return u;
    });
  };

  const updateSet = (exerciseId, si, field, value) => {
    setWorkoutLog((prev) => {
      const u = { ...prev };
      const dl = [...(u[selectedDate] || [])];
      const i = dl.findIndex((e) => e.id === exerciseId);
      if (i >= 0) {
        const ns = [...dl[i].sets];
        ns[si] = { ...ns[si], [field]: value };
        dl[i] = { ...dl[i], sets: ns };
      }
      u[selectedDate] = dl;
      return u;
    });
  };

  const toggleDone = (exerciseId, si) => {
    setWorkoutLog((prev) => {
      const u = { ...prev };
      const dl = [...(u[selectedDate] || [])];
      const i = dl.findIndex((e) => e.id === exerciseId);
      if (i >= 0) {
        const ns = [...dl[i].sets];
        const was = ns[si].done;
        ns[si] = { ...ns[si], done: !was };
        dl[i] = { ...dl[i], sets: ns };
        if (!was && ns[si].restSec > 0) {
          getAudioCtx(); // 사용자 제스처 안에서 오디오 컨텍스트 깨우기
          unlockAudio(); // HTMLAudio 백업 채널도 첫 제스처에서 unlock
          // 시작음: 짧은 상승 비프 (도→솔)
          beep(523, 0.09, 0.35);
          setTimeout(() => beep(784, 0.12, 0.35), 100);
          vibrate(80);
          setRestTimer(ns[si].restSec);
          setRestSeconds(ns[si].restSec);
        }
      }
      u[selectedDate] = dl;
      return u;
    });
  };

  const addCustomExercise = async () => {
    if (!customName.trim()) return;
    try {
      await api.addExercise({ category: customCategory, name: customName.trim(), icon: "🏃", defaultReps: 10, defaultRestSec: 60 });
      const updated = await api.getExercises();
      setExercises(updated);
      setCustomName("");
      setShowAddCustom(false);
    } catch (err) {
      alert("운동 추가 실패: " + err.message);
    }
  };

  const updateExerciseDefault = async (exItem, field, value) => {
    if (!exItem.id) return;
    const update = {
      defaultReps:    field === "defaultReps"    ? Math.max(1, parseInt(value) || 1) : exItem.defaultReps,
      defaultRestSec: field === "defaultRestSec" ? Math.max(0, parseInt(value) || 0) : exItem.defaultRestSec,
    };
    setExercises((prev) => {
      const u = { ...prev };
      for (const cat of Object.keys(u)) {
        const idx = u[cat].findIndex((e) => e.id === exItem.id);
        if (idx >= 0) {
          const list = [...u[cat]];
          list[idx] = { ...list[idx], ...update };
          u[cat] = list;
          break;
        }
      }
      return u;
    });
    try {
      await api.updateExercise(exItem.id, update);
    } catch (err) {
      console.error("설정 저장 실패:", err);
    }
  };

  const moveDate = (days) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + days);
    setSelectedDate(formatDate(d));
  };

  const getProgress = () => {
    if (!todayLog.length) return 0;
    let t = 0, d = 0;
    todayLog.forEach((ex) => ex.sets.forEach((s) => { t++; if (s.done) d++; }));
    return t > 0 ? Math.round((d / t) * 100) : 0;
  };

  // ─── 로딩 / 에러 화면 ───
  if (loading) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", color:T.textDim }}>
        <div style={{ width:40, height:40, border:`3px solid ${T.borderStrong}`, borderTopColor:T.accent, borderRadius:"50%", animation:"spin 0.8s linear infinite", marginBottom:16 }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div>서버 연결 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", minHeight:"100vh", color:T.textDim, padding:24, textAlign:"center" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>⚠️</div>
        <div style={{ fontSize:16, fontWeight:600, marginBottom:8, color:"#f87171" }}>{error}</div>
        <button onClick={() => window.location.reload()} style={{ marginTop:16, padding:"10px 24px", borderRadius:12, border:"none", background:"#6366f1", color:"white", fontSize:15, cursor:"pointer" }}>
          다시 시도
        </button>
      </div>
    );
  }

  const isToday = selectedDate === formatDate(new Date());
  const progress = getProgress();

  // ─── 홈 탭 ───
  const HomeTab = () => (
    <div style={{ padding:"0 16px 100px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 0", marginBottom:8, position:"relative" }}>
        <button onClick={() => moveDate(-1)} style={S.navBtn}><ChevronLeft size={20}/></button>
        <button
          onClick={openDatePicker}
          title="날짜 선택"
          style={{ background:T.surface, border:`1px solid ${T.border}`, borderRadius:12, padding:"6px 14px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, backdropFilter:"blur(6px)", WebkitBackdropFilter:"blur(6px)" }}
        >
          <div style={{ fontSize:18, fontWeight:700, display:"flex", alignItems:"center", gap:6, color:T.text }}>
            <Calendar size={15} color={T.accent}/>
            {formatDateKor(selectedDate)}
          </div>
          {isToday
            ? <div style={{ fontSize:12, color:"#4ade80", fontWeight:600 }}>오늘</div>
            : <div style={{ fontSize:11, color:T.textMuted }}>{selectedDate}</div>}
        </button>
        <button onClick={() => moveDate(1)} style={S.navBtn}><ChevronRight size={20}/></button>
        <input
          ref={dateInputRef}
          type="date"
          value={selectedDate}
          max={formatDate(new Date())}
          onChange={(e) => { if (e.target.value) setSelectedDate(e.target.value); }}
          className="date-hidden"
        />
      </div>

      {todayLog.length > 0 && (
        <div style={{ background:"linear-gradient(135deg,#6366f1 0%,#8b5cf6 50%,#ec4899 100%)", borderRadius:16, padding:20, marginBottom:16, color:"white", boxShadow:"0 10px 30px rgba(99,102,241,0.35)" }}>
          <div style={{ fontSize:14, opacity:0.9, marginBottom:4 }}>오늘의 진행률</div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div style={{ fontSize:36, fontWeight:800 }}>{progress}%</div>
            <div style={{ flex:1, height:8, background:"rgba(255,255,255,0.25)", borderRadius:4, overflow:"hidden" }}>
              <div style={{ width:`${progress}%`, height:"100%", background:"white", borderRadius:4, transition:"width 0.3s ease" }}/>
            </div>
          </div>
          <div style={{ fontSize:13, opacity:0.85, marginTop:6 }}>
            {todayLog.length}개 운동 · {todayLog.reduce((a,e) => a+e.sets.length, 0)}세트
          </div>
        </div>
      )}

      {todayLog.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 20px", color:T.textMuted }}>
          <Dumbbell size={48} style={{ margin:"0 auto 16px", opacity:0.4 }}/>
          <div style={{ fontSize:16, fontWeight:600, marginBottom:8 }}>아직 운동이 없습니다</div>
          <div style={{ fontSize:14 }}>아래 버튼으로 운동을 추가해보세요</div>
        </div>
      ) : todayLog.map((exercise) => (
        <div key={exercise.id} style={{ ...S.card, marginBottom:12, overflow:"hidden" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 16px", borderBottom:`1px solid ${T.border}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:13, color:T.textDim, background:T.surfaceAlt, borderRadius:8, padding:"2px 8px" }}>{exercise.category}</span>
              <span style={{ fontSize:16, fontWeight:700, color:T.text }}>{exercise.name}</span>
            </div>
            <button onClick={() => removeExercise(exercise.id)} style={{ background:"none", border:"none", cursor:"pointer", padding:4 }}>
              <Trash2 size={18} color="#f87171"/>
            </button>
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"28px 1fr 1fr 36px 20px", padding:"8px 12px", fontSize:12, color:T.textMuted, fontWeight:600, gap:6 }}>
            <div style={{ textAlign:"center" }}>세트</div>
            <div style={{ textAlign:"center" }}>횟수</div>
            <div style={{ textAlign:"center" }}>휴식(초)</div>
            <div style={{ textAlign:"center" }}>완료</div>
            <div/>
          </div>

          {exercise.sets.map((set, si) => (
            <div key={si} style={{ display:"grid", gridTemplateColumns:"28px 1fr 1fr 36px 20px", padding:"6px 12px", gap:6, alignItems:"center", background:set.done?T.doneRow:"transparent", transition:"background 0.2s" }}>
              <div style={{ width:26, height:26, borderRadius:"50%", background:set.done?"#22c55e":T.surfaceAlt, color:set.done?"white":T.textDim, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, justifySelf:"center" }}>{si+1}</div>

              <div style={S.stepper}>
                <button type="button" onClick={() => updateSet(exercise.id, si, "reps", Math.max(0, (set.reps||0) - 1))} style={S.stepSide}>−</button>
                <NumberField value={set.reps}
                  onChange={(n) => updateSet(exercise.id, si, "reps", n)}
                  style={S.stepInput}/>
                <button type="button" onClick={() => updateSet(exercise.id, si, "reps", (set.reps||0) + 1)} style={S.stepSide}>+</button>
              </div>

              <div style={S.stepper}>
                <button type="button" onClick={() => updateSet(exercise.id, si, "restSec", Math.max(0, (set.restSec||0) - 5))} style={S.stepSide}>−</button>
                <NumberField value={set.restSec}
                  onChange={(n) => updateSet(exercise.id, si, "restSec", n)}
                  style={S.stepInput}/>
                <button type="button" onClick={() => updateSet(exercise.id, si, "restSec", (set.restSec||0) + 5)} style={S.stepSide}>+</button>
              </div>

              <div style={{ textAlign:"center" }}>
                <button onClick={() => toggleDone(exercise.id, si)} style={{ width:34, height:34, borderRadius:10, border:"none", background:set.done?"#22c55e":T.surfaceAlt, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Check size={18} color={set.done?"white":T.textMuted}/>
                </button>
              </div>
              <button onClick={() => removeSet(exercise.id, si)} style={{ background:"none", border:"none", cursor:"pointer", padding:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                <X size={14} color={T.textMuted}/>
              </button>
            </div>
          ))}

          <button onClick={() => addSet(exercise.id)} style={{ width:"100%", padding:10, border:"none", background:"rgba(15,23,42,0.5)", color:T.textDim, fontSize:14, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
            <Plus size={16}/> 세트 추가
          </button>
        </div>
      ))}

      <button onClick={() => setShowPicker(true)} style={{ width:"100%", padding:16, borderRadius:16, border:`2px dashed ${T.borderStrong}`, background:"rgba(30,41,59,0.4)", color:T.textDim, fontSize:16, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:8 }}>
        <Plus size={20}/> 운동 추가
      </button>
    </div>
  );

  // ─── 기록 탭 ───
  const HistoryTab = () => {
    const dates = Object.keys(workoutLog).filter((d) => workoutLog[d].length > 0).sort().reverse();
    return (
      <div style={{ padding:"16px 16px 100px" }}>
        <h2 style={{ fontSize:20, fontWeight:800, marginBottom:16, color:T.text }}>운동 기록</h2>
        {dates.length === 0 ? (
          <div style={{ textAlign:"center", padding:"60px 20px", color:T.textMuted }}>
            <History size={48} style={{ margin:"0 auto 16px", opacity:0.4 }}/>
            <div style={{ fontSize:16 }}>아직 기록이 없습니다</div>
          </div>
        ) : dates.map((date) => {
          const log = workoutLog[date];
          const ts = log.reduce((a,e) => a+e.sets.length, 0);
          const ds = log.reduce((a,e) => a+e.sets.filter((s) => s.done).length, 0);
          return (
            <div key={date} onClick={() => { setSelectedDate(date); setTab("home"); }}
              style={{ ...S.card, padding:16, marginBottom:10, cursor:"pointer" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                <div style={{ fontWeight:700, fontSize:16, color:T.text }}>{formatDateKor(date)}</div>
                <div style={{ fontSize:13, fontWeight:600, color:ds===ts&&ts>0?"#4ade80":"#fbbf24" }}>{ds}/{ts} 세트</div>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                {log.map((ex) => (
                  <span key={ex.id} style={{ background:T.surfaceAlt, borderRadius:8, padding:"4px 10px", fontSize:13, color:T.textDim }}>
                    {ex.name} ({ex.sets.length}세트)
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── 통계 탭 ───
  const StatsTab = () => {
    const [stats, setStats] = useState(null);
    const [statLoading, setStatLoading] = useState(true);

    useEffect(() => {
      api.getStats().then((d) => { setStats(d); setStatLoading(false); }).catch(() => setStatLoading(false));
    }, []);

    if (statLoading) return <div style={{ padding:40, textAlign:"center", color:T.textMuted }}>통계 불러오는 중...</div>;
    if (!stats) return null;

    const maxSets = Math.max(...stats.last7.map((d) => d.doneSets), 1);
    const today = formatDate(new Date());

    return (
      <div style={{ padding:"16px 16px 100px" }}>
        <h2 style={{ fontSize:20, fontWeight:800, marginBottom:16, color:T.text }}>통계</h2>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:20 }}>
          {[
            { label:"운동 일수", value:stats.totalDays,  color:"#a5b4fc" },
            { label:"총 세트",   value:stats.totalSets,  color:"#4ade80" },
            { label:"총 횟수",   value:stats.totalReps,  color:"#fbbf24" },
          ].map((s) => (
            <div key={s.label} style={{ ...S.card, padding:16, textAlign:"center" }}>
              <div style={{ fontSize:24, fontWeight:800, color:s.color }}>{s.value}</div>
              <div style={{ fontSize:12, color:T.textMuted, marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ ...S.card, padding:16, marginBottom:20 }}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:16, color:T.text }}>최근 7일</div>
          <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between", height:120, gap:8 }}>
            {stats.last7.map((d) => {
              const dt = new Date(d.date + "T00:00:00");
              const dayLabel = ["일","월","화","수","목","금","토"][dt.getDay()];
              return (
                <div key={d.date} style={{ flex:1, textAlign:"center" }}>
                  <div style={{
                    height: d.doneSets > 0 ? Math.max(20,(d.doneSets/maxSets)*90) : 4,
                    background: d.doneSets > 0 ? "linear-gradient(180deg,#818cf8,#c084fc)" : T.surfaceAlt,
                    borderRadius:6, marginBottom:6, transition:"height 0.3s ease",
                    boxShadow: d.doneSets > 0 ? "0 2px 8px rgba(129,140,248,0.4)" : "none",
                  }}/>
                  <div style={{ fontSize:11, fontWeight:600, color:d.date===today?T.accent:T.textMuted }}>{dayLabel}</div>
                  {d.doneSets > 0 && <div style={{ fontSize:10, color:T.textDim }}>{d.doneSets}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {stats.topExercises.length > 0 && (
          <div style={{ ...S.card, padding:16 }}>
            <div style={{ fontSize:15, fontWeight:700, marginBottom:12, color:T.text }}>자주 하는 운동</div>
            {stats.topExercises.map(([name, count], i) => (
              <div key={name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 0", borderBottom:i<stats.topExercises.length-1?`1px solid ${T.border}`:"none" }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:28, height:28, borderRadius:"50%", background:["#818cf8","#4ade80","#fbbf24","#f87171","#c084fc"][i], color:"white", fontSize:13, fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center" }}>{i+1}</div>
                  <span style={{ fontSize:15, fontWeight:600, color:T.text }}>{name}</span>
                </div>
                <span style={{ fontSize:14, color:T.textMuted }}>{count}회</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ─── 설정 탭 ───
  const SettingsTab = () => (
    <div style={{ padding:"16px 16px 100px" }}>
      <h2 style={{ fontSize:20, fontWeight:800, marginBottom:6, color:T.text }}>설정</h2>
      <p style={{ fontSize:14, color:T.textMuted, marginBottom:20 }}>운동별 기본 횟수와 휴식시간을 설정합니다.</p>

      {/* 데이터 관리 — 백업/복원 */}
      <div style={{ ...S.card, padding:16, marginBottom:24 }}>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:6, color:T.text }}>데이터 관리</div>
        <div style={{ fontSize:12, color:T.textMuted, marginBottom:12, lineHeight:1.5 }}>
          이 기기의 운동 기록을 JSON 파일로 내보내거나, 백업 파일로 복원합니다.
          복원 시 현재 기기의 데이터는 <span style={{ color:"#fca5a5", fontWeight:600 }}>모두 덮어써집니다.</span>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={handleExport}
            style={{ flex:1, padding:"10px 12px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#6366f1,#8b5cf6)", color:"white", fontSize:14, fontWeight:700, cursor:"pointer" }}>
            백업 (내보내기)
          </button>
          <button onClick={handleImportClick}
            style={{ flex:1, padding:"10px 12px", borderRadius:12, border:`1px solid ${T.borderStrong}`, background:T.inputBg, color:T.text, fontSize:14, fontWeight:700, cursor:"pointer" }}>
            복원 (가져오기)
          </button>
        </div>
      </div>

      {Object.entries(exercises).map(([cat, list]) => (
        <div key={cat} style={{ marginBottom:20 }}>
          <div style={{ fontSize:14, fontWeight:700, color:T.textDim, marginBottom:10, paddingLeft:4 }}>{cat}</div>
          {list.map((ex) => (
            <div key={ex.id || ex.name} style={{ ...S.card, padding:16, marginBottom:8 }}>
              <div style={{ fontSize:16, fontWeight:700, marginBottom:12, color:T.text }}>{ex.icon} {ex.name}</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                <div>
                  <div style={{ fontSize:12, color:T.textMuted, marginBottom:6, fontWeight:600 }}>기본 횟수</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <button onClick={() => updateExerciseDefault(ex,"defaultReps",(ex.defaultReps||10)-1)} style={S.stepBtn}>−</button>
                    <NumberField value={ex.defaultReps||10} onChange={(n) => updateExerciseDefault(ex,"defaultReps",n)} style={{ ...S.settInput, flex:1 }}/>
                    <button onClick={() => updateExerciseDefault(ex,"defaultReps",(ex.defaultReps||10)+1)} style={S.stepBtn}>+</button>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:12, color:T.textMuted, marginBottom:6, fontWeight:600 }}>휴식(초)</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <button onClick={() => updateExerciseDefault(ex,"defaultRestSec",(ex.defaultRestSec||60)-5)} style={S.stepBtn}>−</button>
                    <NumberField value={ex.defaultRestSec||60} onChange={(n) => updateExerciseDefault(ex,"defaultRestSec",n)} style={{ ...S.settInput, flex:1 }}/>
                    <button onClick={() => updateExerciseDefault(ex,"defaultRestSec",(ex.defaultRestSec||60)+5)} style={S.stepBtn}>+</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );

  // ─── 운동 선택 모달 ───
  const Picker = () => {
    if (!showPicker) return null;
    return (
      <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.65)", backdropFilter:"blur(3px)", zIndex:50, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
        <div style={{ background:T.surfaceSolid, borderRadius:"20px 20px 0 0", maxHeight:"80vh", overflow:"auto", padding:"20px 16px", paddingBottom:"max(env(safe-area-inset-bottom), 32px)", borderTop:`1px solid ${T.border}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
            <h3 style={{ fontSize:18, fontWeight:800, color:T.text }}>운동 선택</h3>
            <button onClick={() => { setShowPicker(false); setShowAddCustom(false); }}
              style={{ background:T.surfaceAlt, color:T.textDim, border:"none", borderRadius:10, width:36, height:36, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <X size={18}/>
            </button>
          </div>
          {Object.entries(exercises).map(([cat, list]) => (
            <div key={cat} style={{ marginBottom:16 }}>
              <div style={{ fontSize:14, fontWeight:700, color:T.textDim, marginBottom:8, paddingLeft:4 }}>{cat}</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {list.map((ex) => (
                  <button key={ex.name} onClick={() => addExercise(ex.name, cat)}
                    style={{ padding:"10px 16px", borderRadius:12, border:`1px solid ${T.borderStrong}`, background:T.inputBg, fontSize:14, cursor:"pointer", color:T.text, fontWeight:500 }}>
                    {ex.icon} {ex.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div style={{ borderTop:`1px solid ${T.border}`, paddingTop:16, marginTop:8 }}>
            {!showAddCustom ? (
              <button onClick={() => setShowAddCustom(true)}
                style={{ width:"100%", padding:14, borderRadius:12, border:`2px dashed ${T.borderStrong}`, background:"transparent", color:T.textDim, fontSize:15, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                <ListPlus size={18}/> 직접 추가
              </button>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <input type="text" value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="운동 이름 입력"
                  style={{ padding:"12px 16px", borderRadius:12, border:`1px solid ${T.borderStrong}`, background:T.inputBg, color:T.text, fontSize:15, outline:"none" }} autoFocus/>
                <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                  {Object.keys(exercises).map((c) => (
                    <button key={c} onClick={() => setCustomCategory(c)}
                      style={{ padding:"8px 16px", borderRadius:10, border:"none", background:customCategory===c?"#6366f1":T.surfaceAlt, color:customCategory===c?"white":T.textDim, fontSize:14, fontWeight:600, cursor:"pointer" }}>
                      {c}
                    </button>
                  ))}
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={addCustomExercise} style={{ flex:1, padding:12, borderRadius:12, border:"none", background:"#22c55e", color:"white", fontSize:15, fontWeight:600, cursor:"pointer" }}>추가</button>
                  <button onClick={() => setShowAddCustom(false)} style={{ padding:"12px 20px", borderRadius:12, border:"none", background:T.surfaceAlt, color:T.textDim, fontSize:15, cursor:"pointer" }}>취소</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── 휴식 타이머 오버레이 ───
  const RestOverlay = () => {
    if (restTimer === null) return null;
    const done = restTimer <= 0;
    const pct = done ? 100 : ((restSeconds - restTimer) / restSeconds) * 100;
    return (
      <div style={{ position:"fixed", top:0, left:0, right:0, bottom:0, background: done ? "rgba(34,197,94,0.95)" : "rgba(0,0,0,0.9)", zIndex:100, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", color:"white", transition:"background 0.3s" }}>
        {done
          ? <Check size={72} style={{ marginBottom:8 }}/>
          : <Clock size={48} style={{ marginBottom:16, opacity:0.7 }}/>}
        <div style={{ fontSize:18, opacity:0.9, marginBottom:8 }}>
          {done ? "휴식 끝! 다음 세트" : "휴식 시간"}
        </div>
        {!done && (
          <div style={{ fontSize:72, fontWeight:700, fontVariantNumeric:"tabular-nums" }}>
            {Math.floor(restTimer/60)}:{String(restTimer%60).padStart(2,"0")}
          </div>
        )}
        {done && (
          <div style={{ fontSize:42, fontWeight:700, letterSpacing:2 }}>GO!</div>
        )}
        <div style={{ width:200, height:6, background:"rgba(255,255,255,0.25)", borderRadius:3, marginTop:24, overflow:"hidden" }}>
          <div style={{ width:`${pct}%`, height:"100%", background: done ? "white" : "linear-gradient(90deg,#4ade80,#22c55e)", borderRadius:3, transition:"width 1s linear" }}/>
        </div>
        {!done && (
          <button onClick={() => { setRestTimer(null); clearInterval(timerRef.current); }}
            style={{ marginTop:32, padding:"12px 32px", borderRadius:12, background:"rgba(255,255,255,0.15)", border:"1px solid rgba(255,255,255,0.3)", color:"white", fontSize:16, cursor:"pointer" }}>
            건너뛰기
          </button>
        )}
      </div>
    );
  };

  // ─── 탭 정의 ───
  const tabs = [
    { id:"home",     label:"오늘", Icon:Home     },
    { id:"history",  label:"기록", Icon:Calendar  },
    { id:"stats",    label:"통계", Icon:TrendingUp },
    { id:"settings", label:"설정", Icon:Settings  },
  ];

  return (
    <div style={{ maxWidth:480, margin:"0 auto", minHeight:"100vh", background:"transparent", position:"relative" }}>
      {/* 헤더 */}
      <div style={{ background:"rgba(15,23,42,0.7)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", padding:"16px 20px", borderBottom:`1px solid ${T.border}`, position:"sticky", top:0, zIndex:30 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 12px rgba(99,102,241,0.4)" }}>
            <Dumbbell size={20} color="white"/>
          </div>
          <div>
            <div style={{ fontSize:18, fontWeight:800, color:T.text }}>운동 관리</div>
            <div style={{ fontSize:12, color:T.textMuted }}>매일 조금씩, 꾸준하게</div>
          </div>
        </div>
      </div>

      {/* 콘텐츠 */}
      {tab === "home"     && <HomeTab/>}
      {tab === "history"  && <HistoryTab/>}
      {tab === "stats"    && <StatsTab/>}
      {tab === "settings" && <SettingsTab/>}

      {/* 하단 탭바 */}
      <div style={{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background:"rgba(15,23,42,0.85)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", borderTop:`1px solid ${T.border}`, display:"flex", justifyContent:"space-around", padding:"8px 0 env(safe-area-inset-bottom, 20px)", zIndex:30 }}>
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"4px 16px", color:tab===id?T.accent:T.textMuted, transition:"color 0.2s" }}>
            <Icon size={22}/>
            <span style={{ fontSize:11, fontWeight:600 }}>{label}</span>
          </button>
        ))}
      </div>

      <Picker/>
      <RestOverlay/>

      {/* 백업 복원용 숨겨진 파일 인풋 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImportFile}
        style={{ display:"none" }}
      />
    </div>
  );
}
