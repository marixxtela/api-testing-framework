import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';
import { buildApp } from '../src/api/app.js';

async function main(): Promise<void> {
  const app = await buildApp({ logger: false });
  await app.ready();

  const spec = app.swagger();
  const target = path.resolve('openapi/spec.yaml');
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, yaml.dump(spec, { noRefs: false, sortKeys: false }));

  await app.close();
  console.info(`OpenAPI spec exported to ${target}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
