import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const SOURCE_ROOT = path.resolve('src');
const MODULES_ROOT = path.join(SOURCE_ROOT, 'modules');
const importPattern = /(?:from\s+|import\s*)['"]([^'"]+)['"]/g;

function walk(directory) {
  if (!isDirectory(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function isDirectory(target) {
  try {
    return statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function featureName(filePath) {
  return path.relative(MODULES_ROOT, filePath).split(path.sep)[0];
}

function importedFeature(specifier, filePath) {
  if (specifier.startsWith('@/modules/')) {
    const segments = specifier.slice('@/modules/'.length).split('/');
    return { feature: segments[0], isPublic: segments.length === 1 };
  }

  if (!specifier.startsWith('.')) {
    return undefined;
  }

  const resolved = path.resolve(path.dirname(filePath), specifier);
  if (!resolved.startsWith(MODULES_ROOT)) {
    return undefined;
  }

  const segments = path.relative(MODULES_ROOT, resolved).split(path.sep);
  return {
    feature: segments[0],
    isPublic: segments.length === 1 || segments[1] === 'index',
  };
}

const violations = [];
for (const filePath of walk(MODULES_ROOT).filter((file) => file.endsWith('.ts'))) {
  const sourceFeature = featureName(filePath);
  const source = readFileSync(filePath, 'utf8');

  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (!specifier) {
      continue;
    }

    const target = importedFeature(specifier, filePath);
    if (target && target.feature !== sourceFeature && !target.isPublic) {
      violations.push(
        `${path.relative(process.cwd(), filePath)} imports private feature path "${specifier}"`,
      );
    }
  }
}

if (violations.length > 0) {
  process.stderr.write(`Architecture boundary violations:\n${violations.join('\n')}\n`);
  process.exitCode = 1;
}
