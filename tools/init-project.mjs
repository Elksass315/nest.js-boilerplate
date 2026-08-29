import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { pathToFileURL } from 'node:url';

import { loadCapabilityManifest, resolveCapabilities } from './project-capabilities.mjs';
import { renderCapabilityContributions } from './render-capabilities.mjs';

const SOURCE_MARKER = '.company-template-source.json';
const OUTPUT_MARKER = '.company-template.json';
const PROTECTED_BRANCHES = new Set(['main', 'develop']);
const COREPACK_COMMAND = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
const TEXT_EXTENSIONS = new Set([
  '.json',
  '.md',
  '.mjs',
  '.ts',
  '.yml',
  '.yaml',
  '.jsonc',
  '.lock',
  '.txt',
]);

export function parseArguments(argv) {
  const options = {
    root: process.cwd(),
    dryRun: argv.includes('--dry-run'),
    skipValidation: argv.includes('--skip-validation'),
  };
  const rootIndex = argv.indexOf('--root');
  if (rootIndex >= 0) {
    const root = argv[rootIndex + 1];
    if (!root) throw new Error('--root requires a directory');
    options.root = path.resolve(root);
  }
  const configIndex = argv.indexOf('--config');
  if (configIndex >= 0) {
    const config = argv[configIndex + 1];
    if (!config) throw new Error('--config requires a JSON file');
    options.config = path.resolve(options.root, config);
  }
  return options;
}

export function assertUntouchedTemplate(root) {
  if (!existsSync(path.join(root, SOURCE_MARKER))) {
    throw new Error(`Untouched template marker is missing: ${SOURCE_MARKER}`);
  }
  if (existsSync(path.join(root, OUTPUT_MARKER))) {
    throw new Error('This project has already been initialized (.company-template.json exists)');
  }
  const status = execFileSync('git', ['status', '--porcelain'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  if (status) throw new Error('Initialization requires a clean git worktree');
}

export function normalizeProjectConfig(input, manifest = loadCapabilityManifest()) {
  const required = [
    'displayName',
    'packageName',
    'repositorySlug',
    'apiTitle',
    'databaseName',
    'imageRegistry',
    'deploymentRoot',
    'codeowners',
    'defaultLanguage',
    'emailBranding',
    'supportAddress',
  ];
  for (const key of required) {
    if (typeof input?.[key] !== 'string' || input[key].trim().length === 0)
      throw new Error(`Missing initializer value: ${key}`);
  }
  if (!/^@[a-z0-9._-]+\/[a-z0-9._-]+$|^[a-z0-9][a-z0-9._-]*$/.test(input.packageName))
    throw new Error('packageName must be a valid npm package name');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(input.repositorySlug))
    throw new Error('repositorySlug must be lowercase kebab-case');
  const selected = Array.isArray(input.capabilities)
    ? input.capabilities
    : typeof input.capabilities === 'string'
      ? input.capabilities
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
  const resolved = resolveCapabilities(selected, manifest);
  const fileDriver = input.fileDriver ?? null;
  if (
    resolved.selected.includes('files') &&
    !['s3', 'local-development-plus-s3-production', 'both-provider-migration'].includes(fileDriver)
  ) {
    throw new Error(
      'fileDriver must be s3, local-development-plus-s3-production, or both-provider-migration when files are selected',
    );
  }
  return {
    ...input,
    capabilities: selected,
    resolvedCapabilities: resolved.selected,
    addedDependencies: resolved.addedDependencies,
    fileDriver,
  };
}

function promptQuestions() {
  return [
    ['displayName', 'Project display name'],
    ['packageName', 'Package name'],
    ['repositorySlug', 'Repository slug'],
    ['apiTitle', 'API title'],
    ['databaseName', 'Database name'],
    ['imageRegistry', 'Image registry'],
    ['deploymentRoot', 'Deployment root'],
    ['codeowners', 'CODEOWNERS entry'],
    ['defaultLanguage', 'Default language'],
    ['emailBranding', 'Email branding/company name'],
    ['supportAddress', 'Support address'],
  ];
}

async function collectConfig(manifest) {
  const input = {};
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (const [key, question] of promptQuestions())
      input[key] = await rl.question(`${question}: `);
    const optional = Object.keys(manifest.capabilities).filter(
      (name) => !manifest.mandatory.includes(name),
    );
    const selected = await rl.question(
      `Optional capabilities (${optional.join(', ')}; comma-separated, blank for none): `,
    );
    input.capabilities = selected;
    if (
      selected
        .split(',')
        .map((value) => value.trim())
        .includes('files') ||
      selected.includes('user-avatars')
    ) {
      input.fileDriver = await rl.question(
        'File storage driver (s3/local-development-plus-s3-production/both-provider-migration): ',
      );
    }
    return input;
  } finally {
    rl.close();
  }
}

function collectFiles(root, directory = root) {
  const files = [];
  for (const entry of readdirSync(directory)) {
    if (entry === '.git' || entry === 'node_modules' || entry === 'dist' || entry === 'coverage')
      continue;
    const full = path.join(directory, entry);
    const stat = lstatSync(full);
    if (stat.isDirectory()) files.push(...collectFiles(root, full));
    else if (
      TEXT_EXTENSIONS.has(path.extname(entry).toLowerCase()) ||
      entry === 'Dockerfile' ||
      entry === 'Jenkinsfile'
    )
      files.push(full);
  }
  return files;
}

export function removeOptionalContent(root, config, manifest) {
  const selected = new Set(config.resolvedCapabilities);
  const protectedPaths = new Set(
    manifest.mandatory.flatMap((name) => {
      const capability = manifest.capabilities[name];
      return [
        ...capability.sourcePaths,
        ...capability.migrationPaths,
        ...capability.seedPaths,
        ...capability.configurationPaths,
        ...capability.documentation,
        ...(capability.testPaths ?? []),
      ];
    }),
  );
  const paths = new Set();
  for (const [name, capability] of Object.entries(manifest.capabilities)) {
    if (manifest.mandatory.includes(name) || selected.has(name)) continue;
    for (const field of [
      'sourcePaths',
      'migrationPaths',
      'seedPaths',
      'configurationPaths',
      'documentation',
      'testPaths',
    ]) {
      for (const relative of capability[field] ?? []) {
        if (protectedPaths.has(relative)) continue;
        paths.add(relative);
      }
    }
  }
  for (const relative of paths) {
    const target = path.resolve(root, relative);
    if (target !== root && !target.startsWith(`${root}${path.sep}`))
      throw new Error(`Unsafe capability path: ${relative}`);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
  }
  const packageFile = path.join(root, 'package.json');
  if (existsSync(packageFile)) {
    const packageJson = JSON.parse(readFileSync(packageFile, 'utf8'));
    const dependencies = new Set(
      config.resolvedCapabilities.flatMap(
        (name) => manifest.capabilities[name].packageDependencies,
      ),
    );
    for (const name of Object.values(manifest.capabilities).flatMap(
      (capability) => capability.packageDependencies,
    )) {
      if (!dependencies.has(name)) {
        delete packageJson.dependencies?.[name];
        delete packageJson.devDependencies?.[name];
      }
    }
    writeFileSync(packageFile, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
  }
}

function renameTemplateIdentities(root, config) {
  const replacements = [
    ['nestjs-saas-boilerplate', config.packageName],
    ['nestjs-saas-api', config.repositorySlug],
    ['nestjs-saas', config.repositorySlug],
    ['NestJS SaaS Boilerplate', config.displayName],
    ['NestJS SaaS', config.displayName],
  ];
  for (const file of collectFiles(root)) {
    const original = readFileSync(file);
    if (original.includes(0)) continue;
    let text = original.toString('utf8');
    for (const [from, to] of replacements) text = text.split(from).join(to);
    if (text !== original.toString('utf8')) writeFileSync(file, text, 'utf8');
  }
}

function ensureInitializationBranch(root, dryRun) {
  const branch = execFileSync('git', ['branch', '--show-current'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  if (!PROTECTED_BRANCHES.has(branch) || dryRun) return branch;
  const existing = execFileSync('git', ['branch', '--list', 'chore/initialize-project'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  if (existing)
    execFileSync('git', ['switch', 'chore/initialize-project'], { cwd: root, stdio: 'inherit' });
  else
    execFileSync('git', ['switch', '-c', 'chore/initialize-project'], {
      cwd: root,
      stdio: 'inherit',
    });
  return 'chore/initialize-project';
}

function writeTemplateMetadata(root, config, sourceMarker) {
  writeFileSync(
    path.join(root, OUTPUT_MARKER),
    `${JSON.stringify(
      {
        schemaVersion: 1,
        sourceVersion: sourceMarker.schemaVersion,
        generatorVersion: sourceMarker.generatorVersion,
        initializedAt: new Date().toISOString(),
        selectedCapabilities: config.resolvedCapabilities,
        requestedCapabilities: config.capabilities,
        resolvedCapabilities: config.resolvedCapabilities,
        addedDependencies: config.addedDependencies,
        fileDriver: config.fileDriver,
        storageChoice: config.fileDriver,
        compatibility: { apiVersion: 'v1', errorSemantics: 'stable-error-catalog' },
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
}

function runValidation(root) {
  const commands = [
    [
      COREPACK_COMMAND,
      [
        'pnpm',
        '--config.minimumReleaseAge=0',
        '--config.minimumReleaseAgeExclude=*',
        '--config.verifyDepsBeforeRun=install',
        'install',
        '--offline',
        '--frozen-lockfile',
      ],
    ],
    [COREPACK_COMMAND, ['pnpm', 'format:check']],
    [COREPACK_COMMAND, ['pnpm', 'typecheck']],
    [COREPACK_COMMAND, ['pnpm', 'arch:check']],
    [COREPACK_COMMAND, ['pnpm', 'docs:check']],
    [COREPACK_COMMAND, ['pnpm', 'test:unit']],
    [COREPACK_COMMAND, ['pnpm', 'build']],
    [COREPACK_COMMAND, ['pnpm', 'docker:config']],
  ];
  for (const [command, args] of commands) {
    const result = spawnSync(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (result.status !== 0)
      throw new Error(`Initializer validation failed: ${command} ${args.join(' ')}`);
  }
}

export async function initializeProject(options) {
  const manifest = loadCapabilityManifest(options.root);
  assertUntouchedTemplate(options.root);
  const raw = options.config
    ? JSON.parse(readFileSync(options.config, 'utf8'))
    : await collectConfig(manifest);
  const config = normalizeProjectConfig(raw, manifest);
  const branch = ensureInitializationBranch(options.root, options.dryRun);
  if (options.dryRun) return { branch, config };
  await renderCapabilityContributions(options.root, config, manifest);
  removeOptionalContent(options.root, config, manifest);
  if (!options.skipLockfile) {
    const lockfile = spawnSync(
      COREPACK_COMMAND,
      [
        'pnpm',
        '--config.minimumReleaseAge=0',
        '--config.minimumReleaseAgeExclude=*',
        '--config.verifyDepsBeforeRun=install',
        'install',
        '--lockfile-only',
        '--offline',
      ],
      {
        cwd: options.root,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      },
    );
    if (lockfile.status !== 0) throw new Error('Failed to render the capability-specific lockfile');
  }
  renameTemplateIdentities(options.root, config);
  const sourceMarker = JSON.parse(readFileSync(path.join(options.root, SOURCE_MARKER), 'utf8'));
  writeTemplateMetadata(options.root, config, sourceMarker);
  if (!options.skipValidation) runValidation(options.root);
  return { branch, config };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  initializeProject(parseArguments(process.argv.slice(2)))
    .then(({ branch, config }) => {
      process.stdout.write(
        `Initialized ${config.displayName} on ${branch}\nCapabilities: ${config.resolvedCapabilities.join(', ')}\n`,
      );
      if (config.addedDependencies.length > 0)
        process.stdout.write(`Added dependencies: ${config.addedDependencies.join(', ')}\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : 'Initialization failed'}\n`);
      process.exitCode = 1;
    });
}
