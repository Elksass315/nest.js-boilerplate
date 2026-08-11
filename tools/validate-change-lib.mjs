export function normalizeChangedFiles(files) {
  return [
    ...new Set(files.map((file) => file.trim().replaceAll('\\', '/')).filter(Boolean)),
  ].sort();
}

export function buildChangeValidationPlan(inputFiles) {
  const files = normalizeChangedFiles(inputFiles);
  const matches = (pattern) => files.some((file) => pattern.test(file));
  const focusedTestFiles = files.filter(
    (file) => /^(src|test)\/.*\.ts$/.test(file) && !file.endsWith('.d.ts'),
  );
  const conditionalScripts = [];
  const documentationRequirements = [];

  const requireChanged = (reason, requiredFiles) => {
    for (const requiredFile of requiredFiles) {
      documentationRequirements.push({ reason, requiredFile });
    }
  };

  const changedFeatureNames = [
    ...new Set(
      files.flatMap((file) => {
        const match = /^src\/modules\/([^/]+)\/(?!.*(?:\.spec\.ts|\.test\.ts)$)/.exec(file);
        return match?.[1] ? [match[1]] : [];
      }),
    ),
  ];

  for (const featureName of changedFeatureNames) {
    requireChanged(`feature "${featureName}" changed`, [
      `docs/01-backend/modules/${featureName}.md`,
    ]);
  }

  if (matches(/^src\/config\/(?!.*(?:\.spec\.ts|\.test\.ts)$)/)) {
    requireChanged('runtime configuration changed', [
      '.env.example',
      'docs/01-backend/configuration.md',
    ]);
  }
  if (matches(/^(src\/common\/(pagination|swagger)\/|tools\/check-api-contracts\.mjs$)/)) {
    requireChanged('shared API contract or pagination behavior changed', [
      'docs/02-api/openapi-standard.md',
      'docs/02-api/pagination-standard.md',
    ]);
  }
  if (matches(/^src\/core\/errors\/(?!.*(?:\.spec\.ts|\.test\.ts)$)/)) {
    requireChanged('global error behavior changed', [
      'docs/01-backend/error-handling.md',
      'docs/02-api/error-catalog.md',
    ]);
  }
  if (matches(/^(src\/i18n\/|tools\/check-translations\.mjs$)/)) {
    requireChanged('internationalization behavior changed', [
      'docs/01-backend/internationalization.md',
    ]);
  }
  if (matches(/^(src\/database\/|tools\/(migration|seed)[^/]*\.mjs$)/)) {
    requireChanged('database, migration, or seed behavior changed', [
      'docs/01-backend/database.md',
    ]);
  }
  if (matches(/^(compose(\..+)?\.ya?ml$|docker\/|Dockerfile$)/)) {
    requireChanged('container or Compose behavior changed', ['docs/04-deployment/docker.md']);
  }
  if (matches(/^(\.github\/workflows\/|Jenkinsfile$)/)) {
    requireChanged('CI/CD behavior changed', ['docs/04-deployment/ci-cd.md']);
  }
  if (
    matches(
      /^(AGENTS\.md$|src\/modules\/AGENTS\.md$|\.agents\/skills\/|tools\/validate-change(?:-lib|-test)?\.mjs$)/,
    )
  ) {
    requireChanged('agent or validation policy changed', ['docs/03-dev-process/review-process.md']);
  }

  if (
    matches(
      /^(src\/(modules|core|common|shared|types)\/|tools\/(check-architecture|check-api-contracts|scaffold-feature)|\.dependency-cruiser\.cjs$)/,
    )
  ) {
    conditionalScripts.push('arch:check');
  }
  if (
    matches(
      /^(src\/i18n\/|src\/core\/errors\/|src\/config\/i18n\.|tools\/check-translations\.mjs$)/,
    )
  ) {
    conditionalScripts.push('i18n:check');
  }
  if (
    matches(
      /^(docs\/|AGENTS\.md$|src\/modules\/AGENTS\.md$|\.agents\/skills\/|src\/(modules|config|core|database)\/|src\/common\/(swagger|pagination)\/|compose\.|docker\/|Jenkinsfile$|\.github\/workflows\/)/,
    )
  ) {
    conditionalScripts.push('docs:check');
  }
  if (matches(/^(tools\/|\.agents\/skills\/|AGENTS\.md$|src\/modules\/AGENTS\.md$)/)) {
    conditionalScripts.push('test:tools');
  }
  if (matches(/^(package\.json$|pnpm-lock\.yaml$|pnpm-workspace\.yaml$|\.npmrc$)/)) {
    conditionalScripts.push('deps:check', 'deps:duplicates:check', 'licenses:check', 'audit:prod');
  }
  if (matches(/^(compose(\..+)?\.ya?ml$|docker\/)/)) {
    conditionalScripts.push('docker:config');
  }

  const documentationViolations = documentationRequirements.filter(
    ({ requiredFile }) => !files.includes(requiredFile),
  );

  return {
    files,
    focusedTestFiles,
    conditionalScripts,
    documentationRequirements,
    documentationViolations,
  };
}
