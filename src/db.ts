/**
 * D1 Read Replica Wrapper
 *
 * Provides a DbClient interface that separates read and write database access.
 * Today both point to the same D1Database instance. When Cloudflare ships D1
 * read replicas, only createDbClient() needs to change.
 */

export interface DbClient {
  readonly read: D1Database;
  readonly write: D1Database;
}

export function createDbClient(db: D1Database): DbClient {
  return { read: db, write: db };
}
