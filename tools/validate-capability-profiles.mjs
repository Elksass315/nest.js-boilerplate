import { execFileSync, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { parse } from 'yaml';

import { initializeProject } from './init-project.mjs';
import { loadCapabilityManifest, resolveCapabilities } from './project-capabilities.mjs';

const OPTIONAL = ['files', 'user-avatars', 'invitations', 'feature-flags', 'sentry'];
const COREPACK_COMMAND = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
const EXCLUDED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'coverage', '.pnpm-store']);

export function resolvedProfiles(manifest = loadCapabilityManifest()) {
  const profiles = new Map();
  for (let mask = 0; mask < 2 ** OPTIONAL.length; mask += 1) {
    const requested = OPTIONAL.filter((_, index) => (mask & (1 << index)) !== 0);
    const resolved = resolveCapabilities(requested, manifest).selected.filter((name) =>
      OPTIONAL.includes(name),
    );
    const key = resolved.join(',');
    if (!profiles.has(key)) profiles.set(key, { requested, resolved });
  }
  return [...profiles.values()];
}

export async function validateGeneratedProfile(sourceRoot, profile, options = {}) {
  const sourceParent = path.dirname(path.resolve(sourceRoot));
  const temporaryRoot = mkdtempSync(path.join(sourceParent, '.nestjs-capability-profile-'));
  const cleanup = () => {
    const resolvedTemporaryRoot = path.resolve(temporaryRoot);
    if (
      path.dirname(resolvedTemporaryRoot) !== sourceParent ||
      !path.basename(resolvedTemporaryRoot).startsWith('.nestjs-capability-profile-')
    ) {
      throw new Error(`Refusing to remove unexpected profile directory: ${resolvedTemporaryRoot}`);
    }
    rmSync(resolvedTemporaryRoot, { recursive: true, force: true });
  };
  try {
    cpSync(sourceRoot, temporaryRoot, {
      recursive: true,
      filter: (source) => {
        const basename = path.basename(source);
        return !EXCLUDED_DIRECTORIES.has(basename);
      },
    });
    const configFile = path.join(temporaryRoot, 'initializer.json');
    writeFileSync(configFile, JSON.stringify(profileConfig(profile.requested)), 'utf8');
    execFileSync('git', ['init', '--initial-branch=feature/generated-profile'], {
      cwd: temporaryRoot,
      stdio: 'ignore',
    });
    execFileSync('git', ['config', 'user.email', 'generator@example.test'], { cwd: temporaryRoot });
    execFileSync('git', ['config', 'user.name', 'Capability Generator'], { cwd: temporaryRoot });
    execFileSync('git', ['add', '.'], { cwd: temporaryRoot });
    execFileSync('git', ['commit', '-m', 'generated profile fixture'], {
      cwd: temporaryRoot,
      stdio: 'ignore',
    });
    await initializeProject({
      root: temporaryRoot,
      config: configFile,
      skipValidation: true,
      skipLockfile: !options.runCommands,
    });
    if (options.runCommands && !existsSync(path.join(temporaryRoot, '.env'))) {
      cpSync(path.join(temporaryRoot, '.env.example'), path.join(temporaryRoot, '.env'));
    }
    assertProfileStructure(temporaryRoot, profile.resolved);
    if (options.runCommands) runProfileCommands(temporaryRoot, options.offline !== false);
    const profileName = profile.resolved.join(',') || 'minimal';
    cleanup();
    return profileName;
  } catch (error) {
    cleanup();
    throw error;
  }
}

export function assertProfileStructure(root, resolvedCapabilities) {
  const manifest = loadCapabilityManifest(root);
  const selected = new Set(resolvedCapabilities);
  const omitted = OPTIONAL.filter((name) => !selected.has(name));
  const failures = [];
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const nestCli = JSON.parse(readFileSync(path.join(root, 'nest-cli.json'), 'utf8'));
  const environment = readFileSync(path.join(root, '.env.example'), 'utf8');
  for (const name of omitted) {
    const capability = manifest.capabilities[name];
    for (const field of [
      'sourcePaths',
      'migrationPaths',
      'seedPaths',
      'configurationPaths',
      'documentation',
      'testPaths',
    ]) {
      for (const relative of capability[field] ?? []) {
        if (existsSync(path.join(root, relative))) failures.push(`${name} retained ${relative}`);
      }
    }
    for (const dependency of capability.packageDependencies) {
      if (packageJson.dependencies?.[dependency] || packageJson.devDependencies?.[dependency]) {
        failures.push(`${name} retained dependency ${dependency}`);
      }
    }
    for (const script of capability.contributions?.packageScripts ?? []) {
      if (packageJson.scripts?.[script]) failures.push(`${name} retained script ${script}`);
    }
    for (const asset of capability.contributions?.nestAssets ?? []) {
      if (nestCli.compilerOptions.assets.some((entry) => entry.include === asset)) {
        failures.push(`${name} retained Nest asset ${asset}`);
      }
    }
    for (const key of capability.environmentKeys) {
      if (new RegExp(`^${key}=`, 'mu').test(environment)) failures.push(`${name} retained ${key}`);
    }
  }
  for (const relative of ['compose.yaml', 'compose.dev.yaml', 'compose.deploy.yaml']) {
    const compose = parse(readFileSync(path.join(root, relative), 'utf8'));
    for (const name of omitted) {
      const capability = manifest.capabilities[name];
      for (const service of capability.composeServices) {
        if (compose.services?.[service]) failures.push(`${relative} retained service ${service}`);
      }
      for (const volume of capability.contributions?.composeVolumes ?? []) {
        if (compose.volumes?.[volume]) failures.push(`${relative} retained volume ${volume}`);
      }
    }
  }
  const source = readSource(root);
  for (const name of omitted) {
    if (source.includes(`@/modules/${name}`)) failures.push(`mandatory source imports ${name}`);
  }
  if (
    !selected.has('sentry') &&
    (source.includes('@sentry/') || source.includes('@/observability/sentry'))
  ) {
    failures.push('mandatory source retained Sentry');
  }
  if (failures.length > 0) throw new Error(`Generated profile violations:\n${failures.join('\n')}`);
}

function readSource(root) {
  const files = [];
  collectTypeScript(path.join(root, 'src'), files);
  return files.map((file) => readFileSync(file, 'utf8')).join('\n');
}

function collectTypeScript(directory, files) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) collectTypeScript(absolute, files);
    else if (absolute.endsWith('.ts') && !absolute.endsWith('.spec.ts')) files.push(absolute);
  }
}

function runProfileCommands(root, offline) {
  const installArguments = [
    'pnpm',
    '--config.minimumReleaseAge=0',
    '--config.minimumReleaseAgeExclude=*',
    '--config.verifyDepsBeforeRun=install',
    'install',
    ...(offline ? ['--offline'] : []),
    '--frozen-lockfile',
  ];
  const commands = [
    [COREPACK_COMMAND, installArguments],
    [COREPACK_COMMAND, ['pnpm', 'format:check']],
    [COREPACK_COMMAND, ['pnpm', 'lint']],
    [COREPACK_COMMAND, ['pnpm', 'typecheck']],
    [COREPACK_COMMAND, ['pnpm', 'arch:check']],
    [COREPACK_COMMAND, ['pnpm', 'docs:check']],
    [COREPACK_COMMAND, ['pnpm', 'openapi:generate']],
    [COREPACK_COMMAND, ['pnpm', 'openapi:check']],
    [COREPACK_COMMAND, ['pnpm', 'test:unit']],
    [COREPACK_COMMAND, ['pnpm', 'test:tools']],
    [COREPACK_COMMAND, ['pnpm', 'build']],
    [COREPACK_COMMAND, ['pnpm', 'docker:config']],
  ];
  for (const [command, args] of commands) {
    const effectiveArgs =
      args[0] === 'pnpm' && !args.includes('--config.minimumReleaseAge=0')
        ? [
            'pnpm',
            '--config.minimumReleaseAge=0',
            '--config.minimumReleaseAgeExclude=*',
            '--config.verifyDepsBeforeRun=install',
            ...args.slice(1),
          ]
        : args;
    const result = spawnSync(command, effectiveArgs, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (result.status !== 0)
      throw new Error(`Generated profile failed: ${command} ${effectiveArgs.join(' ')}`);
  }
}

function profileConfig(capabilities) {
  return {
    displayName: 'Generated Client API',
    packageName: 'generated-client-api',
    repositorySlug: 'generated-client-api',
    apiTitle: 'Generated Client API',
    databaseName: 'generated_client',
    imageRegistry: 'registry.example.test/generated-client-api',
    deploymentRoot: '/srv/generated-client-api',
    codeowners: '@company/platform',
    defaultLanguage: 'en',
    emailBranding: 'Generated Client',
    supportAddress: 'support@example.test',
    capabilities,
    fileDriver:
      capabilities.includes('files') || capabilities.includes('user-avatars')
        ? 'local-development-plus-s3-production'
        : null,
  };
}

async function main() {
  const runCommands = process.argv.includes('--commands');
  const offline = !process.argv.includes('--online');
  const profileArgument = process.argv.find((value) => value.startsWith('--profile='));
  const requestedProfile = profileArgument?.slice('--profile='.length);
  let profiles = resolvedProfiles();
  if (profiles.length !== 24) throw new Error(`Expected 24 profiles, received ${profiles.length}`);
  if (requestedProfile) {
    profiles = profiles.filter(
      ({ resolved }) => (resolved.join(',') || 'minimal') === requestedProfile,
    );
    if (profiles.length === 0) throw new Error(`Unknown resolved profile: ${requestedProfile}`);
  }
  for (const profile of profiles) {
    const name = await validateGeneratedProfile(process.cwd(), profile, { runCommands, offline });
    process.stdout.write(`Validated generated profile: ${name}\n`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Profile validation failed'}\n`,
    );
    process.exitCode = 1;
  });
}
