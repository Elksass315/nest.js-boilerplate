import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const operations = new Set(['delete', 'get', 'head', 'options', 'patch', 'post', 'put']);

function resolveSchema(document, schema, seen = new Set()) {
  if (!schema || typeof schema !== 'object') return undefined;
  if (typeof schema.$ref !== 'string') return schema;
  if (seen.has(schema.$ref)) return undefined;
  seen.add(schema.$ref);
  const name = schema.$ref.split('/').at(-1);
  return name ? resolveSchema(document, document.components?.schemas?.[name], seen) : undefined;
}

function schemaHasExamples(document, input, seen = new Set()) {
  const schema = resolveSchema(document, input, seen);
  if (!schema) return false;
  if (Object.hasOwn(schema, 'example') || Object.hasOwn(schema, 'default') || schema.enum?.length) {
    return true;
  }
  if (Array.isArray(schema.oneOf) || Array.isArray(schema.anyOf) || Array.isArray(schema.allOf)) {
    const alternatives = schema.oneOf ?? schema.anyOf ?? schema.allOf;
    return alternatives.every((candidate) => schemaHasExamples(document, candidate, new Set(seen)));
  }
  if (schema.type === 'array') return schemaHasExamples(document, schema.items, new Set(seen));
  const properties = Object.values(schema.properties ?? {});
  return (
    properties.length > 0 &&
    properties.every((property) => schemaHasExamples(document, property, new Set(seen)))
  );
}

function mediaHasExample(document, media) {
  return (
    Object.hasOwn(media, 'example') ||
    (media.examples && Object.keys(media.examples).length > 0) ||
    schemaHasExamples(document, media.schema)
  );
}

function responseExamples(response) {
  const examples = [];
  for (const media of Object.values(response.content ?? {})) {
    if (media.example !== undefined) examples.push(media.example);
    for (const candidate of Object.values(media.examples ?? {})) {
      examples.push(candidate?.value ?? candidate);
    }
  }
  return examples;
}

export function lintOpenApi(document) {
  const violations = [];
  const stableErrors = document['x-stable-errors'] ?? {};

  for (const [route, pathItem] of Object.entries(document.paths ?? {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!operations.has(method)) continue;
      const location = `${method.toUpperCase()} ${route}`;
      if (!operation.operationId || !operation.summary || !operation.description) {
        violations.push(`${location} requires operationId, summary, and description`);
      }

      if (operation.requestBody) {
        const media = Object.values(operation.requestBody.content ?? {});
        if (media.length === 0 || !media.every((item) => mediaHasExample(document, item))) {
          violations.push(`${location} request body requires concrete examples`);
        }
      }

      const responses = Object.entries(operation.responses ?? {});
      const success = responses.filter(([status]) => /^[23]\d\d$/.test(status));
      if (success.length === 0)
        violations.push(`${location} requires a documented success response`);
      for (const [status, response] of success) {
        if (status === '204') continue;
        const media = Object.values(response.content ?? {});
        if (media.length === 0 || !media.every((item) => mediaHasExample(document, item))) {
          violations.push(`${location} ${status} response requires a concrete example`);
        }
      }

      for (const [status, response] of responses.filter(([code]) => /^[45]\d\d$/.test(code))) {
        const examples = responseExamples(response);
        if (examples.length === 0) {
          violations.push(`${location} ${status} error response requires a stable error example`);
          continue;
        }
        for (const example of examples) {
          const definition = stableErrors[example?.code];
          if (
            !definition ||
            definition.statusCode !== Number(status) ||
            definition.message !== example?.message ||
            example?.statusCode !== Number(status)
          ) {
            violations.push(
              `${location} ${status} contains an unknown or inconsistent stable error`,
            );
          }
        }
      }
    }
  }
  return violations;
}

if (pathToFileURL(path.resolve(process.argv[1] ?? '')).href === import.meta.url) {
  const inputPath = process.argv[2] ?? '.tmp/openapi.json';
  const violations = lintOpenApi(JSON.parse(readFileSync(inputPath, 'utf8')));
  if (violations.length > 0) {
    process.stderr.write(`OpenAPI contract violations:\n${violations.join('\n')}\n`);
    process.exitCode = 1;
  }
}
