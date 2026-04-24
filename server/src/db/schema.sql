-- 운동 종목 테이블
CREATE TABLE IF NOT EXISTS exercise_types (
  id          SERIAL PRIMARY KEY,
  category    VARCHAR(50)  NOT NULL,
  name        VARCHAR(100) NOT NULL,
  icon        VARCHAR(20)  DEFAULT '🏃',
  default_reps     INT DEFAULT 10,
  default_rest_sec INT DEFAULT 60,
  UNIQUE (category, name)
);

-- 날짜별 운동 기록 헤더
CREATE TABLE IF NOT EXISTS workout_logs (
  id            SERIAL PRIMARY KEY,
  log_date      DATE        NOT NULL,
  exercise_name VARCHAR(100) NOT NULL,
  category      VARCHAR(50)  NOT NULL,
  local_id      VARCHAR(20),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 세트 기록
CREATE TABLE IF NOT EXISTS workout_sets (
  id             SERIAL PRIMARY KEY,
  workout_log_id INT  REFERENCES workout_logs(id) ON DELETE CASCADE,
  set_number     INT  NOT NULL,
  reps           INT  DEFAULT 10,
  rest_sec       INT  DEFAULT 60,
  done           BOOLEAN DEFAULT FALSE
);

-- 기본 운동 데이터 삽입
INSERT INTO exercise_types (category, name, icon, default_reps, default_rest_sec) VALUES
  ('상체', '턱걸이', '💪', 5,  90),
  ('상체', '푸시업', '🫸', 10, 60),
  ('상체', '딥스',   '🏋️', 8,  60),
  ('하체', '스쿼트',     '🦵', 15, 60),
  ('하체', '뒷꿈치들기', '🦶', 20, 45),
  ('유산소', '달리기', '🏃', 1, 0)
ON CONFLICT (category, name) DO NOTHING;
