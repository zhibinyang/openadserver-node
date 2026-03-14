/**
 * Jest Global Setup
 * Runs once before all tests
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export default async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DB_HOST = process.env.DB_HOST || 'localhost';
  process.env.DB_PORT = process.env.DB_PORT || '5432';
  process.env.DB_USER = process.env.DB_USER || 'postgres';
  process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'postgres';
  process.env.DB_NAME = process.env.DB_NAME || 'openadserver_test';
  process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
  process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';

  // Ensure coverage directory exists
  const coverageDir = join(__dirname, '..', 'coverage');
  if (!existsSync(coverageDir)) {
    mkdirSync(coverageDir, { recursive: true });
  }

  console.log('Test environment initialized');
};
