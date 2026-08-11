import type { Permission, RoleKey } from './authorization.constants';

export interface AuthenticatedPrincipal {
  userId: string;
  authVersion: number;
  roleKeys: RoleKey[];
  permissions: Permission[];
}

export interface RoleDefinition {
  id: string;
  key: RoleKey;
  name: string;
  description: string;
  permissions: Permission[];
}
