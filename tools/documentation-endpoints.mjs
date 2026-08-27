import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

const routeDecorators = new Set(['Delete', 'Get', 'Head', 'Options', 'Patch', 'Post', 'Put']);

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}

function decorators(node) {
  return ts.canHaveDecorators(node) ? (ts.getDecorators(node) ?? []) : [];
}

function decoratorCall(decorator) {
  return ts.isCallExpression(decorator.expression) ? decorator.expression : undefined;
}

function decoratorName(decorator) {
  const call = decoratorCall(decorator);
  return call && ts.isIdentifier(call.expression) ? call.expression.text : undefined;
}

function stringArgument(call) {
  const argument = call?.arguments[0];
  return argument && ts.isStringLiteral(argument) ? argument.text : '';
}

function controllerPath(call) {
  const argument = call?.arguments[0];
  if (!argument || !ts.isObjectLiteralExpression(argument)) return undefined;
  const property = argument.properties.find(
    (candidate) =>
      ts.isPropertyAssignment(candidate) &&
      ((ts.isIdentifier(candidate.name) && candidate.name.text === 'path') ||
        (ts.isStringLiteral(candidate.name) && candidate.name.text === 'path')),
  );
  return property && ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer)
    ? property.initializer.text
    : undefined;
}

function normalizeRoute(value) {
  const withoutPrefix = value.replace(/^\/api\/v1/, '').split('?')[0] ?? '';
  const route = `/${withoutPrefix}`.replaceAll(/\/{2,}/g, '/').replace(/\/$/, '');
  return route || '/';
}

export function extractBusinessEndpoints(modulesRoot) {
  const endpoints = [];
  for (const moduleEntry of readdirSync(modulesRoot, { withFileTypes: true }).filter((entry) =>
    entry.isDirectory(),
  )) {
    const moduleRoot = path.join(modulesRoot, moduleEntry.name);
    for (const filePath of walk(moduleRoot).filter((file) => file.endsWith('.controller.ts'))) {
      const source = ts.createSourceFile(
        filePath,
        readFileSync(filePath, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );
      for (const statement of source.statements.filter(ts.isClassDeclaration)) {
        const controller = decorators(statement).find(
          (decorator) => decoratorName(decorator) === 'Controller',
        );
        const basePath = controllerPath(decoratorCall(controller));
        if (!basePath) continue;

        for (const member of statement.members.filter(ts.isMethodDeclaration)) {
          for (const decorator of decorators(member)) {
            const method = decoratorName(decorator);
            if (!method || !routeDecorators.has(method)) continue;
            const routePath = stringArgument(decoratorCall(decorator));
            endpoints.push({
              module: moduleEntry.name,
              method: method.toUpperCase(),
              route: normalizeRoute(`${basePath}/${routePath}`),
            });
          }
        }
      }
    }
  }
  return endpoints;
}

export function extractDocumentedEndpoints(markdown) {
  const endpoints = new Set();
  for (const line of markdown.split(/\r?\n/)) {
    if (!line.trimStart().startsWith('|')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    const methods = cells[0];
    const route = cells[1]?.replaceAll('`', '');
    if (
      !methods ||
      !route ||
      !/^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)(?:\/|$)/.test(methods)
    ) {
      continue;
    }
    for (const method of methods.split('/')) {
      endpoints.add(`${method} ${normalizeRoute(route)}`);
    }
  }
  return endpoints;
}

export function validateEndpointTables({ modulesRoot, docsRoot }) {
  const documentedByModule = new Map();
  const violations = [];
  for (const endpoint of extractBusinessEndpoints(modulesRoot)) {
    let documented = documentedByModule.get(endpoint.module);
    if (!documented) {
      documented = extractDocumentedEndpoints(
        readFileSync(path.join(docsRoot, `${endpoint.module}.md`), 'utf8'),
      );
      documentedByModule.set(endpoint.module, documented);
    }
    const key = `${endpoint.method} ${endpoint.route}`;
    if (!documented.has(key)) {
      violations.push(`Feature "${endpoint.module}" endpoint ${key} is missing from its API table`);
    }
  }
  return violations;
}
