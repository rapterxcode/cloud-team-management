import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function parseAndLoadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

/**
 * Multi-profile 12-Factor environment loader.
 * Loads in precedence order:
 *   1. .env.<NODE_ENV>.local
 *   2. .env.local (skipped under test for deterministic test runs)
 *   3. .env.<NODE_ENV>
 *   4. .env
 */
export function loadEnv() {
  const mode = process.env.NODE_ENV || 'development';
  const envFiles = [
    `.env.${mode}.local`,
    ...(mode !== 'test' ? ['.env.local'] : []),
    `.env.${mode}`,
    '.env',
  ];

  const baseDirs = [
    resolve(fileURLToPath(new URL('../../..', import.meta.url))),
    resolve(fileURLToPath(new URL('../../../..', import.meta.url))),
    resolve(process.cwd()),
    resolve(process.cwd(), '..'),
  ];

  for (const dir of baseDirs) {
    for (const file of envFiles) {
      parseAndLoadEnvFile(resolve(dir, file));
    }
  }

  if (!process.env.DATABASE_URL && process.env.POSTGRES_PASSWORD) {
    const user = process.env.POSTGRES_USER || 'postgres';
    const password = encodeURIComponent(process.env.POSTGRES_PASSWORD);
    const host = process.env.POSTGRES_HOST || '127.0.0.1';
    const port = process.env.POSTGRES_PORT || '5432';
    const db =
      mode === 'test'
        ? process.env.POSTGRES_TEST_DB || 'ctm_test'
        : process.env.POSTGRES_DB || 'ctm';
    process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${db}`;
  }
}

export function envString(key: string, fallback = ''): string {
  const val = process.env[key];
  return val !== undefined && val !== '' ? val : fallback;
}

export function envInt(key: string, fallback: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function envBool(key: string, fallback: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return fallback;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

export function envList(key: string, fallback: string[] = []): string[] {
  const raw = process.env[key];
  if (!raw || !raw.trim()) return fallback;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

loadEnv();
