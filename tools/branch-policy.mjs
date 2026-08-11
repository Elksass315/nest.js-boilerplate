import { execFileSync } from 'node:child_process';

const protectedBranches = new Set(['develop', 'main']);
const shortLivedBranchPattern = /^(feature|fix|refactor|chore|hotfix)\/[a-z0-9]+(?:-[a-z0-9]+)*$/;
const releaseBranchPattern =
  /^release\/(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function currentBranch(cwd = process.cwd()) {
  return execFileSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf8' }).trim();
}

export function validateBranchName(branch) {
  if (!branch) {
    return 'Detached HEAD is read-only for agent changes; create an approved working branch first.';
  }

  if (
    !protectedBranches.has(branch) &&
    !shortLivedBranchPattern.test(branch) &&
    !releaseBranchPattern.test(branch)
  ) {
    return `Invalid branch name "${branch}". Use <type>/<kebab-case> or release/<semver>, for example feature/billing-plans or release/1.2.3.`;
  }

  return undefined;
}

export function validateWritableBranch(branch) {
  const namingError = validateBranchName(branch);
  if (namingError) {
    return namingError;
  }

  if (protectedBranches.has(branch)) {
    return `Branch "${branch}" is protected. Agents must create a short-lived branch before writing files.`;
  }

  return undefined;
}
