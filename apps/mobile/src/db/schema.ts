import { appSchema } from '@nozbe/watermelondb';

// The full schema is generated to mirror docs/SCHEMA.sql. Phase 1 ships a stub
// so the adapter can initialize an empty database; the real tables land with
// the WatermelonDB model mirror task.
export const schema = appSchema({
  version: 1,
  tables: [],
});
