import 'dotenv/config';
import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { URL, fileURLToPath, pathToFileURL } from 'node:url';
import { ensureMemberAccountIndex } from './ensure-member-indexes.mjs';

export async function prepareDatabase() {
  const directory = mkdtempSync(join(tmpdir(), 'church-manager-schema-'));
  const schemaPath = join(directory, 'schema.prisma');
  // Prisma cannot represent a partial unique index. Exclude only that index
  // from the schema push, then recreate it with MongoDB's partial predicate.
  const source = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
  writeFileSync(schemaPath, source.replace(/(clerkUserId\s+String\?)\s+@unique/, '$1'));
  try {
    execFileSync(
      process.execPath,
      [
        fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url)),
        'db',
        'push',
        '--skip-generate',
        '--schema',
        schemaPath,
      ],
      { stdio: 'inherit', env: process.env },
    );
    await ensureMemberAccountIndex();
    process.stdout.write('Database schema and member account index are ready.\n');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await prepareDatabase();
