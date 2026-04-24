"use client";

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
  type LucideIcon,
} from "lucide-react";

import { UserMenu } from "~/components/layout/user-menu";
import { cn } from "~/lib/utils";

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
};

interface NavLink {
  href: string;
  label: string;
  icon: string; // Icon name as string
}

interface PortalNavProps {
  /** Title shown in the header */
  title: string;
  /** Icon name for the header (e.g., "Scale", "Package") */
  icon: string;
  /** Base path for the portal section (e.g., "/jury", "/producer") */
  basePath: string;
  /** Additional navigation links beyond the dashboard */
  additionalLinks?: NavLink[];
}

/**
 * Shared portal navigation component with user menu
 * Used across jury and producer portal layouts
 */
export function PortalNav({
  title,
  icon,
  basePath,
  additionalLinks = [],
}: PortalNavProps) {
  const pathname = usePathname();

  // Resolve header icon from string name
  const HeaderIcon = iconMap[icon] ?? Home;

  const allLinks: NavLink[] = [
    {
      href: basePath,
      label: "Tableau de bord",
      icon: "Home",
    },
    ...additionalLinks,
  ];

  return (
    <nav className="border-b bg-card">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo / Title */}
          <div className="flex items-center gap-2">
            <HeaderIcon className="h-6 w-6 text-primary" />
            <span className="font-semibold">{title}</span>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-6">
            {allLinks.map((link) => {
              const isActive = pathname === link.href ||
                (link.href !== basePath && pathname.startsWith(link.href));
              const LinkIcon = iconMap[link.icon] ?? Home;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "flex items-center gap-2 text-sm transition-colors",
                    isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <LinkIcon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* User Menu with Logout */}
          <div className="flex items-center">
            <UserMenu />
          </div>
        </div>
      </div>
    </nav>
  );
}
