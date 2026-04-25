import { appSchema, tableSchema } from '@nozbe/watermelondb';

// Mirror of docs/SCHEMA.sql for offline-first storage.
//
// Type mapping:
//   UUID, TEXT, ENUM, BYTEA (base64), DATE (ISO), ARRAY (JSON) -> 'string'
//   TIMESTAMPTZ -> 'number' (ms since epoch)
//   SMALLINT, INTEGER, NUMERIC -> 'number'
//   BOOLEAN -> 'boolean'
//
// WatermelonDB injects `id` (string) and the sync-bookkeeping columns
// (`_status`, `_changed`, `last_modified`) automatically — they are not
// listed below.
//
// `tut_seconds` is a Postgres STORED generated column. The local copy is a
// plain number kept consistent with the PG formula via computeTutSeconds(),
// see ./tut.ts. The API drops it on push and authoritatively rehydrates it
// on pull.

export const TABLE = {
  users: 'users',
  exercises: 'exercises',
  workout_sessions: 'workout_sessions',
  exercise_blocks: 'exercise_blocks',
  block_exercises: 'block_exercises',
  exercise_sets: 'exercise_sets',
  foods: 'foods',
  nutrition_logs: 'nutrition_logs',
  nutrition_targets: 'nutrition_targets',
  ambient_daily: 'ambient_daily',
  sleep_sessions: 'sleep_sessions',
  readiness_scores: 'readiness_scores',
  health_provider_links: 'health_provider_links',
} as const;

export const schema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: TABLE.users,
      columns: [
        { name: 'email_hash', type: 'string', isIndexed: true },
        { name: 'auth_pubkey', type: 'string' },
        { name: 'encrypted_profile', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: TABLE.exercises,
      columns: [
        { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'primary_muscle', type: 'string' },
        { name: 'secondary_muscles_json', type: 'string' },
        { name: 'pattern', type: 'string' },
        { name: 'is_unilateral', type: 'boolean' },
        { name: 'is_bodyweight', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: TABLE.workout_sessions,
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'started_at', type: 'number', isIndexed: true },
        { name: 'ended_at', type: 'number', isOptional: true },
        { name: 'title', type: 'string', isOptional: true },
        { name: 'notes_encrypted', type: 'string', isOptional: true },
        { name: 'perceived_exertion', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: TABLE.exercise_blocks,
      columns: [
        { name: 'session_id', type: 'string', isIndexed: true },
        { name: 'block_type', type: 'string' },
        { name: 'position', type: 'number' },
        { name: 'rest_seconds_between_rounds', type: 'number', isOptional: true },
        { name: 'target_rounds', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: TABLE.block_exercises,
      columns: [
        { name: 'block_id', type: 'string', isIndexed: true },
        { name: 'exercise_id', type: 'string', isIndexed: true },
        { name: 'position', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: TABLE.exercise_sets,
      columns: [
        { name: 'block_exercise_id', type: 'string', isIndexed: true },
        { name: 'round_number', type: 'number' },
        { name: 'drop_index', type: 'number' },
        { name: 'weight_kg', type: 'number', isOptional: true },
        { name: 'reps', type: 'number' },
        { name: 'eccentric_ds', type: 'number', isOptional: true },
        { name: 'isometric_bottom_ds', type: 'number', isOptional: true },
        { name: 'concentric_ds', type: 'number', isOptional: true },
        { name: 'isometric_top_ds', type: 'number', isOptional: true },
        { name: 'tut_seconds', type: 'number', isOptional: true },
        { name: 'rpe', type: 'number', isOptional: true },
        { name: 'rir', type: 'number', isOptional: true },
        { name: 'rest_after_seconds', type: 'number', isOptional: true },
        { name: 'is_warmup', type: 'boolean' },
        { name: 'is_failure', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: TABLE.foods,
      columns: [
        { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'brand', type: 'string', isOptional: true },
        { name: 'serving_grams', type: 'number' },
        { name: 'kcal_per_serving', type: 'number' },
        { name: 'protein_g', type: 'number' },
        { name: 'carbs_g', type: 'number' },
        { name: 'fat_g', type: 'number' },
        { name: 'fiber_g', type: 'number', isOptional: true },
        { name: 'barcode', type: 'string', isOptional: true, isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: TABLE.nutrition_logs,
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'food_id', type: 'string', isIndexed: true },
        { name: 'consumed_at', type: 'number' },
        { name: 'log_date', type: 'string', isIndexed: true },
        { name: 'meal_slot', type: 'string', isOptional: true },
        { name: 'servings', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: TABLE.nutrition_targets,
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'effective_from', type: 'string' },
        { name: 'kcal_target', type: 'number', isOptional: true },
        { name: 'protein_g_target', type: 'number' },
        { name: 'carbs_g_target', type: 'number', isOptional: true },
        { name: 'fat_g_target', type: 'number', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: TABLE.ambient_daily,
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'log_date', type: 'string', isIndexed: true },
        { name: 'step_count', type: 'number', isOptional: true },
        { name: 'active_kcal', type: 'number', isOptional: true },
        { name: 'distance_m', type: 'number', isOptional: true },
        { name: 'source', type: 'string' },
        { name: 'last_synced_at', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: TABLE.sleep_sessions,
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'in_bed_at', type: 'number' },
        { name: 'asleep_at', type: 'number', isOptional: true },
        { name: 'awake_at', type: 'number' },
        { name: 'sleep_date', type: 'string', isIndexed: true },
        { name: 'latency_seconds', type: 'number', isOptional: true },
        { name: 'total_sleep_seconds', type: 'number' },
        { name: 'interruptions_count', type: 'number', isOptional: true },
        { name: 'rem_seconds', type: 'number', isOptional: true },
        { name: 'deep_seconds', type: 'number', isOptional: true },
        { name: 'light_seconds', type: 'number', isOptional: true },
        { name: 'awake_seconds', type: 'number', isOptional: true },
        { name: 'source', type: 'string' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: TABLE.readiness_scores,
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'score_date', type: 'string', isIndexed: true },
        { name: 'score', type: 'number' },
        { name: 'sleep_component', type: 'number', isOptional: true },
        { name: 'load_component', type: 'number', isOptional: true },
        { name: 'nutrition_component', type: 'number', isOptional: true },
        { name: 'algorithm_version', type: 'string' },
        { name: 'computed_at', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: TABLE.health_provider_links,
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'provider', type: 'string' },
        { name: 'granted_scopes_json', type: 'string' },
        { name: 'last_sync_at', type: 'number', isOptional: true },
        { name: 'last_sync_anchor', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'deleted_at', type: 'number', isOptional: true },
      ],
    }),
  ],
});
