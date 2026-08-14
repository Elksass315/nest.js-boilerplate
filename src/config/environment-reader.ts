export function readString(environment: Record<string, unknown>, key: string): string {
  const value = environment[key];
  if (typeof value !== 'string') {
    throw new Error(`Validated environment value ${key} is not a string`);
  }
  return value;
}

export function readNumber(environment: Record<string, unknown>, key: string): number {
  const value = environment[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Validated environment value ${key} is not a number`);
  }
  return value;
}

export function readBoolean(environment: Record<string, unknown>, key: string): boolean {
  const value = environment[key];
  if (typeof value !== 'boolean') {
    throw new Error(`Validated environment value ${key} is not a boolean`);
  }
  return value;
}
