-- ============================================================
-- KINETICA — Core Schema
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------- IDENTITY ----------------------------------------
CREATE TABLE users (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email_hash         BYTEA       NOT NULL UNIQUE,
    auth_pubkey        BYTEA       NOT NULL,
    encrypted_profile  BYTEA,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at         TIMESTAMPTZ
);

-- ---------- EXERCISE CATALOG --------------------------------
CREATE TYPE muscle_group AS ENUM (
    'chest','back','quads','hamstrings','glutes','shoulders',
    'biceps','triceps','forearms','calves','core','traps','lats'
);
CREATE TYPE movement_pattern AS ENUM (
    'horizontal_push','horizontal_pull','vertical_push','vertical_pull',
    'squat','hinge','lunge','carry','rotation','isolation'
);

CREATE TABLE exercises (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID REFERENCES users(id) ON DELETE CASCADE,
    name               TEXT             NOT NULL,
    primary_muscle     muscle_group     NOT NULL,
    secondary_muscles  muscle_group[]   NOT NULL DEFAULT '{}',
    pattern            movement_pattern NOT NULL,
    is_unilateral      BOOLEAN          NOT NULL DEFAULT FALSE,
    is_bodyweight      BOOLEAN          NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
    deleted_at         TIMESTAMPTZ
);
CREATE INDEX idx_exercises_user ON exercises(user_id) WHERE deleted_at IS NULL;

-- ---------- WORKOUT STRUCTURE -------------------------------
CREATE TABLE workout_sessions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at          TIMESTAMPTZ  NOT NULL,
    ended_at            TIMESTAMPTZ,
    title               TEXT,
    notes_encrypted     BYTEA,
    perceived_exertion  SMALLINT     CHECK (perceived_exertion BETWEEN 1 AND 10),
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ
);
CREATE INDEX idx_sessions_user_date
    ON workout_sessions(user_id, started_at DESC) WHERE deleted_at IS NULL;

CREATE TYPE block_type AS ENUM ('single','superset','giant','circuit');

CREATE TABLE exercise_blocks (
    id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id                    UUID        NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
    block_type                    block_type  NOT NULL,
    position                      SMALLINT    NOT NULL,
    rest_seconds_between_rounds   SMALLINT,
    target_rounds                 SMALLINT,
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at                    TIMESTAMPTZ,
    UNIQUE (session_id, position)
);

CREATE TABLE block_exercises (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id     UUID        NOT NULL REFERENCES exercise_blocks(id) ON DELETE CASCADE,
    exercise_id  UUID        NOT NULL REFERENCES exercises(id),
    position     SMALLINT    NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMPTZ,
    UNIQUE (block_id, position)
);

-- ---------- THE GRANULAR SET --------------------------------
CREATE TABLE exercise_sets (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_exercise_id     UUID NOT NULL REFERENCES block_exercises(id) ON DELETE CASCADE,
    round_number          SMALLINT NOT NULL,
    drop_index            SMALLINT NOT NULL DEFAULT 0,
    weight_kg             NUMERIC(6,2),
    reps                  SMALLINT NOT NULL,
    eccentric_ds          SMALLINT,
    isometric_bottom_ds   SMALLINT,
    concentric_ds         SMALLINT,
    isometric_top_ds      SMALLINT,
    tut_seconds NUMERIC(7,2) GENERATED ALWAYS AS (
        (COALESCE(eccentric_ds, 0)
       + COALESCE(isometric_bottom_ds, 0)
       + COALESCE(concentric_ds, 0)
       + COALESCE(isometric_top_ds, 0))::NUMERIC * reps / 10.0
    ) STORED,
    rpe                   NUMERIC(3,1) CHECK (rpe BETWEEN 1.0 AND 10.0),
    rir                   SMALLINT     CHECK (rir BETWEEN 0 AND 10),
    rest_after_seconds    SMALLINT,
    is_warmup             BOOLEAN     NOT NULL DEFAULT FALSE,
    is_failure            BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at            TIMESTAMPTZ,
    UNIQUE (block_exercise_id, round_number, drop_index)
);
CREATE INDEX idx_sets_block_exercise
    ON exercise_sets(block_exercise_id) WHERE deleted_at IS NULL;

-- ---------- NUTRITION ---------------------------------------
CREATE TABLE foods (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID REFERENCES users(id) ON DELETE CASCADE,
    name              TEXT          NOT NULL,
    brand             TEXT,
    serving_grams     NUMERIC(7,2)  NOT NULL,
    kcal_per_serving  NUMERIC(7,2)  NOT NULL,
    protein_g         NUMERIC(6,2)  NOT NULL,
    carbs_g           NUMERIC(6,2)  NOT NULL,
    fat_g             NUMERIC(6,2)  NOT NULL,
    fiber_g           NUMERIC(6,2),
    barcode           TEXT,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at        TIMESTAMPTZ
);
CREATE INDEX idx_foods_barcode   ON foods(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_foods_user_name ON foods(user_id, name);

CREATE TYPE meal_slot AS ENUM
    ('breakfast','lunch','dinner','snack','pre_workout','post_workout');

CREATE TABLE nutrition_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    food_id       UUID         NOT NULL REFERENCES foods(id),
    consumed_at   TIMESTAMPTZ  NOT NULL,
    log_date      DATE         NOT NULL,
    meal_slot     meal_slot,
    servings      NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at    TIMESTAMPTZ
);
CREATE INDEX idx_nutrition_user_date
    ON nutrition_logs(user_id, log_date) WHERE deleted_at IS NULL;

CREATE TABLE nutrition_targets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    effective_from  DATE NOT NULL,
    kcal_target     SMALLINT,
    protein_g_target SMALLINT NOT NULL,
    carbs_g_target  SMALLINT,
    fat_g_target    SMALLINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (user_id, effective_from)
);

-- ---------- AMBIENT (STEPS) ---------------------------------
CREATE TABLE ambient_daily (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID    NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    log_date        DATE    NOT NULL,
    step_count      INTEGER,
    active_kcal     NUMERIC(7,2),
    distance_m      NUMERIC(8,2),
    source          TEXT    NOT NULL,
    last_synced_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,
    UNIQUE (user_id, log_date, source)
);

-- ---------- SLEEP -------------------------------------------
CREATE TABLE sleep_sessions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    in_bed_at            TIMESTAMPTZ NOT NULL,
    asleep_at            TIMESTAMPTZ,
    awake_at             TIMESTAMPTZ NOT NULL,
    sleep_date           DATE        NOT NULL,
    latency_seconds      INTEGER,
    total_sleep_seconds  INTEGER NOT NULL,
    interruptions_count  SMALLINT,
    rem_seconds          INTEGER,
    deep_seconds         INTEGER,
    light_seconds        INTEGER,
    awake_seconds        INTEGER,
    source               TEXT NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at           TIMESTAMPTZ
);
CREATE INDEX idx_sleep_user_date
    ON sleep_sessions(user_id, sleep_date DESC) WHERE deleted_at IS NULL;

-- ---------- READINESS ---------------------------------------
CREATE TABLE readiness_scores (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score_date          DATE NOT NULL,
    score               SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100),
    sleep_component     SMALLINT,
    load_component     SMALLINT,
    nutrition_component SMALLINT,
    algorithm_version   TEXT NOT NULL,
    computed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    UNIQUE (user_id, score_date)
);

-- ---------- HEALTH PROVIDER LINKS ---------------------------
CREATE TABLE health_provider_links (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider            TEXT NOT NULL,
    granted_scopes      TEXT[] NOT NULL DEFAULT '{}',
    last_sync_at        TIMESTAMPTZ,
    last_sync_anchor    TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at          TIMESTAMPTZ,
    UNIQUE (user_id, provider)
);
