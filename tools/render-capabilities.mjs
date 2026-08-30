import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import prettier from 'prettier';
import { parse, stringify } from 'yaml';

const OPTIONAL_COMPOSE_FILES = ['compose.yaml', 'compose.dev.yaml', 'compose.deploy.yaml'];

export async function renderCapabilityContributions(root, config, manifest) {
  const selected = new Set(config.resolvedCapabilities);
  write(root, 'src/apps/api/capability-composition.ts', renderApiComposition(selected, manifest));
  write(root, 'src/apps/capability-worker-imports.ts', renderWorkerImports(selected));
  write(root, 'src/instrument-capabilities.ts', renderInstrumentation(selected));
  write(root, 'src/apps/maintenance-worker/capability-composition.ts', renderMaintenance(selected));
  write(root, 'src/apps/outbox-worker/capability-composition.ts', renderOutbox(selected));
  write(root, 'src/config/capability-configuration.ts', renderConfiguration(selected));
  write(root, 'src/database/seeds/seed.registry.ts', renderSeedRegistry(selected, manifest));
  renderPackage(root, selected, manifest);
  renderNestAssets(root, selected, manifest);
  renderCompose(root, selected, manifest);
  renderEnvironment(root, selected, manifest);
  renderMarkedDocumentation(root, selected);
  await formatGeneratedSource(root);
}

async function formatGeneratedSource(root) {
  const files = [
    'src/apps/api/capability-composition.ts',
    'src/apps/capability-worker-imports.ts',
    'src/apps/maintenance-worker/capability-composition.ts',
    'src/apps/outbox-worker/capability-composition.ts',
    'src/config/capability-configuration.ts',
    'src/database/seeds/seed.registry.ts',
    'src/instrument-capabilities.ts',
    'README.md',
    'docs/README.md',
    'initializer.json',
  ];
  for (const relative of files) {
    const file = path.join(root, relative);
    if (!existsSync(file)) continue;
    const options = (await prettier.resolveConfig(file)) ?? {};
    const parser = relative.endsWith('.json')
      ? 'json'
      : relative.endsWith('.md')
        ? 'markdown'
        : 'typescript';
    const source = readFileSync(file, 'utf8');
    writeFileSync(
      file,
      await prettier.format(source, { ...options, filepath: file, parser }),
      'utf8',
    );
  }
}

function contributions(selected, manifest, field) {
  return [...selected].flatMap((name) => manifest.capabilities[name].contributions?.[field] ?? []);
}

function capabilityValues(selected, manifest, field) {
  return [...selected].flatMap((name) => manifest.capabilities[name][field] ?? []);
}

function renderApiComposition(selected, manifest) {
  const modules = contributions(selected, manifest, 'apiModules');
  const sentry = selected.has('sentry');
  const imports = ["import type { DynamicModule, Provider, Type } from '@nestjs/common';"];
  if (sentry) {
    imports.push("import { SentryModule } from '@sentry/nestjs/setup';");
    imports.push("import { ERROR_REPORTER } from '@/core/error-reporting/error-reporter';");
    imports.push("import { SentryErrorReporter } from '@/observability/sentry';");
  }
  for (const module of modules) imports.push(`import { ${module.name} } from '${module.path}';`);
  const moduleValues = [
    ...(sentry ? ['SentryModule.forRoot()'] : []),
    ...modules.map((item) => item.name),
  ];
  const providers = sentry ? '[{ provide: ERROR_REPORTER, useClass: SentryErrorReporter }]' : '[]';
  return `${imports.join('\n')}\n\nexport const CAPABILITY_API_IMPORTS: (Type<unknown> | DynamicModule)[] = [${moduleValues.join(', ')}];\nexport const CAPABILITY_API_PROVIDERS: Provider[] = ${providers};\n`;
}

function renderWorkerImports(selected) {
  if (!selected.has('sentry')) {
    return "import type { DynamicModule } from '@nestjs/common';\n\nexport const CAPABILITY_WORKER_IMPORTS: DynamicModule[] = [];\n";
  }
  return "import type { DynamicModule } from '@nestjs/common';\nimport { SentryModule } from '@sentry/nestjs/setup';\n\nexport const CAPABILITY_WORKER_IMPORTS: DynamicModule[] = [SentryModule.forRoot()];\n";
}

function renderInstrumentation(selected) {
  return selected.has('sentry')
    ? "import { initializeSentry } from './observability/sentry';\n\ninitializeSentry();\n"
    : 'export {};\n';
}

function renderMaintenance(selected) {
  if (!selected.has('files')) {
    return "import type { Provider, Type } from '@nestjs/common';\n\nexport const CAPABILITY_MAINTENANCE_IMPORTS: Type<unknown>[] = [];\nexport const CAPABILITY_MAINTENANCE_PROVIDERS: Provider[] = [];\n";
  }
  return readFileSync(
    new URL('../src/apps/maintenance-worker/capability-composition.ts', import.meta.url),
    'utf8',
  );
}

function renderOutbox(selected) {
  if (!selected.has('files')) {
    return "import type { DynamicModule, Provider } from '@nestjs/common';\n\nexport const CAPABILITY_OUTBOX_IMPORTS: DynamicModule[] = [];\nexport const CAPABILITY_OUTBOX_PROVIDERS: Provider[] = [];\n";
  }
  return readFileSync(
    new URL('../src/apps/outbox-worker/capability-composition.ts', import.meta.url),
    'utf8',
  );
}

function renderConfiguration(selected) {
  const files = selected.has('files');
  const invitations = selected.has('invitations');
  const sentry = selected.has('sentry');
  if (!files && !invitations && !sentry) {
    return `import type Joi from 'joi';\n\nexport type CapabilityConfiguration = Record<string, never>;\n\nexport const capabilityApiEnvironmentSchema: Record<string, Joi.Schema> = {};\nexport const capabilityEnvironmentMessages: Record<string, string> = {};\n\nexport function validateApiCapabilityContradictions(environment: Record<string, unknown>, helpers: Joi.CustomHelpers): Joi.ErrorReport | undefined {\n  void environment;\n  void helpers;\n  return undefined;\n}\n\nexport function createApiCapabilityConfiguration(environment: Record<string, unknown>): CapabilityConfiguration {\n  void environment;\n  return {};\n}\n`;
  }
  const imports = ["import type Joi from 'joi';"];
  const properties = [];
  const schemas = [];
  const configValues = [];
  if (files) {
    imports.push(
      "import { createFilesConfig, filesEnvironmentSchema, parseFileStorageDrivers } from './files.config';",
    );
    imports.push("import type { FilesConfig } from './configuration.types';");
    properties.push('  files: FilesConfig;');
    schemas.push('  ...filesEnvironmentSchema,');
    configValues.push('    files: createFilesConfig(environment),');
  }
  if (invitations) {
    imports.push(
      "import { createInvitationsConfig, invitationsEnvironmentSchema } from './invitations.config';",
    );
    imports.push("import type { InvitationsConfig } from './configuration.types';");
    properties.push('  invitations: InvitationsConfig;');
    schemas.push('  ...invitationsEnvironmentSchema,');
    configValues.push('    invitations: createInvitationsConfig(environment),');
  }
  if (sentry) {
    imports.push(
      "import { createSentryConfig, sentryConfigurationAgrees, sentryEnvironmentSchema } from './sentry.config';",
    );
    imports.push("import type { SentryConfig } from './configuration.types';");
    properties.push('  sentry: SentryConfig;');
    schemas.push('  ...sentryEnvironmentSchema,');
    configValues.push('    sentry: createSentryConfig(environment),');
  }
  const messages = [];
  if (files) {
    messages.push(
      "  'environment.filesDrivers': 'FILES_READ_DRIVERS must include FILES_WRITE_DRIVER and S3 settings must be complete when s3 is enabled',",
    );
    messages.push(
      "  'environment.productionFiles': 'Production file writes require the S3 storage driver',",
    );
  }
  if (sentry)
    messages.push(
      "  'environment.sentryDsn': 'SENTRY_DSN must be set exactly when SENTRY_ENABLED is true',",
    );
  const validation = [];
  if (files) {
    validation.push(
      "  if (environment['NODE_ENV'] === 'production' && environment['FILES_WRITE_DRIVER'] !== 's3') return helpers.error('environment.productionFiles');",
    );
    validation.push(
      "  if (!filesConfigurationAgrees(environment)) return helpers.error('environment.filesDrivers');",
    );
  }
  if (sentry)
    validation.push(
      "  if (!sentryConfigurationAgrees(environment)) return helpers.error('environment.sentryDsn');",
    );
  if (files) {
    validation.push(
      "  const isManaged = environment['NODE_ENV'] === 'staging' || environment['NODE_ENV'] === 'production';",
    );
    validation.push(
      "  if (isManaged && filesSecretsAreUnsafe(environment)) return helpers.error('environment.managedSecrets');",
    );
  } else if (invitations) {
    validation.push(
      "  const isManaged = environment['NODE_ENV'] === 'staging' || environment['NODE_ENV'] === 'production';",
    );
  }
  if (files || invitations)
    validation.push(
      "  if (isManaged && !capabilityUrlsAreSafe(environment)) return helpers.error('environment.managedUrls');",
    );
  const helper = files
    ? `\nfunction filesConfigurationAgrees(environment: Record<string, unknown>): boolean {\n  const writeDriver = environment['FILES_WRITE_DRIVER'];\n  const readValue = environment['FILES_READ_DRIVERS'];\n  if (typeof writeDriver !== 'string' || typeof readValue !== 'string') return false;\n  let readDrivers: string[];\n  try { readDrivers = parseFileStorageDrivers(readValue); } catch { return false; }\n  if (!readDrivers.includes(writeDriver)) return false;\n  if (!readDrivers.includes('s3')) return true;\n  const bucket = environment['FILES_S3_BUCKET'];\n  const accessKey = environment['FILES_S3_ACCESS_KEY_ID'];\n  const secretKey = environment['FILES_S3_SECRET_ACCESS_KEY'];\n  const encryption = environment['FILES_S3_SERVER_SIDE_ENCRYPTION'];\n  const kmsKey = environment['FILES_S3_KMS_KEY_ID'];\n  const credentialsAgree = (typeof accessKey === 'string' && accessKey.length > 0) === (typeof secretKey === 'string' && secretKey.length > 0);\n  const kmsAgrees = encryption !== 'aws:kms' || (typeof kmsKey === 'string' && kmsKey.length > 0);\n  return typeof bucket === 'string' && bucket.length > 0 && credentialsAgree && kmsAgrees;\n}\n`
    : '';
  const managedHelper =
    files || invitations
      ? `\n${files ? "function filesSecretsAreUnsafe(environment: Record<string, unknown>): boolean {\n  return ['FILES_S3_ACCESS_KEY_ID', 'FILES_S3_SECRET_ACCESS_KEY'].some((key) => {\n    const value = environment[key];\n    return typeof value === 'string' && ['test', 'localstack'].includes(value);\n  });\n}\n\n" : ''}function capabilityUrlsAreSafe(environment: Record<string, unknown>): boolean {\n  for (const key of [${[...(invitations ? ["'TEAM_INVITATION_BASE_URL'"] : []), ...(files ? ["'FILES_S3_CDN_URL'"] : [])].join(', ')}]) {\n    const value = environment[key];\n    if (typeof value === 'string' && value.length > 0 && !isManagedUrl(value)) return false;\n  }\n${files ? "  const drivers = environment['FILES_READ_DRIVERS'];\n  if (typeof drivers === 'string' && drivers.split(',').map((item) => item.trim()).includes('s3')) {\n    const endpoint = environment['FILES_S3_ENDPOINT'];\n    if (typeof endpoint !== 'string' || !isManagedUrl(endpoint)) return false;\n  }\n" : ''}  return true;\n}\n\nfunction isManagedUrl(value: string): boolean {\n  try {\n    const url = new URL(value);\n    return url.protocol === 'https:' && !['localhost', '127.0.0.1', '::1'].includes(url.hostname) && !/example\\.(?:com|test)$/iu.test(url.hostname);\n  } catch { return false; }\n}\n`
      : '';
  return `${imports.join('\n')}\n\nexport interface CapabilityConfiguration {\n${properties.join('\n')}\n}\n\nexport const capabilityApiEnvironmentSchema = {\n${schemas.join('\n')}\n} satisfies Record<string, Joi.Schema>;\n\nexport const capabilityEnvironmentMessages = {\n${messages.join('\n')}\n};\n\nexport function validateApiCapabilityContradictions(environment: Record<string, unknown>, helpers: Joi.CustomHelpers): Joi.ErrorReport | undefined {\n${validation.join('\n')}\n  return undefined;\n}\n\nexport function createApiCapabilityConfiguration(environment: Record<string, unknown>): CapabilityConfiguration {\n  return {\n${configValues.join('\n')}\n  };\n}\n${helper}${managedHelper}`;
}

function renderSeedRegistry(selected, manifest) {
  const optional = contributions(selected, manifest, 'seedDefinitions');
  const seeds = [
    { name: 'rbacSeed', path: './002-rbac.seed' },
    { name: 'securityAuditRbacSeed', path: './004-security-audit-rbac.seed' },
    { name: 'userPermissionOverridesRbacSeed', path: './006-user-permission-overrides-rbac.seed' },
    ...optional,
  ];
  return `import type { SeedDefinition } from './seed.types';\n${seeds.map((seed) => `import { ${seed.name} } from '${seed.path}';`).join('\n')}\n\nexport const SEED_REGISTRY: readonly SeedDefinition[] = [\n${seeds.map((seed) => `  ${seed.name},`).join('\n')}\n];\n`;
}

function renderPackage(root, selected, manifest) {
  const file = path.join(root, 'package.json');
  const value = JSON.parse(readFileSync(file, 'utf8'));
  const keptDependencies = new Set(capabilityValues(selected, manifest, 'packageDependencies'));
  const allDependencies = Object.values(manifest.capabilities).flatMap(
    (item) => item.packageDependencies,
  );
  for (const dependency of allDependencies) {
    if (!keptDependencies.has(dependency)) {
      delete value.dependencies?.[dependency];
      delete value.devDependencies?.[dependency];
    }
  }
  const keptScripts = new Set(contributions(selected, manifest, 'packageScripts'));
  const allScripts = Object.values(manifest.capabilities).flatMap(
    (item) => item.contributions?.packageScripts ?? [],
  );
  for (const script of allScripts) if (!keptScripts.has(script)) delete value.scripts?.[script];
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function renderNestAssets(root, selected, manifest) {
  const file = path.join(root, 'nest-cli.json');
  const value = JSON.parse(readFileSync(file, 'utf8'));
  const kept = new Set(contributions(selected, manifest, 'nestAssets'));
  const optional = new Set(
    Object.values(manifest.capabilities).flatMap((item) => item.contributions?.nestAssets ?? []),
  );
  value.compilerOptions.assets = value.compilerOptions.assets.filter(
    (asset) => !optional.has(asset.include) || kept.has(asset.include),
  );
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function renderCompose(root, selected, manifest) {
  const keptServices = new Set(capabilityValues(selected, manifest, 'composeServices'));
  const optionalServices = new Set(
    Object.values(manifest.capabilities).flatMap((item) => item.composeServices),
  );
  const keptVolumes = new Set(contributions(selected, manifest, 'composeVolumes'));
  const optionalVolumes = new Set(
    Object.values(manifest.capabilities).flatMap(
      (item) => item.contributions?.composeVolumes ?? [],
    ),
  );
  for (const relative of OPTIONAL_COMPOSE_FILES) {
    const file = path.join(root, relative);
    if (!existsSync(file)) continue;
    const value = parse(readFileSync(file, 'utf8'));
    for (const service of optionalServices)
      if (!keptServices.has(service)) delete value.services?.[service];
    for (const service of Object.values(value.services ?? {})) {
      if (!Array.isArray(service.volumes)) continue;
      service.volumes = service.volumes.filter((mount) => {
        if (typeof mount !== 'string') return true;
        const volume = mount.split(':', 1)[0];
        return !optionalVolumes.has(volume) || keptVolumes.has(volume);
      });
      if (service.volumes.length === 0) delete service.volumes;
    }
    for (const volume of optionalVolumes)
      if (!keptVolumes.has(volume)) delete value.volumes?.[volume];
    if (value.volumes && Object.keys(value.volumes).length === 0) delete value.volumes;
    writeFileSync(file, stringify(value, { lineWidth: 100 }), 'utf8');
  }
}

function renderEnvironment(root, selected, manifest) {
  const file = path.join(root, '.env.example');
  let lines = readFileSync(file, 'utf8').split(/\r?\n/u);
  const kept = new Set(capabilityValues(selected, manifest, 'environmentKeys'));
  const optional = new Set(
    Object.values(manifest.capabilities).flatMap((item) => item.environmentKeys),
  );
  lines = lines.filter((line) => {
    const separator = line.indexOf('=');
    if (separator < 1) return true;
    const key = line.slice(0, separator);
    return !optional.has(key) || kept.has(key);
  });
  writeFileSync(file, `${lines.join('\n').replace(/\n+$/u, '')}\n`, 'utf8');
}

function renderMarkedDocumentation(root, selected) {
  for (const relative of ['README.md', 'docs/README.md']) {
    const file = path.join(root, relative);
    let content = readFileSync(file, 'utf8');
    content = content.replace(
      /<!-- capability:([a-z0-9-]+):start -->[\s\S]*?<!-- capability:\1:end -->\r?\n?/gu,
      (block, capability) => (selected.has(capability) ? block : ''),
    );
    writeFileSync(file, content, 'utf8');
  }
}

function write(root, relative, content) {
  writeFileSync(path.join(root, relative), content, 'utf8');
}
