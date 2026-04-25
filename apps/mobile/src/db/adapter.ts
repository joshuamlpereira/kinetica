import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';

import { schema } from './schema';

const adapter = new SQLiteAdapter({
  schema,
  dbName: 'kinetica',
  jsi: true,
  onSetUpError: (error) => {
    // The native error surfaces in dev tools; rethrow so we don't silently
    // run on a half-initialized DB.
    throw error;
  },
});

export const database = new Database({
  adapter,
  modelClasses: [],
});
