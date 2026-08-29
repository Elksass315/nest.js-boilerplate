import { Injectable } from '@nestjs/common';

export type ReadinessState = 'up' | 'down';

@Injectable()
export class ReadinessRegistry {
  private readonly checks = new Map<string, () => Promise<unknown>>();

  public register(name: string, check: () => Promise<unknown>): () => void {
    if (this.checks.has(name)) throw new Error(`Readiness check is already registered: ${name}`);
    this.checks.set(name, check);
    return () => this.checks.delete(name);
  }

  public async run(): Promise<Record<string, ReadinessState>> {
    const entries = [...this.checks.entries()];
    const results = await Promise.allSettled(entries.map(([, check]) => check()));
    return Object.fromEntries(
      entries.map(([name], index) => [
        name,
        results[index]?.status === 'fulfilled' ? 'up' : 'down',
      ]),
    );
  }
}
