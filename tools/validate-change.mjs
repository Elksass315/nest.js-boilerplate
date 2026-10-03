import { spawnSync } from 'node:child_process';
import process from 'node:process';

import { buildChangeValidationPlan, normalizeChangedFiles } from './validate-change-lib.mjs';

function run(executable, args, options = {}) {
  process.stdout.write(`\n> ${args.join(' ')}\n`);
  const result = spawnSync(executable, args, { stdio: 'inherit', env: process.env, ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function gitLines(args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr.trim() || 'Unable to inspect Git changes');
  return result.stdout.split(/\r?\n/);
}

const changedFiles = normalizeChangedFiles([
  ...gitLines(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD']),
  ...gitLines(['ls-files', '--others', '--exclude-standard']),
]);
const plan = buildChangeValidationPlan(changedFiles);
const pnpmCli = process.env.npm_execpath;
const executable = pnpmCli ? process.execPath : process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const pnpmPrefix = pnpmCli ? [pnpmCli] : [];
const runPnpm = (args) =>
  run(executable, [...pnpmPrefix, ...args], {
    shell: !pnpmCli && process.platform === 'win32',
  });

process.stdout.write(
  `Smart validation: ${plan.files.length} changed file(s); conditional gates: ${
    plan.conditionalScripts.join(', ') || 'none'
  }\n`,
);

if (plan.documentationViolations.length > 0) {
  process.stderr.write(
    `Required documentation is missing from this change:\n${plan.documentationViolations
      .map(({ reason, requiredFile }) => `- ${requiredFile} (${reason})`)
      .join('\n')}\n`,
  );
  process.exit(1);
}

runPnpm(['format:check']);
runPnpm(['lint']);
runPnpm(['typecheck']);
runPnpm(['typecheck:all']);

if (plan.focusedTestFiles.length > 0) {
  runPnpm([
    'exec',
    'jest',
    '--runInBand',
    '--findRelatedTests',
    ...plan.focusedTestFiles,
    '--passWithNoTests',
  ]);
} else {
  process.stdout.write(
    '\n> No Jest-related TypeScript files changed; focused Jest run is not applicable.\n',
  );
}

for (const script of plan.conditionalScripts) {
  runPnpm([script]);
}

runPnpm(['build']);
