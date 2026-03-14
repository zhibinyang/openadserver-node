/**
 * Mock Database for Testing
 * Provides in-memory database operations for unit tests
 */

// Mock database result type
export interface MockDbResult<T = any> {
  rows: T[];
  rowCount: number;
}

// In-memory storage for testing
export class MockDatabase {
  private storage: Map<string, any[]> = new Map();
  private idCounters: Map<string, number> = new Map();

  // Simulate insert
  async insert<T>(table: string, data: T): Promise<MockDbResult<T>> {
    if (!this.storage.has(table)) {
      this.storage.set(table, []);
    }
    const id = (this.idCounters.get(table) || 0) + 1;
    this.idCounters.set(table, id);
    const record = { ...data, id } as T;
    this.storage.get(table)!.push(record);
    return { rows: [record], rowCount: 1 };
  }

  // Simulate select
  async select<T>(table: string, condition?: (row: T) => boolean): Promise<MockDbResult<T>> {
    const rows = this.storage.get(table) || [];
    const filtered = condition ? rows.filter(condition) : rows;
    return { rows: filtered as T[], rowCount: filtered.length };
  }

  // Simulate update
  async update<T>(table: string, condition: (row: T) => boolean, updates: Partial<T>): Promise<MockDbResult<T>> {
    const rows = this.storage.get(table) || [];
    let updated = 0;
    rows.forEach((row, idx) => {
      if (condition(row)) {
        rows[idx] = { ...row, ...updates };
        updated++;
      }
    });
    return { rows: [], rowCount: updated };
  }

  // Simulate delete
  async delete<T>(table: string, condition: (row: T) => boolean): Promise<MockDbResult<T>> {
    const rows = this.storage.get(table) || [];
    const filtered = rows.filter(row => !condition(row));
    const deleted = rows.length - filtered.length;
    this.storage.set(table, filtered);
    return { rows: [], rowCount: deleted };
  }

  // Clear all data
  clear(): void {
    this.storage.clear();
    this.idCounters.clear();
  }

  // Seed data
  seed(table: string, data: any[]): void {
    this.storage.set(table, data);
    const maxId = Math.max(...data.map(d => d.id || 0), 0);
    this.idCounters.set(table, maxId);
  }
}

// Singleton instance for tests
export const mockDb = new MockDatabase();

// Helper to create mock query function
export function createMockQuery() {
  return jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
    return { rows: [], rowCount: 0 };
  });
}

// Helper to create mock drizzle db
export function createMockDrizzleDb() {
  return {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([{ id: 1 }]),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  };
}
