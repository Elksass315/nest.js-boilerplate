import type { FileMigrationOptions } from './files.types';

const VALUE_ARGUMENTS = new Set(['--from', '--to', '--batch-size']);
const BOOLEAN_ARGUMENTS = new Set(['--dry-run', '--confirm']);

export function parseFileMigrationOptions(args: string[]): FileMigrationOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (!argument || (!VALUE_ARGUMENTS.has(argument) && !BOOLEAN_ARGUMENTS.has(argument))) {
      throw new Error(`Unknown file migration argument: ${argument ?? ''}`);
    }
    if (values.has(argument)) throw new Error(`Duplicate file migration argument: ${argument}`);
    if (BOOLEAN_ARGUMENTS.has(argument)) {
      values.set(argument, 'true');
      continue;
    }
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
    values.set(argument, value);
    index += 1;
  }
  const from = values.get('--from');
  const to = values.get('--to');
  if ((from !== 'local' && from !== 's3') || (to !== 'local' && to !== 's3')) {
    throw new Error('--from and --to must each be local or s3');
  }
  if (values.has('--dry-run') && values.has('--confirm')) {
    throw new Error('--dry-run and --confirm cannot be used together');
  }
  return {
    from,
    to,
    batchSize: Number(values.get('--batch-size') ?? '25'),
    dryRun: values.has('--dry-run'),
    confirmed: values.has('--confirm'),
  };
}
