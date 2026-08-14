import type { SeedDefinition } from './seed.types';
import { rbacSeed } from './002-rbac.seed';

export const SEED_REGISTRY: readonly SeedDefinition[] = [rbacSeed];
