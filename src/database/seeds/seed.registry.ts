import type { SeedDefinition } from './seed.types';
import { rbacSeed } from './002-rbac.seed';
import { teamInvitationsRbacSeed } from './003-team-invitations-rbac.seed';
import { securityAuditRbacSeed } from './004-security-audit-rbac.seed';
import { featureFlagsRbacSeed } from './005-feature-flags-rbac.seed';
import { userPermissionOverridesRbacSeed } from './006-user-permission-overrides-rbac.seed';

export const SEED_REGISTRY: readonly SeedDefinition[] = [
  rbacSeed,
  teamInvitationsRbacSeed,
  securityAuditRbacSeed,
  featureFlagsRbacSeed,
  userPermissionOverridesRbacSeed,
];
