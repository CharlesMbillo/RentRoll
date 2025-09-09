// Role-based permissions system
export type UserRole = 'landlord' | 'caretaker' | 'tenant';

export interface Permission {
  id: string;
  name: string;
  description: string;
  category: 'dashboard' | 'properties' | 'tenants' | 'payments' | 'reports' | 'settings' | 'notifications';
}

export interface RolePermissions {
  role: UserRole;
  displayName: string;
  description: string;
  permissions: string[];
  menuAccess: string[];
  dataAccess: {
    canViewAllTenants: boolean;
    canViewAllPayments: boolean;
    canViewReports: boolean;
    canManageProperties: boolean;
    canManageSettings: boolean;
    canAssignTenants: boolean;
  };
}

// Define all available permissions
export const PERMISSIONS: Record<string, Permission> = {
  // Dashboard permissions
  'dashboard.view': {
    id: 'dashboard.view',
    name: 'View Dashboard',
    description: 'Access to main dashboard overview',
    category: 'dashboard'
  },
  'dashboard.analytics': {
    id: 'dashboard.analytics',
    name: 'View Analytics',
    description: 'Access to detailed analytics and metrics',
    category: 'dashboard'
  },

  // Property permissions
  'properties.view': {
    id: 'properties.view',
    name: 'View Properties',
    description: 'View property information',
    category: 'properties'
  },
  'properties.manage': {
    id: 'properties.manage',
    name: 'Manage Properties',
    description: 'Create, edit, and delete properties',
    category: 'properties'
  },
  'rooms.view': {
    id: 'rooms.view',
    name: 'View Room Matrix',
    description: 'Access to room matrix and occupancy view',
    category: 'properties'
  },
  'rooms.manage': {
    id: 'rooms.manage',
    name: 'Manage Rooms',
    description: 'Edit room details and assignments',
    category: 'properties'
  },

  // Tenant permissions
  'tenants.view': {
    id: 'tenants.view',
    name: 'View Tenants',
    description: 'View tenant information',
    category: 'tenants'
  },
  'tenants.manage': {
    id: 'tenants.manage',
    name: 'Manage Tenants',
    description: 'Create, edit, and delete tenant records',
    category: 'tenants'
  },
  'tenants.assign': {
    id: 'tenants.assign',
    name: 'Assign Tenants',
    description: 'Assign tenants to rooms',
    category: 'tenants'
  },
  'tenants.contact': {
    id: 'tenants.contact',
    name: 'Contact Tenants',
    description: 'Send notifications to tenants',
    category: 'tenants'
  },

  // Payment permissions
  'payments.view': {
    id: 'payments.view',
    name: 'View Payments',
    description: 'View payment records',
    category: 'payments'
  },
  'payments.view_all': {
    id: 'payments.view_all',
    name: 'View All Payments',
    description: 'View all tenant payments',
    category: 'payments'
  },
  'payments.manage': {
    id: 'payments.manage',
    name: 'Manage Payments',
    description: 'Process and manage payments',
    category: 'payments'
  },
  'payments.collect': {
    id: 'payments.collect',
    name: 'Collect Payments',
    description: 'Initiate payment collection',
    category: 'payments'
  },

  // Reports permissions
  'reports.view': {
    id: 'reports.view',
    name: 'View Reports',
    description: 'Access to financial and occupancy reports',
    category: 'reports'
  },
  'reports.export': {
    id: 'reports.export',
    name: 'Export Reports',
    description: 'Export reports to files',
    category: 'reports'
  },
  'reports.analytics': {
    id: 'reports.analytics',
    name: 'Advanced Analytics',
    description: 'Access to detailed analytics and insights',
    category: 'reports'
  },

  // Settings permissions
  'settings.view': {
    id: 'settings.view',
    name: 'View Settings',
    description: 'View system settings',
    category: 'settings'
  },
  'settings.manage': {
    id: 'settings.manage',
    name: 'Manage Settings',
    description: 'Modify system settings',
    category: 'settings'
  },
  'settings.users': {
    id: 'settings.users',
    name: 'Manage Users',
    description: 'Manage user accounts and roles',
    category: 'settings'
  },

  // Notification permissions
  'notifications.view': {
    id: 'notifications.view',
    name: 'View Notifications',
    description: 'View system notifications',
    category: 'notifications'
  },
  'notifications.send': {
    id: 'notifications.send',
    name: 'Send Notifications',
    description: 'Send notifications to tenants',
    category: 'notifications'
  },
  'notifications.manage': {
    id: 'notifications.manage',
    name: 'Manage Notifications',
    description: 'Configure notification settings',
    category: 'notifications'
  }
};

// Define role-based permissions
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  landlord: {
    role: 'landlord',
    displayName: 'Landlord/Admin',
    description: 'Full system access with complete property management control',
    permissions: [
      'dashboard.view', 'dashboard.analytics',
      'properties.view', 'properties.manage',
      'rooms.view', 'rooms.manage',
      'tenants.view', 'tenants.manage', 'tenants.assign', 'tenants.contact',
      'payments.view', 'payments.view_all', 'payments.manage', 'payments.collect',
      'reports.view', 'reports.export', 'reports.analytics',
      'settings.view', 'settings.manage', 'settings.users',
      'notifications.view', 'notifications.send', 'notifications.manage'
    ],
    menuAccess: ['dashboard', 'rooms', 'tenants', 'payments', 'reports', 'notifications', 'settings'],
    dataAccess: {
      canViewAllTenants: true,
      canViewAllPayments: true,
      canViewReports: true,
      canManageProperties: true,
      canManageSettings: true,
      canAssignTenants: true
    }
  },
  
  caretaker: {
    role: 'caretaker',
    displayName: 'Caretaker',
    description: 'Property maintenance and tenant management with limited financial access',
    permissions: [
      'dashboard.view',
      'properties.view',
      'rooms.view', 'rooms.manage',
      'tenants.view', 'tenants.manage', 'tenants.assign', 'tenants.contact',
      'payments.view', 'payments.collect',
      'settings.view',
      'notifications.view', 'notifications.send'
    ],
    menuAccess: ['dashboard', 'rooms', 'tenants', 'payments', 'notifications', 'settings'],
    dataAccess: {
      canViewAllTenants: true,
      canViewAllPayments: false,
      canViewReports: false,
      canManageProperties: false,
      canManageSettings: false,
      canAssignTenants: true
    }
  },
  
  tenant: {
    role: 'tenant',
    displayName: 'Tenant',
    description: 'Personal account access with payment history and room details',
    permissions: [
      'dashboard.view',
      'payments.view',
      'notifications.view'
    ],
    menuAccess: ['dashboard', 'payments', 'notifications'],
    dataAccess: {
      canViewAllTenants: false,
      canViewAllPayments: false,
      canViewReports: false,
      canManageProperties: false,
      canManageSettings: false,
      canAssignTenants: false
    }
  }
};

// Utility functions
export function hasPermission(userRole: UserRole, permission: string): boolean {
  return ROLE_PERMISSIONS[userRole].permissions.includes(permission);
}

export function hasMenuAccess(userRole: UserRole, menuItem: string): boolean {
  return ROLE_PERMISSIONS[userRole].menuAccess.includes(menuItem);
}

export function getRolePermissions(userRole: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[userRole];
}

export function getPermissionsByCategory(category: Permission['category']): Permission[] {
  return Object.values(PERMISSIONS).filter(p => p.category === category);
}

export function canAccessFeature(userRole: UserRole, feature: keyof RolePermissions['dataAccess']): boolean {
  return ROLE_PERMISSIONS[userRole].dataAccess[feature];
}