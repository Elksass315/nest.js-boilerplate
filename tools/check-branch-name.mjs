import process from 'node:process';

import { currentBranch, validateBranchName, validateWritableBranch } from './branch-policy.mjs';

const branch = currentBranch();
const error = process.argv.includes('--write')
  ? validateWritableBranch(branch)
  : validateBranchName(branch);

if (error) {
  process.stderr.write(`${error}\n`);
  process.exitCode = 1;
}
