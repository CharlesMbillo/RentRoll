import { Link, useLocation } from "wouter";
import { cn } from "../../lib/utils";
import {
  BarChart3,
  Building2,
  CreditCard,
  MessageSquare,
  Settings,
  Users,
  LayoutGrid,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// Define role-based navigation permissions
const navigationItems = [
  { 
    name: "Dashboard", 
    href: "/dashboard", 
    icon: BarChart3,
    allowedRoles: ["landlord", "caretaker", "tenant"]
  },
  { 
    name: "Room Matrix", 
    href: "/rooms", 
    icon: LayoutGrid,
    allowedRoles: ["landlord", "caretaker"]
  },
  { 
    name: "Tenants", 
    href: "/tenants", 
    icon: Users,
    allowedRoles: ["landlord", "caretaker"]
  },
  { 
    name: "Payments", 
    href: "/payments", 
    icon: CreditCard,
    allowedRoles: ["landlord", "caretaker", "tenant"]
  },
  { 
    name: "Reports", 
    href: "/reports", 
    icon: BarChart3,
    allowedRoles: ["landlord"]
  },
  { 
    name: "Notifications", 
    href: "/notifications", 
    icon: MessageSquare,
    allowedRoles: ["landlord", "caretaker", "tenant"]
  },
  { 
    name: "Settings", 
    href: "/settings", 
    icon: Settings,
    allowedRoles: ["landlord", "caretaker"]
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

  // Filter navigation items based on user role
  const userRole = (user as any)?.role;
  const accessibleNavigation = navigationItems.filter(item => 
    !userRole || item.allowedRoles.includes(userRole)
  );

  return (
    <aside className="w-64 bg-card border-r border-border min-h-screen">
      <nav className="p-4 space-y-2">
        {/* Role indicator */}
        {userRole && (
          <div className="mb-4 p-2 bg-accent rounded-lg">
            <div className="text-xs font-medium text-accent-foreground uppercase tracking-wide">
              {userRole === 'landlord' ? 'Landlord/Admin' : userRole}
            </div>
            <div className="text-xs text-muted-foreground">
              {user?.firstName} {user?.lastName}
            </div>
          </div>
        )}
        
        {accessibleNavigation.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          
          return (
            <Link key={item.name} href={item.href}>
              <div
                className={cn(
                  "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
                data-testid={`nav-link-${item.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
