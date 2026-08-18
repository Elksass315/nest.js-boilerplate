import type { RoleDefinition } from '@/modules/authorization';

import type { UserStatus } from './users.constants';

export interface CreatePendingUserInput {
  fullName: string;
  email: string;
  normalizedEmail: string;
  passwordHash: string;
}

export type CreateInvitedUserInput = CreatePendingUserInput;

export interface InvitedUserResult {
  id: string;
  fullName: string;
  email: string;
}

export interface UserWithRoles {
  id: string;
  fullName: string;
  email: string;
  normalizedEmail: string;
  passwordHash: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  emailTwoStepEnabled: boolean;
  authVersion: number;
  failedLoginCount: number;
  lockedUntil: Date | null;
  avatarFileId: string | null;
  createdAt: Date;
  updatedAt: Date;
  roles: RoleDefinition[];
}
