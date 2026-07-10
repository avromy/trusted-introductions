import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const requiredFiles = [
  '.github/pull_request_template.md',
  '.github/CODEOWNERS',
  'docs/Contributing.md',
  'docs/EngineeringStandards.md',
  'docs/PRGovernance.md',
  'docs/TestingStrategy.md',
  'docs/Deployment.md',
  '.env.example',
];

const failures = [];
const warnings = [];

for (const file of requiredFiles) {
  try {
    if (!statSync(file).isFile() || readFileSync(file, 'utf8').trim().length === 0) {
      failures.push(`${file} must be a non-empty file.`);
    }
  } catch {
    failures.push(`${file} is required.`);
  }
}

const migrationDirectory = 'supabase/migrations';
const migrations = readdirSync(migrationDirectory)
  .filter((file) => file.endsWith('.sql'))
  .sort();
const identifiers = new Map();

for (const migration of migrations) {
  const match = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(migration);
  if (!match) {
    failures.push(`Migration ${migration} must use NNNN_snake_case.sql naming.`);
    continue;
  }
  const identifier = match[1];
  if (identifiers.has(identifier)) {
    failures.push(`Migration identifier ${identifier} is duplicated by ${identifiers.get(identifier)} and ${migration}.`);
  }
  identifiers.set(identifier, migration);

  const sql = readFileSync(join(migrationDirectory, migration), 'utf8');
  if (/security\s+definer/i.test(sql) && !/set\s+search_path/i.test(sql)) {
    warnings.push(`${migration} contains legacy SECURITY DEFINER usage without an explicit search_path. Remediate in a dedicated migration.`);
  }
}

const orderedIds = [...identifiers.keys()].map(Number).sort((a, b) => a - b);
for (let index = 1; index < orderedIds.length; index += 1) {
  if (orderedIds[index] !== orderedIds[index - 1] + 1) {
    failures.push(`Migration sequence has a gap between ${String(orderedIds[index - 1]).padStart(4, '0')} and ${String(orderedIds[index]).padStart(4, '0')}.`);
  }
}

const template = readFileSync('.github/pull_request_template.md', 'utf8');
for (const heading of ['## Scope', '## Dependencies and Merge Order', '## Security, Privacy, and Trust Review', '## Testing Evidence']) {
  if (!template.includes(heading)) failures.push(`PR template must include ${heading}.`);
}

for (const warning of warnings) console.warn(`Repository quality warning: ${warning}`);

if (failures.length > 0) {
  console.error('Repository quality validation failed:\n');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Repository quality validation passed for ${migrations.length} migrations and ${requiredFiles.length} governance files.`);
