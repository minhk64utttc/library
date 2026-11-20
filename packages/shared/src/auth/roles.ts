export const ROLES = [
  'reader',
  'circulation',
  'cataloging',
  'inventory',
  'digital',
  'manager',
  'admin',
] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}
