import { useAuth } from './useAuth';
import { hasPermission, hasMenuAccess, getRolePermissions, canAccessFeature } from '../../shared/role-permissions';
import type { UserRole, RolePermissions } from '../../shared/role-permissions';

export function useRolePermissions() {
  const { user } = useAuth();
  const userRole = (user as any)?.role as UserRole;
  
  const rolePermissions = userRole ? getRolePermissions(userRole) : null;
  
  return {
    userRole,
    rolePermissions,
    
    // Permission checking functions
    hasPermission: (permission: string) => userRole ? hasPermission(userRole, permission) : false,
    hasMenuAccess: (menuItem: string) => userRole ? hasMenuAccess(userRole, menuItem) : false,
    canAccessFeature: (feature: keyof RolePermissions['dataAccess']) => userRole ? canAccessFeature(userRole, feature) : false,
    
    // Convenience functions
    isLandlord: userRole === 'landlord',
    isCaretaker: userRole === 'caretaker',
    isTenant: userRole === 'tenant',
    
    // Access levels
    canViewAllTenants: userRole ? canAccessFeature(userRole, 'canViewAllTenants') : false,
    canViewAllPayments: userRole ? canAccessFeature(userRole, 'canViewAllPayments') : false,
    canManageProperties: userRole ? canAccessFeature(userRole, 'canManageProperties') : false,
    canManageSettings: userRole ? canAccessFeature(userRole, 'canManageSettings') : false,
    canAssignTenants: userRole ? canAccessFeature(userRole, 'canAssignTenants') : false,
    canViewReports: userRole ? canAccessFeature(userRole, 'canViewReports') : false,
  };
}