import { Link, useLocation } from "wouter";
import { cn } from "../../lib/utils";
import {
  BarChart3,
  CreditCard,
  MessageSquare,
  Settings,
  Users,
  LayoutGrid,
  Shield,
  Lock,
  ChevronRight,
  User,
  RefreshCw
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { hasMenuAccess, getRolePermissions } from "../../../../shared/role-permissions";
import type { UserRole } from "../../../../shared/role-permissions";

// Enhanced navigation with permission-based access
const navigationItems = [
  { 
    id: 'dashboard',
    name: "Dashboard", 
    href: "/dashboard", 
    icon: BarChart3,
    description: "Overview and key metrics",
    requiredPermission: "dashboard.view"
  },
  { 
    id: 'rooms',
    name: "Room Matrix", 
    href: "/rooms", 
    icon: LayoutGrid,
    description: "Room occupancy and assignments",
    requiredPermission: "rooms.view",
    restricted: true
  },
  { 
    id: 'tenants',
    name: "Tenants", 
    href: "/tenants", 
    icon: Users,
    description: "Tenant management and records",
    requiredPermission: "tenants.view",
    restricted: true
  },
  { 
    id: 'payments',
    name: "Payments", 
    href: "/payments", 
    icon: CreditCard,
    description: "Payment history and processing",
    requiredPermission: "payments.view"
  },
  { 
    id: 'reports',
    name: "Reports", 
    href: "/reports", 
    icon: BarChart3,
    description: "Financial and analytics reports",
    requiredPermission: "reports.view",
    adminOnly: true
  },
  { 
    id: 'notifications',
    name: "Notifications", 
    href: "/notifications", 
    icon: MessageSquare,
    description: "System alerts and messages",
    requiredPermission: "notifications.view"
  },
  { 
    id: 'settings',
    name: "Settings", 
    href: "/settings", 
    icon: Settings,
    description: "System configuration",
    requiredPermission: "settings.view",
    restricted: true
  },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuth();

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return location === "/" || location === "/dashboard";
    }
    return location === href;
  };

  // Get user role and permissions
  const userRole = (user as any)?.role as UserRole;
  const rolePermissions = userRole ? getRolePermissions(userRole) : null;

  // Filter navigation items based on permissions
  const accessibleNavigation = navigationItems.filter(item => 
    userRole && hasMenuAccess(userRole, item.id)
  );

  // Handle role switching for testing
  const handleRoleSwitch = (newRole: UserRole) => {
    window.location.href = `/?role=${newRole}`;
  };

  return (
    <aside className="w-64 bg-card border-r border-border min-h-screen">
      <nav className="p-4 space-y-2">
        {/* Enhanced Role indicator */}
        {userRole && rolePermissions && (
          <div className="mb-4">
            <div className="p-3 bg-gradient-to-r from-accent to-accent/80 rounded-lg border border-border/50">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  {userRole === 'landlord' && <Shield className="w-4 h-4 text-primary" />}
                  {userRole === 'caretaker' && <Users className="w-4 h-4 text-primary" />}
                  {userRole === 'tenant' && <User className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-accent-foreground">
                    {rolePermissions.displayName}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {(user as any)?.firstName} {(user as any)?.lastName}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-muted-foreground leading-relaxed">
                {rolePermissions.description}
              </div>
            </div>
            
            {/* Role switching for development */}
            {(import.meta as any).env?.MODE === 'development' && (
              <div className="mt-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="text-xs font-medium text-yellow-800 dark:text-yellow-200 mb-2 flex items-center">
                  <RefreshCw className="w-3 h-3 mr-1" />
                  Switch Role (Dev)
                </div>
                <div className="flex space-x-1">
                  <button 
                    onClick={() => handleRoleSwitch('landlord')}
                    className={cn("px-2 py-1 text-xs rounded transition-colors", userRole === 'landlord' ? "bg-primary text-primary-foreground" : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50")}
                    data-testid="role-switch-landlord"
                  >
                    Admin
                  </button>
                  <button 
                    onClick={() => handleRoleSwitch('caretaker')}
                    className={cn("px-2 py-1 text-xs rounded transition-colors", userRole === 'caretaker' ? "bg-primary text-primary-foreground" : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50")}
                    data-testid="role-switch-caretaker"
                  >
                    Care
                  </button>
                  <button 
                    onClick={() => handleRoleSwitch('tenant')}
                    className={cn("px-2 py-1 text-xs rounded transition-colors", userRole === 'tenant' ? "bg-primary text-primary-foreground" : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-900/50")}
                    data-testid="role-switch-tenant"
                  >
                    Tenant
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Navigation items */}
        <div className="space-y-1">
          {accessibleNavigation.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            const isRestricted = item.restricted || item.adminOnly;
            
            return (
              <Link key={item.name} href={item.href}>
                <div
                  className={cn(
                    "group flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                  )}
                  data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                    {isRestricted && (
                      <Lock className="w-2 h-2 absolute -top-1 -right-1 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span>{item.name}</span>
                      {item.adminOnly && (
                        <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                          Admin
                        </span>
                      )}
                      {item.restricted && !item.adminOnly && (
                        <span className="text-xs bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 px-1.5 py-0.5 rounded">
                          Limited
                        </span>
                      )}
                    </div>
                    {!active && (
                      <div className="text-xs text-muted-foreground/70 mt-0.5 group-hover:text-muted-foreground/90 transition-colors">
                        {item.description}
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            );
          })}
        </div>
        
        {/* Access summary */}
        {userRole && rolePermissions && (
          <div className="mt-6 pt-4 border-t border-border/50">
            <div className="text-xs text-muted-foreground/70 mb-2">Access Level</div>
            <div className="flex flex-wrap gap-1">
              <span className={cn("text-xs px-2 py-1 rounded", userRole === 'landlord' ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400" : userRole === 'caretaker' ? "bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400" : "bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400")}>
                {rolePermissions.permissions.length} permissions
              </span>
              <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                {accessibleNavigation.length} menu items
              </span>
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}
