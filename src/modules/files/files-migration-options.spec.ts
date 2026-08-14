import { parseFileMigrationOptions } from './files-migration-options';

describe(parseFileMigrationOptions.name, () => {
  it('parses a bounded dry run', () => {
    expect(
      parseFileMigrationOptions([
        '--from',
        'local',
        '--to',
        's3',
        '--batch-size',
        '10',
        '--dry-run',
      ]),
    ).toEqual({ from: 'local', to: 's3', batchSize: 10, dryRun: true, confirmed: false });
  });

  it.each([
    [['--unknown', 'value'], 'Unknown file migration argument'],
    [['--from', 'local', '--from', 's3', '--to', 's3'], 'Duplicate file migration argument'],
    [['--from', 'local'], '--from and --to'],
    [['--from', 'local', '--to', 's3', '--dry-run', '--confirm'], 'cannot be used together'],
  ])('rejects unsafe arguments', (args, message) => {
    expect(() => parseFileMigrationOptions(args)).toThrow(message);
  });
});
