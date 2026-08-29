import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import ts from 'typescript';

const sourceRoot = path.resolve('src');
const routeDecorators = new Set(['Delete', 'Get', 'Head', 'Options', 'Patch', 'Post', 'Put']);
const accessPolicyDecorators = new Set(['Public', 'RequireAuthenticated', 'RequirePermissions']);
const composedResponseDecorators = new Set([
  'ApiOffsetPaginatedResponse',
  'ApiCursorPaginatedResponse',
]);

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

function hasObjectProperty(call, propertyName) {
  const argument = call?.arguments[0];
  if (!argument || !ts.isObjectLiteralExpression(argument)) {
    return false;
  }

  return argument.properties.some((property) => {
    if (!('name' in property) || !property.name) {
      return false;
    }

    return (
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
      property.name.text === propertyName
    );
  });
}

function location(filePath, node) {
  const source = node.getSourceFile();
  const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
  return `${path.relative(process.cwd(), filePath)}:${(line + 1).toString()}`;
}

function containsArrayReturn(typeNode) {
  if (!typeNode) return false;
  if (ts.isArrayTypeNode(typeNode) || ts.isTupleTypeNode(typeNode)) return true;
  if (ts.isTypeReferenceNode(typeNode)) {
    const name = typeNode.typeName.getText();
    if (name === 'Array' || name === 'ReadonlyArray') return true;
    return typeNode.typeArguments?.some(containsArrayReturn) ?? false;
  }
  if (ts.isUnionTypeNode(typeNode) || ts.isIntersectionTypeNode(typeNode)) {
    return typeNode.types.some(containsArrayReturn);
  }
  return false;
}

function returnTypeContains(typeNode, fragment) {
  return Boolean(typeNode?.getText().includes(fragment));
}

const violations = [];
for (const filePath of walk(sourceRoot).filter((file) => file.endsWith('.controller.ts'))) {
  const sourceFile = ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  for (const statement of sourceFile.statements.filter(ts.isClassDeclaration)) {
    const classDecorators = decorators(statement);
    const controller = classDecorators.find(
      (decorator) => decoratorName(decorator) === 'Controller',
    );
    if (!controller) {
      continue;
    }

    const classLocation = location(filePath, statement);
    const classHasAccessPolicy = classDecorators.some((decorator) =>
      accessPolicyDecorators.has(decoratorName(decorator)),
    );
    if (!classDecorators.some((decorator) => decoratorName(decorator) === 'ApiTags')) {
      violations.push(`${classLocation} controller must declare @ApiTags`);
    }

    if (!hasObjectProperty(decoratorCall(controller), 'version')) {
      violations.push(`${classLocation} @Controller must declare an explicit version`);
    }

    for (const member of statement.members.filter(ts.isMethodDeclaration)) {
      const methodDecorators = decorators(member);
      if (!methodDecorators.some((decorator) => routeDecorators.has(decoratorName(decorator)))) {
        continue;
      }

      const methodLocation = location(filePath, member);
      if (
        !classHasAccessPolicy &&
        !methodDecorators.some((decorator) => accessPolicyDecorators.has(decoratorName(decorator)))
      ) {
        violations.push(
          `${methodLocation} route must declare Public, RequireAuthenticated, or RequirePermissions`,
        );
      }
      if (containsArrayReturn(member.type)) {
        violations.push(
          `${methodLocation} collection routes must return an explicit paginated contract, not an array`,
        );
      }
      const hasOffsetResponse = methodDecorators.some(
        (decorator) => decoratorName(decorator) === 'ApiOffsetPaginatedResponse',
      );
      const hasCursorResponse = methodDecorators.some(
        (decorator) => decoratorName(decorator) === 'ApiCursorPaginatedResponse',
      );
      if (returnTypeContains(member.type, 'OffsetPage') && !hasOffsetResponse) {
        violations.push(`${methodLocation} OffsetPage routes require @ApiOffsetPaginatedResponse`);
      }
      if (returnTypeContains(member.type, 'CursorPage') && !hasCursorResponse) {
        violations.push(`${methodLocation} CursorPage routes require @ApiCursorPaginatedResponse`);
      }
      const operation = methodDecorators.find(
        (decorator) => decoratorName(decorator) === 'ApiOperation',
      );
      if (
        !operation ||
        !hasObjectProperty(decoratorCall(operation), 'summary') ||
        !hasObjectProperty(decoratorCall(operation), 'description')
      ) {
        violations.push(
          `${methodLocation} route must document an ApiOperation summary and description`,
        );
      }

      const responses = methodDecorators.filter(
        (decorator) =>
          decoratorName(decorator)?.startsWith('Api') &&
          decoratorName(decorator)?.endsWith('Response'),
      );
      if (responses.length === 0) {
        violations.push(`${methodLocation} route must document every applicable response status`);
      }

      for (const response of responses) {
        if (composedResponseDecorators.has(decoratorName(response))) {
          continue;
        }
        const call = decoratorCall(response);
        if (!hasObjectProperty(call, 'description')) {
          violations.push(`${methodLocation} response documentation must explain when it occurs`);
        }
        if (!hasObjectProperty(call, 'content')) {
          violations.push(`${methodLocation} response documentation must include payload examples`);
        }
      }
    }
  }
}

if (violations.length > 0) {
  process.stderr.write(`API contract documentation violations:\n${violations.join('\n')}\n`);
  process.exitCode = 1;
}
