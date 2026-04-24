-- 2026-01-01 ~ 2026-04-22 랜덤 테스트 데이터
-- 재실행 방지: 이미 해당 기간 seed 레코드가 있으면 스킵
DO $$
DECLARE
  d             DATE;
  ex            RECORD;
  num_exercises INT;
  i             INT;
  log_id        INT;
  num_sets      INT;
  s             INT;
  existing      INT;
BEGIN
  SELECT COUNT(*) INTO existing
    FROM workout_logs
   WHERE local_id LIKE 'seed-%';

  IF existing > 0 THEN
    RAISE NOTICE 'seed 데이터가 이미 % 건 존재 — 건너뜀', existing;
    RETURN;
  END IF;

  FOR d IN
    SELECT gs::date
      FROM generate_series('2026-01-01'::date, '2026-04-22'::date, '1 day') AS gs
  LOOP
    -- 약 25% 확률로 휴식일
    IF random() < 0.25 THEN CONTINUE; END IF;

    num_exercises := 1 + floor(random() * 4)::int;  -- 하루 1~4 종목

    FOR i IN 1..num_exercises LOOP
      SELECT * INTO ex
        FROM exercise_types
       ORDER BY random()
       LIMIT 1;

      INSERT INTO workout_logs (log_date, exercise_name, category, local_id, created_at)
      VALUES (
        d,
        ex.name,
        ex.category,
        'seed-' || to_char(d, 'YYYYMMDD') || '-' || i,
        d + (random() * interval '14 hours') + interval '7 hours'
      )
      RETURNING id INTO log_id;

      num_sets := 3 + floor(random() * 3)::int; -- 3~5 세트

      FOR s IN 1..num_sets LOOP
        INSERT INTO workout_sets (workout_log_id, set_number, reps, rest_sec, done)
        VALUES (
          log_id,
          s,
          GREATEST(1, ex.default_reps + floor(random() * 7 - 3)::int),
          GREATEST(0, ex.default_rest_sec + floor(random() * 21 - 10)::int),
          random() < 0.9
        );
      END LOOP;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'seed 삽입 완료';
END $$;
