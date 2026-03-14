/**
 * Test Utilities - Helper functions for testing
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MockDatabase, createMockDrizzleDb } from '../mocks/mock-db';
import { MockRedis } from '../mocks/mock-redis';
import { MockOnnxSession } from '../mocks/mock-onnx';

// Re-export mocks for convenience
export { mockDb, mockRedis, mockOnnxSession } from '../mocks';

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout = 5000,
  interval = 100
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return;
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Create a mock NestJS module with common overrides
 */
export async function createTestModule(
  imports: any[] = [],
  providers: any[] = [],
  overrides: any[] = []
): Promise<TestingModule> {
  const builder = Test.createTestingModule({
    imports,
    providers,
  });

  // Apply overrides
  for (const override of overrides) {
    builder.overrideProvider(override.provide).useValue(override.useValue);
  }

  return builder.compile();
}

/**
 * Generate a random string
 */
export function randomString(length = 10): string {
  return Math.random().toString(36).substring(2, length + 2);
}

/**
 * Generate a random integer
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random float
 */
export function randomFloat(min: number, max: number, decimals = 2): number {
  const value = Math.random() * (max - min) + min;
  return parseFloat(value.toFixed(decimals));
}

/**
 * Generate a random IP address
 */
export function randomIp(): string {
  return `${randomInt(1, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}`;
}

/**
 * Generate a random user ID
 */
export function randomUserId(): string {
  return `user-${randomString(8)}`;
}

/**
 * Create a mock request object
 */
export function createMockRequest(overrides: any = {}): any {
  return {
    ip: '127.0.0.1',
    headers: {},
    body: {},
    query: {},
    params: {},
    ...overrides,
  };
}

/**
 * Create a mock response object
 */
export function createMockResponse(): any {
  const res: any = {
    statusCode: 200,
    _headers: {},
    _body: null,
  };
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body: any) => {
    res._body = body;
    return res;
  };
  res.send = (body: any) => {
    res._body = body;
    return res;
  };
  res.setHeader = (key: string, value: any) => {
    res._headers[key] = value;
    return res;
  };
  return res;
}

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Assert that an async function throws an error
 */
export async function expectThrowsAsync(
  fn: () => Promise<any>,
  errorMessage?: string
): Promise<void> {
  let threw = false;
  try {
    await fn();
  } catch (error: any) {
    threw = true;
    if (errorMessage) {
      expect(error.message).toContain(errorMessage);
    }
  }
  expect(threw).toBe(true);
}

/**
 * Create a date relative to now
 */
export function relativeDate(days: number, hours = 0, minutes = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(date.getHours() + hours);
  date.setMinutes(date.getMinutes() + minutes);
  return date;
}

/**
 * Reset all mock instances
 */
export function resetAllMocks(): void {
  const { mockDb, mockRedis, mockOnnxSession } = require('../mocks');
  mockDb.clear();
  mockRedis.clear();
  mockOnnxSession.reset();
}
