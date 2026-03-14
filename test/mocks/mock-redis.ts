/**
 * Mock Redis for Testing
 * Provides in-memory Redis operations for unit tests
 */

export class MockRedis {
  private store: Map<string, { value: string; ttl?: number; expireAt?: number }> = new Map();
  private sets: Map<string, Set<string>> = new Map();
  private hashes: Map<string, Map<string, string>> = new Map();

  // String operations
  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expireAt && Date.now() > entry.expireAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<'OK'> {
    const expireAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, ttl: ttlSeconds, expireAt });
    return 'OK';
  }

  async setex(key: string, seconds: number, value: string): Promise<'OK'> {
    return this.set(key, value, seconds);
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0;
    keys.forEach(key => {
      if (this.store.delete(key)) deleted++;
      this.sets.delete(key);
      this.hashes.delete(key);
    });
    return deleted;
  }

  async exists(key: string): Promise<number> {
    return this.store.has(key) ? 1 : 0;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expireAt = Date.now() + seconds * 1000;
    return 1;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return -2;
    if (!entry.expireAt) return -1;
    const remaining = Math.floor((entry.expireAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async incr(key: string): Promise<number> {
    const entry = this.store.get(key);
    const newValue = (parseInt(entry?.value || '0') + 1).toString();
    this.store.set(key, { value: newValue, ...entry });
    return parseInt(newValue);
  }

  async incrby(key: string, increment: number): Promise<number> {
    const entry = this.store.get(key);
    const newValue = (parseInt(entry?.value || '0') + increment).toString();
    this.store.set(key, { value: newValue, ...entry });
    return parseInt(newValue);
  }

  async decr(key: string): Promise<number> {
    return this.incrby(key, -1);
  }

  // Set operations
  async sadd(key: string, ...members: string[]): Promise<number> {
    if (!this.sets.has(key)) {
      this.sets.set(key, new Set());
    }
    const set = this.sets.get(key)!;
    const added = members.filter(m => !set.has(m)).length;
    members.forEach(m => set.add(m));
    return added;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    const removed = members.filter(m => set.has(m)).length;
    members.forEach(m => set.delete(m));
    return removed;
  }

  async smembers(key: string): Promise<string[]> {
    const set = this.sets.get(key);
    return set ? Array.from(set) : [];
  }

  async sismember(key: string, member: string): Promise<number> {
    const set = this.sets.get(key);
    return set?.has(member) ? 1 : 0;
  }

  async scard(key: string): Promise<number> {
    return this.sets.get(key)?.size || 0;
  }

  // Hash operations
  async hset(key: string, field: string, value: string): Promise<number> {
    if (!this.hashes.has(key)) {
      this.hashes.set(key, new Map());
    }
    const hash = this.hashes.get(key)!;
    const isNew = !hash.has(field);
    hash.set(field, value);
    return isNew ? 1 : 0;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) || null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    return Object.fromEntries(hash);
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    const hash = this.hashes.get(key);
    if (!hash) return 0;
    let deleted = 0;
    fields.forEach(f => {
      if (hash.delete(f)) deleted++;
    });
    return deleted;
  }

  async hexists(key: string, field: string): Promise<number> {
    return this.hashes.get(key)?.has(field) ? 1 : 0;
  }

  // Pipeline support
  pipeline() {
    const commands: Array<() => Promise<any>> = [];
    const mock = this;

    return {
      get(key: string) {
        commands.push(() => mock.get(key));
        return this;
      },
      set(key: string, value: string, ttl?: number) {
        commands.push(() => mock.set(key, value, ttl));
        return this;
      },
      incr(key: string) {
        commands.push(() => mock.incr(key));
        return this;
      },
      sadd(key: string, ...members: string[]) {
        commands.push(() => mock.sadd(key, ...members));
        return this;
      },
      hget(key: string, field: string) {
        commands.push(() => mock.hget(key, field));
        return this;
      },
      hset(key: string, field: string, value: string) {
        commands.push(() => mock.hset(key, field, value));
        return this;
      },
      hmget(key: string, ...fields: string[]) {
        commands.push(async () => {
          const results: (string | null)[] = [];
          for (const field of fields) {
            results.push(await mock.hget(key, field));
          }
          return results;
        });
        return this;
      },
      hgetall(key: string) {
        commands.push(() => mock.hgetall(key));
        return this;
      },
      async exec() {
        const results = [];
        for (const cmd of commands) {
          const result = await cmd();
          results.push([null, result]);
        }
        return results;
      },
    };
  }

  // Multi/transaction support
  multi() {
    return this.pipeline();
  }

  // Clear all data
  clear(): void {
    this.store.clear();
    this.sets.clear();
    this.hashes.clear();
  }

  // Get internal state for debugging
  getState() {
    return {
      store: Object.fromEntries(this.store),
      sets: Object.fromEntries(
        Array.from(this.sets.entries()).map(([k, v]) => [k, Array.from(v)])
      ),
      hashes: Object.fromEntries(
        Array.from(this.hashes.entries()).map(([k, v]) => [k, Object.fromEntries(v)])
      ),
    };
  }
}

// Singleton instance for tests
export const mockRedis = new MockRedis();

// Helper to create mock Redis module
export function createMockRedisModule() {
  return {
    getRedisClient: jest.fn().mockReturnValue(mockRedis),
    setRedisClient: jest.fn(),
  };
}
