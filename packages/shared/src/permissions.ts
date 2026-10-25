import { Role } from './types.js';

export const PERMISSIONS = [
  'menu.manage',
  'menu.availability',
  'staff.manage',
  'tables.manage',
  'visits.open',
  'visits.close',
  'orders.create_staff',
  'orders.confirm',
  'items.prepare',
  'items.serve',
  'calls.claim',
  'payments.record',
  'refunds.approve',
  'discounts.approve',
  'shifts.manage',
  'reports.view',
  'audit.view',
  'settings.manage',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_DEFAULT_PERMISSIONS: Record<Role, Permission[]> = {
  SUPER_ADMIN: [
    'audit.view',
    'reports.view',
  ],
  BOSS: [
    'menu.manage',
    'menu.availability',
    'staff.manage',
    'tables.manage',
    'visits.open',
    'visits.close',
    'orders.create_staff',
    'orders.confirm',
    'items.prepare',
    'items.serve',
    'calls.claim',
    'payments.record',
    'refunds.approve',
    'discounts.approve',
    'shifts.manage',
    'reports.view',
    'audit.view',
    'settings.manage',
  ],
  MANAGER: [
    'menu.manage',
    'menu.availability',
    'staff.manage',
    'tables.manage',
    'visits.open',
    'visits.close',
    'orders.create_staff',
    'orders.confirm',
    'items.prepare',
    'items.serve',
    'calls.claim',
    'payments.record',
    'refunds.approve',
    'discounts.approve',
    'shifts.manage',
    'reports.view',
    'audit.view',
    'settings.manage',
  ],
  CASHIER: [
    'visits.open',
    'visits.close',
    'orders.create_staff',
    'orders.confirm',
    'payments.record',
    'shifts.manage',
  ],
  WAITER: [
    'menu.availability',
    'visits.open',
    'visits.close',
    'orders.create_staff',
    'orders.confirm',
    'items.serve',
    'calls.claim',
    'payments.record',
  ],
  KITCHEN: [
    'menu.availability',
    'items.prepare',
  ],
};

/**
 * Xodimning barcha rollaridan birlashgan ruxsatlar to'plamini hisoblash
 */
export function getPermissionsForRoles(
  roles: Role[],
  customPermissions?: string[] | { allow?: string[]; deny?: string[] } | null
): Permission[] {
  const set = new Set<Permission>();
  for (const role of roles) {
    const defaultPerms = ROLE_DEFAULT_PERMISSIONS[role] || [];
    for (const p of defaultPerms) {
      set.add(p);
    }
  }
  if (Array.isArray(customPermissions)) {
    for (const cp of customPermissions) {
      if (typeof cp === 'string') {
        if (cp.startsWith('!')) {
          const permToRemove = cp.substring(1) as Permission;
          set.delete(permToRemove);
        } else if (PERMISSIONS.includes(cp as Permission)) {
          set.add(cp as Permission);
        }
      }
    }
  } else if (customPermissions && typeof customPermissions === 'object') {
    if (Array.isArray(customPermissions.allow)) {
      for (const p of customPermissions.allow) {
        if (PERMISSIONS.includes(p as Permission)) set.add(p as Permission);
      }
    }
    if (Array.isArray(customPermissions.deny)) {
      for (const p of customPermissions.deny) {
        set.delete(p as Permission);
      }
    }
  }
  return Array.from(set);
}

/**
 * Rol iyerarxiyasi: kim kimga rol bera olishi qoidasi
 * Manager Boss yoki SuperAdmin bera olmaydi!
 */
export function canAssignRole(actorRoles: Role[], targetRole: Role): boolean {
  if (actorRoles.includes(Role.SUPER_ADMIN)) return true;
  if (actorRoles.includes(Role.BOSS)) {
    return targetRole !== Role.SUPER_ADMIN;
  }
  if (actorRoles.includes(Role.MANAGER)) {
    // Manager faqat Cashier, Waiter, Kitchen va Manager bera oladi (ammo Boss yoki SuperAdmin emas)
    return targetRole !== Role.BOSS && targetRole !== Role.SUPER_ADMIN;
  }
  return false;
}
