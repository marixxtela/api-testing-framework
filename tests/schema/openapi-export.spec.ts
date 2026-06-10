import { execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import yaml from 'js-yaml';
import OpenAPISchemaValidator from 'openapi-schema-validator';

// This spec runs the real script (scripts/export-openapi.ts) via tsx to make sure
// the end-to-end integration did not break: the spec is assembled and written to disk.
const TARGET = path.resolve('openapi/spec.yaml');

describe('scripts/export-openapi.ts script', () => {
  beforeAll(() => {
    if (existsSync(TARGET)) {
      rmSync(TARGET);
    }
    execSync('npx tsx scripts/export-openapi.ts', {
      stdio: 'pipe',
      env: { ...process.env, NODE_ENV: 'test' },
    });
  });

  afterAll(() => {
    if (existsSync(TARGET)) {
      rmSync(TARGET);
    }
  });

  it('generates the openapi/spec.yaml file', () => {
    expect(existsSync(TARGET)).toBe(true);
  });

  it('the generated file is loadable YAML', () => {
    const content = readFileSync(TARGET, 'utf8');
    const parsed = yaml.load(content);
    expect(parsed).toBeTypeOf('object');
    expect(parsed).not.toBeNull();
  });

  it('the content declares openapi 3.x and passes the OpenAPI 3 validator', () => {
    const spec = yaml.load(readFileSync(TARGET, 'utf8')) as { openapi: string };
    expect(spec.openapi).toMatch(/^3\./);

    const validator = new OpenAPISchemaValidator({ version: 3 });
    const result = validator.validate(spec as unknown as Parameters<typeof validator.validate>[0]);
    expect(result.errors, JSON.stringify(result.errors, null, 2)).toHaveLength(0);
  });
});
