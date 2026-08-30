import { readFileSync } from 'node:fs';
import path from 'node:path';

export const MANIFEST_PATH = 'capabilities.manifest.json';

export function loadCapabilityManifest(root = process.cwd()) {
  const file = path.join(root, MANIFEST_PATH);
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function validateCapabilityManifest(manifest) {
  if (!Array.isArray(manifest.mandatory) || !manifest.capabilities) {
    throw new Error('Capability manifest must define mandatory and capabilities');
  }
  const names = Object.keys(manifest.capabilities);
  const known = new Set(names);
  for (const name of manifest.mandatory) {
    if (typeof name !== 'string' || !known.has(name)) {
      throw new Error(`Mandatory capability is not defined: ${name}`);
    }
  }
  for (const [name, capability] of Object.entries(manifest.capabilities)) {
    if (!Array.isArray(capability.dependencies) || !Array.isArray(capability.sourcePaths)) {
      throw new Error(`Capability ${name} must define dependencies and sourcePaths`);
    }
    for (const dependency of capability.dependencies) {
      if (!known.has(dependency)) {
        throw new Error(`Capability ${name} depends on unknown capability ${dependency}`);
      }
    }
    for (const field of [
      'migrationPaths',
      'seedPaths',
      'configurationPaths',
      'environmentKeys',
      'workerProcesses',
      'composeServices',
      'documentation',
      'packageDependencies',
    ]) {
      if (!Array.isArray(capability[field]))
        throw new Error(`Capability ${name} has invalid ${field}`);
    }
    if (capability.testPaths !== undefined && !Array.isArray(capability.testPaths)) {
      throw new Error(`Capability ${name} has invalid testPaths`);
    }
    if (capability.contributions) {
      for (const field of [
        'apiModules',
        'configurationFragments',
        'packageScripts',
        'nestAssets',
        'seedDefinitions',
        'outboxQueues',
        'maintenanceCleaners',
        'composeVolumes',
        'environmentSections',
        'documentationSections',
      ]) {
        if (!Array.isArray(capability.contributions[field])) {
          throw new Error(`Capability ${name} has invalid contribution ${field}`);
        }
      }
    }
  }
  for (const name of names) visit(name, manifest.capabilities, [], new Set());
  return manifest;
}

function visit(name, capabilities, stack, complete) {
  if (complete.has(name)) return;
  if (stack.includes(name)) {
    throw new Error(`Capability dependency cycle: ${[...stack, name].join(' -> ')}`);
  }
  const capability = capabilities[name];
  for (const dependency of capability.dependencies)
    visit(dependency, capabilities, [...stack, name], complete);
  complete.add(name);
}

export function resolveCapabilities(selected = [], manifest) {
  const source = manifest ?? loadCapabilityManifest();
  validateCapabilityManifest(source);
  if (!Array.isArray(selected)) throw new Error('Selected capabilities must be an array');
  const optional = new Set(
    Object.keys(source.capabilities).filter((name) => !source.mandatory.includes(name)),
  );
  const requested = new Set(selected);
  for (const name of requested) {
    if (!optional.has(name)) throw new Error(`Unknown or mandatory optional capability: ${name}`);
  }
  const result = [];
  const included = new Set();
  const add = (name) => {
    if (included.has(name)) return;
    for (const dependency of source.capabilities[name].dependencies) add(dependency);
    included.add(name);
    result.push(name);
  };
  for (const name of source.mandatory) add(name);
  for (const name of selected) add(name);
  return {
    selected: result,
    addedDependencies: result.filter(
      (name) => !selected.includes(name) && !source.mandatory.includes(name),
    ),
  };
}

export function capabilityPackageDependencies(selected, manifest) {
  const source = manifest ?? loadCapabilityManifest();
  const resolved = resolveCapabilities(selected, source).selected;
  return [...new Set(resolved.flatMap((name) => source.capabilities[name].packageDependencies))];
}
