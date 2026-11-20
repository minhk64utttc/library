import type { Role } from './roles';

export const PERMISSIONS = [
  'catalog:read',
  'catalog:write',
  'catalog:approve',
  'holdings:manage',
  'inventory:manage',
  'inventory:read',
  'inventory:decide',
  'incidents:read',
  'incidents:report',
  'incidents:decide',
  'circulation:manage',
  'cards:manage',
  'reservations:read',
  'fines:read',
  'fines:collect',
  'fines:waive',
  'fines:request-waiver',
  'digital:manage',
  'digital:read',
  'digital:publish',
  'digital:submit',
  'policies:manage',
  'reports:read',
  'accounts:manage',
  'audit:read',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  reader: ['digital:read', 'digital:submit'],
  circulation: ['catalog:read', 'circulation:manage', 'cards:manage', 'reservations:read', 'fines:read', 'fines:collect', 'fines:request-waiver', 'incidents:read', 'incidents:report', 'reports:read'],
  cataloging: ['catalog:read', 'catalog:write'],
  inventory: ['catalog:read', 'holdings:manage', 'inventory:manage', 'inventory:read', 'incidents:read', 'incidents:report'],
  digital: ['catalog:read', 'digital:manage', 'digital:read', 'digital:submit'],
  manager: ['catalog:read', 'catalog:approve', 'cards:manage', 'reservations:read', 'fines:read', 'fines:waive', 'inventory:read', 'inventory:decide', 'incidents:read', 'incidents:decide', 'digital:manage', 'digital:read', 'digital:publish', 'digital:submit', 'policies:manage', 'reports:read', 'audit:read'],
  admin: ['accounts:manage', 'audit:read'],
};

export function permissionsFor(roles: readonly Role[]): Set<Permission> {
  const result = new Set<Permission>();
  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role]) {
      result.add(permission);
    }
  }
  return result;
}
