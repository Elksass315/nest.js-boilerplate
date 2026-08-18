import Joi from 'joi';

import type { InvitationsConfig } from './configuration.types';
import { readNumber, readString } from './environment-reader';

export const invitationsEnvironmentSchema = {
  TEAM_INVITATION_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3000/invitations/accept'),
  TEAM_INVITATION_TTL_HOURS: Joi.number().integer().min(1).max(168).default(72),
  TEAM_INVITATION_MAX_SENDS: Joi.number().integer().min(1).max(20).default(5),
  TEAM_INVITATION_RESEND_COOLDOWN_SECONDS: Joi.number().integer().min(30).max(86400).default(60),
} satisfies Record<string, Joi.Schema>;

export function createInvitationsConfig(environment: Record<string, unknown>): InvitationsConfig {
  return {
    baseUrl: readString(environment, 'TEAM_INVITATION_BASE_URL'),
    ttlHours: readNumber(environment, 'TEAM_INVITATION_TTL_HOURS'),
    maxSends: readNumber(environment, 'TEAM_INVITATION_MAX_SENDS'),
    resendCooldownSeconds: readNumber(environment, 'TEAM_INVITATION_RESEND_COOLDOWN_SECONDS'),
  };
}
