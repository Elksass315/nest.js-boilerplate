import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { loadCapabilityManifest, validateCapabilityManifest } from './project-capabilities.mjs';

const PRIVATE_IMPORT = /@\/modules\/([a-z0-9-]+)\/(?!index(?:['"]|\/)|(?:['"]))/g;

export function checkCapabilityBoundaries(root = process.cwd()) {
  const manifest = validateCapabilityManifest(loadCapabilityManifest(root));
  const failures = [];
  for (const [name, capability] of Object.entries(manifest.capabilities)) {
    for (const field of [
      'sourcePaths',
      'migrationPaths',
      'seedPaths',
      'configurationPaths',
      'documentation',
    ]) {
      for (const relative of capability[field]) {
        if (!existsSync(path.join(root, relative))) {
          failures.push(`Capability ${name} references missing ${field} path: ${relative}`);
        }
      }
    }
    for (const relative of capability.sourcePaths) {
      const absolute = path.join(root, relative);
      if (!existsSync(absolute)) continue;
      const files = absolute.endsWith('.ts') ? [absolute] : listTypeScriptFiles(absolute);
      for (const file of files) {
        const content = readFileSync(file, 'utf8');
        for (const match of content.matchAll(PRIVATE_IMPORT)) {
          const imported = match[1];
          if (imported === name || capability.dependencies.includes(imported)) continue;
          failures.push(`${path.relative(root, file)} imports private module ${imported}`);
        }
      }
    }
  }
  if (failures.length > 0)
    throw new Error(`Capability boundary violations:\n${failures.join('\n')}`);
  return manifest;
}

function listTypeScriptFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) files.push(...listTypeScriptFiles(absolute));
    else if (absolute.endsWith('.ts')) files.push(absolute);
  }
  return files;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    checkCapabilityBoundaries();
    process.stdout.write('Capability boundaries passed\n');
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : 'Capability check failed'}\n`);
    process.exitCode = 1;
  }
}
