import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('node_modules');
const deniedLicenses = [
  /(^|\W)AGPL[- ]?3(?:\.0)?(?:-only|-or-later)?($|\W)/i,
  /(^|\W)GPL[- ]?3(?:\.0)?(?:-only|-or-later)?($|\W)/i,
];

function normalizeLicense(value) {
  if (typeof value === 'string') return value.trim();
  if (value && typeof value === 'object' && typeof value.type === 'string') {
    return value.type.trim();
  }
  return '';
}

async function packageDirectories(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const directories = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === '.bin') continue;
    const fullPath = path.join(directory, entry.name);

    if (entry.name.startsWith('@')) {
      const scopedEntries = await readdir(fullPath, { withFileTypes: true });
      for (const scopedEntry of scopedEntries) {
        if (scopedEntry.isDirectory()) directories.push(path.join(fullPath, scopedEntry.name));
      }
      continue;
    }

    directories.push(fullPath);
  }

  return directories;
}

async function inspectPackage(directory, findings, unknown) {
  const manifestPath = path.join(directory, 'package.json');

  try {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const license = normalizeLicense(manifest.license ?? manifest.licenses);
    const identifier = `${manifest.name ?? path.basename(directory)}@${manifest.version ?? 'unknown'}`;

    if (!license) {
      unknown.push(identifier);
    } else if (deniedLicenses.some((pattern) => pattern.test(license))) {
      findings.push({ identifier, license });
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  const nestedNodeModules = path.join(directory, 'node_modules');
  try {
    const nested = await packageDirectories(nestedNodeModules);
    for (const child of nested) await inspectPackage(child, findings, unknown);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const denied = [];
const unknown = [];
const topLevelPackages = await packageDirectories(root);
for (const directory of topLevelPackages) await inspectPackage(directory, denied, unknown);

if (unknown.length > 0) {
  console.log(`Dependency license metadata missing for ${unknown.length} package(s).`);
  for (const identifier of unknown.slice(0, 20)) console.log(`  - ${identifier}`);
  if (unknown.length > 20) console.log(`  - and ${unknown.length - 20} more`);
}

if (denied.length > 0) {
  console.error('Denied dependency licenses detected:');
  for (const finding of denied) console.error(`  - ${finding.identifier}: ${finding.license}`);
  process.exit(1);
}

console.log(`Dependency license validation passed for ${topLevelPackages.length} top-level package(s).`);
