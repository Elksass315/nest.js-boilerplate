import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const DEFAULT_THRESHOLD = 80;

export function parseChangedLines(diff) {
  const changed = new Map();
  let currentFile;

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith('+++ b/')) {
      currentFile = line.slice(6).replaceAll('/', path.sep);
      if (!changed.has(currentFile)) changed.set(currentFile, new Set());
      continue;
    }

    const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/);
    if (!match || !currentFile) continue;
    const start = Number(match[1]);
    const count = Number(match[2] ?? 1);
    const lines = changed.get(currentFile);
    if (!lines) continue;
    for (let offset = 0; offset < count; offset += 1) lines.add(start + offset);
  }

  return changed;
}

export function calculateChangedCoverage({ coverage, changedLines, root = process.cwd() }) {
  let coverable = 0;
  let covered = 0;
  const uncovered = [];

  for (const [fileName, lines] of changedLines) {
    const absolutePath = path.resolve(root, fileName);
    const fileCoverage = coverage[absolutePath] ?? coverage[absolutePath.replaceAll('\\', '/')];
    if (!fileCoverage) continue;

    const lineHits = new Map();
    for (const [statementId, statement] of Object.entries(fileCoverage.statementMap)) {
      const hits = fileCoverage.s[statementId] ?? 0;
      const line = statement.start.line;
      lineHits.set(line, Math.max(lineHits.get(line) ?? 0, hits));
    }

    for (const line of lines) {
      const hits = lineHits.get(line);
      if (hits === undefined) continue;
      coverable += 1;
      if (hits > 0) covered += 1;
      else uncovered.push(`${fileName}:${String(line)}`);
    }
  }

  return {
    coverable,
    covered,
    percentage: coverable === 0 ? 100 : (covered / coverable) * 100,
    uncovered,
  };
}

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
}

function run() {
  const base = argumentValue('--base', 'origin/develop');
  const coveragePath = argumentValue('--coverage', 'coverage/coverage-final.json');
  const threshold = Number(argumentValue('--threshold', String(DEFAULT_THRESHOLD)));

  if (!base || !coveragePath || !Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    throw new Error(
      'Usage: check-changed-coverage [--base <git-ref>] [--coverage <file>] [--threshold <0-100>]',
    );
  }
  if (!existsSync(coveragePath)) {
    throw new Error(`Coverage artifact not found: ${coveragePath}. Run pnpm test:cov first.`);
  }

  const diff = spawnSync('git', ['diff', '--unified=0', '--no-color', base, '--', 'src'], {
    encoding: 'utf8',
  });
  if (diff.status !== 0) {
    throw new Error(`Unable to compare changed coverage with ${base}: ${diff.stderr.trim()}`);
  }

  const result = calculateChangedCoverage({
    coverage: JSON.parse(readFileSync(coveragePath, 'utf8')),
    changedLines: parseChangedLines(diff.stdout),
  });
  process.stdout.write(
    `Changed executable line coverage: ${result.percentage.toFixed(2)}% (${String(result.covered)}/${String(result.coverable)})\n`,
  );
  if (result.percentage < threshold) {
    const locations = result.uncovered.slice(0, 25).join('\n');
    throw new Error(
      `Changed coverage is below ${String(threshold)}%. Uncovered changed lines:\n${locations}`,
    );
  }
}

if (pathToFileURL(path.resolve(process.argv[1] ?? '')).href === import.meta.url) {
  try {
    run();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
