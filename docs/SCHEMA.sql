-- ============================================================
-- KINETICA — Core Schema (regenerated artifact)
--
-- DO NOT EDIT BY HAND. This file is regenerated from the SQLAlchemy
-- models in services/api/kinetica/models/ via:
--
--     cd services/api
--     uv run python scripts/render_schema.py > docs/SCHEMA.sql
--
-- The CI `schema-doc-drift` gate diffs the regenerated output against this
-- committed file and fails if they disagree.
-- ============================================================


CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE muscle_group AS ENUM ('chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders', 'biceps', 'triceps', 'forearms', 'calves', 'core', 'traps', 'lats');
CREATE TYPE movement_pattern AS ENUM ('horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull', 'squat', 'hinge', 'lunge', 'carry', 'rotation', 'isolation');
CREATE TYPE block_type AS ENUM ('single', 'superset', 'giant', 'circuit');
CREATE TYPE meal_slot AS ENUM ('breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout');

CREATE TABLE application_pepper (
	slot TEXT NOT NULL, 
	pepper BYTEA NOT NULL, 
	rotated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT pk_application_pepper PRIMARY KEY (slot), 
	CONSTRAINT ck_application_pepper_slot_values CHECK (slot IN ('primary', 'secondary')), 
	CONSTRAINT ck_application_pepper_pepper_len CHECK (length(pepper) = 32)
);

CREATE TABLE dpop_jti_seen (
	jti TEXT NOT NULL, 
	seen_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT pk_dpop_jti_seen PRIMARY KEY (jti)
);

CREATE INDEX idx_dpop_jti_expires ON dpop_jti_seen (expires_at);

CREATE TABLE users (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	email_hash BYTEA NOT NULL, 
	encryption_pubkey BYTEA NOT NULL, 
	password_salt BYTEA NOT NULL, 
	wrapped_master_key BYTEA NOT NULL, 
	encrypted_profile BYTEA, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	deletion_requested_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT pk_users PRIMARY KEY (id), 
	CONSTRAINT uq_users_email_hash UNIQUE (email_hash), 
	CONSTRAINT ck_users_encryption_pubkey_len CHECK (length(encryption_pubkey) = 32), 
	CONSTRAINT ck_users_password_salt_len CHECK (length(password_salt) = 16), 
	CONSTRAINT ck_users_wrapped_master_key_min_len CHECK (length(wrapped_master_key) >= 72)
);

CREATE TABLE ambient_daily (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	user_id UUID NOT NULL, 
	log_date DATE NOT NULL, 
	step_count INTEGER, 
	active_kcal NUMERIC(7, 2), 
	distance_m NUMERIC(8, 2), 
	source TEXT NOT NULL, 
	last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT pk_ambient_daily PRIMARY KEY (id), 
	CONSTRAINT uq_ambient_daily_user_id_log_date_source UNIQUE (user_id, log_date, source), 
	CONSTRAINT fk_ambient_daily_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE exercises (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	user_id UUID, 
	name TEXT NOT NULL, 
	primary_muscle muscle_group NOT NULL, 
	secondary_muscles muscle_group[] DEFAULT '{}'::muscle_group[] NOT NULL, 
	pattern movement_pattern NOT NULL, 
	is_unilateral BOOLEAN DEFAULT false NOT NULL, 
	is_bodyweight BOOLEAN DEFAULT false NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT pk_exercises PRIMARY KEY (id), 
	CONSTRAINT fk_exercises_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_exercises_user ON exercises (user_id) WHERE deleted_at IS NULL;

CREATE TABLE foods (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	user_id UUID, 
	name TEXT NOT NULL, 
	brand TEXT, 
	serving_grams NUMERIC(7, 2) NOT NULL, 
	kcal_per_serving NUMERIC(7, 2) NOT NULL, 
	protein_g NUMERIC(6, 2) NOT NULL, 
	carbs_g NUMERIC(6, 2) NOT NULL, 
	fat_g NUMERIC(6, 2) NOT NULL, 
	fiber_g NUMERIC(6, 2), 
	barcode TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT pk_foods PRIMARY KEY (id), 
	CONSTRAINT fk_foods_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_foods_barcode ON foods (barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_foods_user_name ON foods (user_id, name);

CREATE TABLE health_provider_links (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	user_id UUID NOT NULL, 
	provider TEXT NOT NULL, 
	granted_scopes TEXT[] DEFAULT '{}'::text[] NOT NULL, 
	last_sync_at TIMESTAMP WITH TIME ZONE, 
	last_sync_anchor TEXT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT pk_health_provider_links PRIMARY KEY (id), 
	CONSTRAINT uq_health_provider_links_user_id_provider UNIQUE (user_id, provider), 
	CONSTRAINT fk_health_provider_links_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE nutrition_targets (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	user_id UUID NOT NULL, 
	effective_from DATE NOT NULL, 
	kcal_target SMALLINT, 
	protein_g_target SMALLINT NOT NULL, 
	carbs_g_target SMALLINT, 
	fat_g_target SMALLINT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT pk_nutrition_targets PRIMARY KEY (id), 
	CONSTRAINT uq_nutrition_targets_user_id_effective_from UNIQUE (user_id, effective_from), 
	CONSTRAINT fk_nutrition_targets_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE readiness_scores (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	user_id UUID NOT NULL, 
	score_date DATE NOT NULL, 
	score SMALLINT NOT NULL, 
	sleep_component SMALLINT, 
	load_component SMALLINT, 
	nutrition_component SMALLINT, 
	algorithm_version TEXT NOT NULL, 
	computed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT pk_readiness_scores PRIMARY KEY (id), 
	CONSTRAINT uq_readiness_scores_user_id_score_date UNIQUE (user_id, score_date), 
	CONSTRAINT ck_readiness_scores_score_range CHECK (score BETWEEN 0 AND 100), 
	CONSTRAINT fk_readiness_scores_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE sleep_sessions (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	user_id UUID NOT NULL, 
	in_bed_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	asleep_at TIMESTAMP WITH TIME ZONE, 
	awake_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	sleep_date DATE NOT NULL, 
	latency_seconds INTEGER, 
	total_sleep_seconds INTEGER NOT NULL, 
	interruptions_count SMALLINT, 
	rem_seconds INTEGER, 
	deep_seconds INTEGER, 
	light_seconds INTEGER, 
	awake_seconds INTEGER, 
	source TEXT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT pk_sleep_sessions PRIMARY KEY (id), 
	CONSTRAINT fk_sleep_sessions_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_sleep_user_date ON sleep_sessions (user_id, sleep_date DESC) WHERE deleted_at IS NULL;

CREATE TABLE user_devices (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	user_id UUID NOT NULL, 
	device_pubkey BYTEA NOT NULL, 
	device_name TEXT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	last_seen_at TIMESTAMP WITH TIME ZONE, 
	revoked_at TIMESTAMP WITH TIME ZONE, 
	bootstrap_pending BOOLEAN DEFAULT false NOT NULL, 
	CONSTRAINT pk_user_devices PRIMARY KEY (id), 
	CONSTRAINT uq_user_devices_user_id_device_pubkey UNIQUE (user_id, device_pubkey), 
	CONSTRAINT ck_user_devices_device_pubkey_len CHECK (length(device_pubkey) = 32), 
	CONSTRAINT fk_user_devices_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_user_devices_user ON user_devices (user_id) WHERE revoked_at IS NULL;

CREATE TABLE workout_sessions (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	user_id UUID NOT NULL, 
	started_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	ended_at TIMESTAMP WITH TIME ZONE, 
	title TEXT, 
	notes_encrypted BYTEA, 
	perceived_exertion SMALLINT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT pk_workout_sessions PRIMARY KEY (id), 
	CONSTRAINT ck_workout_sessions_perceived_exertion_range CHECK (perceived_exertion BETWEEN 1 AND 10), 
	CONSTRAINT fk_workout_sessions_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user_date ON workout_sessions (user_id, started_at DESC) WHERE deleted_at IS NULL;

CREATE TABLE exercise_blocks (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	session_id UUID NOT NULL, 
	block_type block_type NOT NULL, 
	position SMALLINT NOT NULL, 
	rest_seconds_between_rounds SMALLINT, 
	target_rounds SMALLINT, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT pk_exercise_blocks PRIMARY KEY (id), 
	CONSTRAINT uq_exercise_blocks_session_id_position UNIQUE (session_id, position), 
	CONSTRAINT fk_exercise_blocks_session_id_workout_sessions FOREIGN KEY(session_id) REFERENCES workout_sessions (id) ON DELETE CASCADE
);

CREATE TABLE nutrition_logs (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	user_id UUID NOT NULL, 
	food_id UUID NOT NULL, 
	consumed_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	log_date DATE NOT NULL, 
	meal_slot meal_slot, 
	servings NUMERIC(5, 2) DEFAULT 1.0 NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT pk_nutrition_logs PRIMARY KEY (id), 
	CONSTRAINT fk_nutrition_logs_user_id_users FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE, 
	CONSTRAINT fk_nutrition_logs_food_id_foods FOREIGN KEY(food_id) REFERENCES foods (id)
);

CREATE INDEX idx_nutrition_user_date ON nutrition_logs (user_id, log_date) WHERE deleted_at IS NULL;

CREATE TABLE block_exercises (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	block_id UUID NOT NULL, 
	exercise_id UUID NOT NULL, 
	position SMALLINT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT pk_block_exercises PRIMARY KEY (id), 
	CONSTRAINT uq_block_exercises_block_id_position UNIQUE (block_id, position), 
	CONSTRAINT fk_block_exercises_block_id_exercise_blocks FOREIGN KEY(block_id) REFERENCES exercise_blocks (id) ON DELETE CASCADE, 
	CONSTRAINT fk_block_exercises_exercise_id_exercises FOREIGN KEY(exercise_id) REFERENCES exercises (id)
);

CREATE TABLE exercise_sets (
	id UUID DEFAULT gen_random_uuid() NOT NULL, 
	block_exercise_id UUID NOT NULL, 
	round_number SMALLINT NOT NULL, 
	drop_index SMALLINT DEFAULT 0 NOT NULL, 
	weight_kg NUMERIC(6, 2), 
	reps SMALLINT NOT NULL, 
	eccentric_ds SMALLINT, 
	isometric_bottom_ds SMALLINT, 
	concentric_ds SMALLINT, 
	isometric_top_ds SMALLINT, 
	tut_seconds NUMERIC(7, 2) GENERATED ALWAYS AS (((((((COALESCE((eccentric_ds)::integer, 0) + COALESCE((isometric_bottom_ds)::integer, 0)) + COALESCE((concentric_ds)::integer, 0)) + COALESCE((isometric_top_ds)::integer, 0)))::numeric * (reps)::numeric) / 10.0)) STORED, 
	rpe NUMERIC(3, 1), 
	rir SMALLINT, 
	rest_after_seconds SMALLINT, 
	is_warmup BOOLEAN DEFAULT false NOT NULL, 
	is_failure BOOLEAN DEFAULT false NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	deleted_at TIMESTAMP WITH TIME ZONE, 
	CONSTRAINT pk_exercise_sets PRIMARY KEY (id), 
	CONSTRAINT uq_exercise_sets_block_exercise_id_round_number_drop_index UNIQUE (block_exercise_id, round_number, drop_index), 
	CONSTRAINT ck_exercise_sets_rpe_range CHECK (rpe BETWEEN 1.0 AND 10.0), 
	CONSTRAINT ck_exercise_sets_rir_range CHECK (rir BETWEEN 0 AND 10), 
	CONSTRAINT fk_exercise_sets_block_exercise_id_block_exercises FOREIGN KEY(block_exercise_id) REFERENCES block_exercises (id) ON DELETE CASCADE
);

CREATE INDEX idx_sets_block_exercise ON exercise_sets (block_exercise_id) WHERE deleted_at IS NULL;
