"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Scale,
  Package,
  ClipboardList,
  Star,
  User,
  Building2,
  FileText,
  Award,
  Trophy,
  TrendingUp,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Code,
  type LucideIcon,
} from "lucide-react";

import { cn } from "~/lib/utils";
import { useOrganization, usePortalTheme } from "~/lib/portal/context";
import { PortalButton } from "./portal-button";
import { api } from "~/trpc/react";

// Map of icon names to components (for serialization from Server Components)
const iconMap: Record<string, LucideIcon> = {
  Home,
  Scale,
  Package,
  ClipboardList,
  Star,
  User,
  Building2,
  FileText,
  Award,
  Trophy,
  TrendingUp,
  Settings,
  Code,
};

export interface SidebarLink {
  href: string;
  label: string;
  icon: string;
  badge?: string | number;
}

export interface SidebarSection {
  title?: string;
  links: SidebarLink[];
}

interface PortalSidebarProps {
  /** Title shown in the sidebar header */
  title: string;
  /** Icon name for the header */
  icon: string;
  /** Base path for the portal section */
  basePath: string;
  /** Sections of navigation links */
  sections: SidebarSection[];
  /** User info for the bottom of sidebar */
  user?: {
    name?: string;
    email?: string;
    image?: string;
  };
  /** Callback for logout */
  onLogout?: () => void;
}

/**
 * Portal sidebar navigation component
 * Responsive sidebar with collapsible state on mobile
 */
export function PortalSidebar({
  title,
  icon,
  basePath,
  sections,
  user,
  onLogout,
}: PortalSidebarProps) {
  const pathname = usePathname();
  const organization = useOrganization();
  const theme = usePortalTheme();
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const HeaderIcon = iconMap[icon] ?? Home;

  const isLinkActive = (href: string) => {
    if (href === basePath) {
      return pathname === basePath || pathname === `${basePath}/dashboard`;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn(
        "flex items-center gap-3 p-4 border-b border-[hsl(var(--portal-border))]",
        isCollapsed && "justify-center"
      )}>
        {theme.logoUrl ? (
          <img
            src={theme.logoUrl}
            alt={organization.name}
            className={cn(
              "rounded-lg object-contain bg-[hsl(var(--portal-muted))] p-1",
              isCollapsed ? "h-10 w-10" : "h-10 w-10"
            )}
          />
        ) : (
          <div className={cn(
            "flex items-center justify-center rounded-lg bg-[hsl(var(--portal-primary)/0.1)]",
            isCollapsed ? "h-10 w-10" : "h-10 w-10"
          )}>
            <HeaderIcon className="h-5 w-5 text-[hsl(var(--portal-primary))]" />
          </div>
        )}
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[hsl(var(--portal-foreground))] truncate">
              {title}
            </p>
            <p className="text-xs text-[hsl(var(--portal-muted-foreground))] truncate">
              {organization.name}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {sections.map((section, sectionIdx) => (
          <div key={sectionIdx}>
            {section.title && !isCollapsed && (
              <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--portal-muted-foreground))]">
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.links.map((link) => {
                const isActive = isLinkActive(link.href);
                const LinkIcon = iconMap[link.icon] ?? Home;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all",
                      isActive
                        ? "bg-[hsl(var(--portal-primary))] text-white font-medium"
                        : "text-[hsl(var(--portal-foreground))] hover:bg-[hsl(var(--portal-muted))]",
                      isCollapsed && "justify-center px-2"
                    )}
                    title={isCollapsed ? link.label : undefined}
                  >
                    <LinkIcon className={cn("h-5 w-5 shrink-0", isActive && "text-white")} />
                    {!isCollapsed && (
                      <>
                        <span className="flex-1">{link.label}</span>
                        {link.badge !== undefined && (
                          <span className={cn(
                            "px-2 py-0.5 text-xs rounded-full",
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-[hsl(var(--portal-primary)/0.1)] text-[hsl(var(--portal-primary))]"
                          )}>
                            {link.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <UserSection
        user={user}
        onLogout={onLogout}
        isCollapsed={isCollapsed}
        currentBasePath={basePath}
      />

      {/* Collapse toggle - desktop only */}
      <div className="hidden lg:block border-t border-[hsl(var(--portal-border))] p-2">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center gap-2 p-2 rounded-lg text-sm text-[hsl(var(--portal-muted-foreground))] hover:bg-[hsl(var(--portal-muted))] hover:text-[hsl(var(--portal-foreground))] transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" />
              <span>Reduire</span>
            </>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar only - mobile uses bottom nav */}
      <aside
        className={cn(
          "hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 bg-[hsl(var(--portal-card))] border-r border-[hsl(var(--portal-border))] transition-all duration-200",
          isCollapsed ? "w-[72px]" : "w-64"
        )}
      >
        {sidebarContent}
      </aside>
    </>
  );
}

/**
 * Context provider for sidebar state
 */
interface SidebarContextValue {
  isCollapsed: boolean;
  isMobileOpen: boolean;
}

const SidebarContext = React.createContext<SidebarContextValue>({
  isCollapsed: false,
  isMobileOpen: false,
});

export function useSidebar() {
  return React.useContext(SidebarContext);
}

/**
 * User section with role-based dashboard links
 */
function UserSection({
  user,
  onLogout,
  isCollapsed,
  currentBasePath,
}: {
  user?: { name?: string; email?: string; image?: string };
  onLogout?: () => void;
  isCollapsed: boolean;
  currentBasePath: string;
}) {
  // Fetch user roles for dashboard switching
  const { data: rolesData } = api.user.getMyRoles.useQuery(undefined, {
    enabled: !!user,
    staleTime: 30000, // Cache for 30 seconds
  });

  if (!user) return null;

  // Build dashboard links based on roles
  const dashboardLinks: Array<{
    href: string;
    label: string;
    icon: LucideIcon;
    isExternal?: boolean;
  }> = [];

  if (rolesData?.roles) {
    const { roles } = rolesData;

    // Organizer dashboard
    if (roles.organizer && currentBasePath !== "/dashboard") {
      dashboardLinks.push({
        href: roles.organizer.href ?? "/dashboard",
        label: "Espace Organisateur",
        icon: Building2,
      });
    }

    // Producer dashboard
    if (roles.producer && currentBasePath !== "/producer") {
      dashboardLinks.push({
        href: "/producer/dashboard",
        label: "Espace Producteur",
        icon: Package,
      });
    }

    // Jury dashboard
    if (roles.jury && currentBasePath !== "/jury") {
      dashboardLinks.push({
        href: "/jury/dashboard",
        label: "Espace Jury",
        icon: Scale,
      });
    }
  }

  return (
    <div className="border-t border-[hsl(var(--portal-border))] p-3 space-y-2">
      {/* Dashboard switch links */}
      {!isCollapsed && dashboardLinks.length > 0 && (
        <div className="space-y-1 pb-2 border-b border-[hsl(var(--portal-border))]">
          <p className="px-2 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--portal-muted-foreground))]">
            Mes espaces
          </p>
          {dashboardLinks.map((link) => {
            const LinkIcon = link.icon;
            return link.isExternal ? (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-[hsl(var(--portal-foreground))] hover:bg-[hsl(var(--portal-muted))] transition-colors"
              >
                <LinkIcon className="h-4 w-4" />
                <span>{link.label}</span>
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-[hsl(var(--portal-foreground))] hover:bg-[hsl(var(--portal-muted))] transition-colors"
              >
                <LinkIcon className="h-4 w-4" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* User info and logout */}
      {!isCollapsed ? (
        <div className="flex items-center gap-3 p-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[hsl(var(--portal-muted))] shrink-0">
            {user.image ? (
              <img src={user.image} alt={user.name} className="h-9 w-9 rounded-full" />
            ) : (
              <User className="h-4 w-4 text-[hsl(var(--portal-muted-foreground))]" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[hsl(var(--portal-foreground))] truncate">
              {user.name ?? "Utilisateur"}
            </p>
            <p className="text-xs text-[hsl(var(--portal-muted-foreground))] truncate">
              {user.email}
            </p>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              className="p-2 rounded-lg hover:bg-[hsl(var(--portal-muted))] text-[hsl(var(--portal-muted-foreground))] hover:text-[hsl(var(--portal-foreground))] transition-colors"
              title="Deconnexion"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={onLogout}
          className="w-full p-2 rounded-lg hover:bg-[hsl(var(--portal-muted))] text-[hsl(var(--portal-muted-foreground))] hover:text-[hsl(var(--portal-foreground))] transition-colors flex justify-center"
          title="Deconnexion"
        >
          <LogOut className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
