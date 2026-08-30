import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { validateEndpointTables } from './documentation-endpoints.mjs';

const root = process.cwd();
const docsRoot = path.join(root, 'docs');
const modulesRoot = path.join(root, 'src', 'modules');
const requiredDocuments = [
  'README.md',
  '00-overview/architecture.md',
  '01-backend/module-architecture.md',
  '01-backend/configuration.md',
  '02-api/rest-standard.md',
  '02-api/openapi-standard.md',
  '02-api/error-catalog.md',
  '03-dev-process/branching-strategy.md',
  '04-deployment/ci-cd.md',
  'governance/documentation-policy.md',
  'governance/architecture-rules.md',
];

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

const violations = [];
for (const relativePath of requiredDocuments) {
  if (!existsSync(path.join(docsRoot, relativePath))) {
    violations.push(`Missing required documentation: docs/${relativePath}`);
  }
}

const markdownLink = /\[[^\]]*\]\(([^)]+)\)/g;
for (const filePath of walk(docsRoot).filter((file) => file.endsWith('.md'))) {
  const contents = readFileSync(filePath, 'utf8');
  for (const match of contents.matchAll(markdownLink)) {
    const rawTarget = match[1]?.trim();
    if (!rawTarget || /^(?:https?:|mailto:|#)/.test(rawTarget)) {
      continue;
    }

    const target = decodeURIComponent(rawTarget.split('#')[0] ?? '');
    if (target && !existsSync(path.resolve(path.dirname(filePath), target))) {
      violations.push(
        `${path.relative(root, filePath)} links to missing local target "${rawTarget}"`,
      );
    }
  }
}

for (const entry of readdirSync(modulesRoot, { withFileTypes: true }).filter((item) =>
  item.isDirectory(),
)) {
  const moduleDocument = path.join(docsRoot, '01-backend', 'modules', `${entry.name}.md`);
  if (!existsSync(moduleDocument)) {
    violations.push(`Feature "${entry.name}" requires docs/01-backend/modules/${entry.name}.md`);
  }
}

violations.push(
  ...validateEndpointTables({
    modulesRoot,
    docsRoot: path.join(docsRoot, '01-backend', 'modules'),
  }),
);

if (violations.length > 0) {
  process.stderr.write(`Documentation policy violations:\n${violations.join('\n')}\n`);
  process.exitCode = 1;
}
