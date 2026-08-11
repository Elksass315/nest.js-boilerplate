import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const i18nRoot = path.join(root, 'src', 'i18n');
const definitions = readFileSync(path.join(root, 'src/core/errors/error-definitions.ts'), 'utf8');
const registered = new Set(
  [...definitions.matchAll(/messageKey:\s*'errors\.([a-zA-Z0-9]+)'/g)]
    .map((match) => match[1])
    .filter(Boolean),
);
const violations = [];

for (const language of readdirSync(i18nRoot, { withFileTypes: true }).filter((entry) =>
  entry.isDirectory(),
)) {
  const errorsPath = path.join(i18nRoot, language.name, 'errors.json');
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(errorsPath, 'utf8'));
  } catch (error) {
    violations.push(
      `${path.relative(root, errorsPath)} is missing or invalid JSON: ${String(error)}`,
    );
    continue;
  }
  const keys = new Set(Object.keys(parsed));
  for (const key of registered) {
    if (!keys.has(key))
      violations.push(`${language.name}/errors.json is missing registered key errors.${key}`);
  }
  for (const key of keys) {
    if (!registered.has(key))
      violations.push(`${language.name}/errors.json contains unregistered key errors.${key}`);
  }
}

const example = readFileSync(path.join(root, '.env.example'), 'utf8');
const supported = example
  .match(/^APP_SUPPORTED_LANGUAGES=(.+)$/m)?.[1]
  ?.split(',')
  .map((value) => value.trim()) ?? ['en'];
const available = new Set(
  readdirSync(i18nRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name),
);
for (const language of supported) {
  if (!available.has(language))
    violations.push(`APP_SUPPORTED_LANGUAGES includes ${language} without src/i18n/${language}`);
}

if (violations.length > 0) {
  process.stderr.write(`Translation contract violations:\n${violations.join('\n')}\n`);
  process.exitCode = 1;
}
