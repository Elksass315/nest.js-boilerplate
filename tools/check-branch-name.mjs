import { execFileSync } from 'node:child_process';
import process from 'node:process';

const branch = execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
const protectedBranches = new Set(['main', 'develop']);
const branchPattern = /^(feature|fix|refactor|chore|release|hotfix)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

if (branch && !protectedBranches.has(branch) && !branchPattern.test(branch)) {
  process.stderr.write(
    `Invalid branch name "${branch}". Use <type>/<kebab-case>, for example feature/billing-plans.\n`,
  );
  process.exitCode = 1;
}
