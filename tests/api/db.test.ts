import { createDbClient, DbClient } from '../../src/db';

describe('createDbClient', () => {
  const mockDB = {
    prepare: jest.fn(),
    batch: jest.fn(),
    exec: jest.fn(),
    dump: jest.fn(),
  } as unknown as D1Database;

  let db: DbClient;

  beforeEach(() => {
    db = createDbClient(mockDB);
  });

  it('returns an object with read and write properties', () => {
    expect(db).toHaveProperty('read');
    expect(db).toHaveProperty('write');
  });

  it('delegates read to the same D1Database instance', () => {
    expect(db.read).toBe(mockDB);
  });

  it('delegates write to the same D1Database instance', () => {
    expect(db.write).toBe(mockDB);
  });

  it('read and write are the same instance', () => {
    expect(db.read).toBe(db.write);
  });

  it('passes through prepare calls on read', () => {
    db.read.prepare('SELECT 1');
    expect(mockDB.prepare).toHaveBeenCalledWith('SELECT 1');
  });

  it('passes through prepare calls on write', () => {
    db.write.prepare('INSERT INTO t VALUES (1)');
    expect(mockDB.prepare).toHaveBeenCalledWith('INSERT INTO t VALUES (1)');
  });

  it('passes through batch calls on write', () => {
    const stmts = [] as unknown as D1PreparedStatement[];
    db.write.batch(stmts);
    expect(mockDB.batch).toHaveBeenCalledWith(stmts);
  });

  it('passes through exec calls', () => {
    db.read.exec('PRAGMA table_info(users)');
    expect(mockDB.exec).toHaveBeenCalledWith('PRAGMA table_info(users)');
  });

  it('passes through dump calls', () => {
    db.read.dump();
    expect(mockDB.dump).toHaveBeenCalled();
  });
});
