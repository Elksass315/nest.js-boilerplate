import type { SeedDefinition } from './seed.types';
import { rbacSeed } from './002-rbac.seed';
import { teamInvitationsRbacSeed } from './003-team-invitations-rbac.seed';

export const SEED_REGISTRY: readonly SeedDefinition[] = [rbacSeed, teamInvitationsRbacSeed];
