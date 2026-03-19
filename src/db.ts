/**
 * Database client wrapper for D1 read/write separation.
 *
 * Today both `.read` and `.write` delegate to the same D1Database instance.
 * When Cloudflare ships D1 read replicas, only `createDbClient` changes —
 * every handler already routes queries through the correct accessor.
 */

export interface DbClient {
  readonly read: D1Database;
  readonly write: D1Database;
}

export function createDbClient(db: D1Database): DbClient {
  return { read: db, write: db };
}
