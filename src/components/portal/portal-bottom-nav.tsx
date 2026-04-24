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
  Award,
  Trophy,
  TrendingUp,
  Code,
  type LucideIcon,
} from "lucide-react";

import { cn } from "~/lib/utils";

// Map of icon names to components
const iconMap: Record<string, LucideIcon> = {
  Home,
  Scale,
  Package,
  ClipboardList,
  Star,
  User,
  Building2,
  Award,
  Trophy,
  TrendingUp,
  Code,
};

export interface BottomNavItem {
  href: string;
  label: string;
  icon: string;
}

interface PortalBottomNavProps {
  items: BottomNavItem[];
  basePath: string;
}

/**
 * Mobile bottom navigation bar for PWA
 * Shows up to 5 main navigation items near the thumb
 */
export function PortalBottomNav({ items, basePath }: PortalBottomNavProps) {
  const pathname = usePathname();

  const isLinkActive = (href: string) => {
    if (href === basePath) {
      return pathname === basePath || pathname === `${basePath}/dashboard`;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Limit to 5 items max for bottom nav
  const navItems = items.slice(0, 5);

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[hsl(var(--portal-card))] border-t border-[hsl(var(--portal-border))] safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const isActive = isLinkActive(item.href);
          const Icon = iconMap[item.icon] ?? Home;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center min-w-[64px] py-2 px-3 rounded-xl transition-all",
                isActive
                  ? "text-[hsl(var(--portal-primary))]"
                  : "text-[hsl(var(--portal-muted-foreground))]"
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center w-12 h-8 rounded-full transition-all",
                  isActive && "bg-[hsl(var(--portal-primary)/0.15)]"
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform",
                    isActive && "scale-110"
                  )}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>
              <span
                className={cn(
                  "text-[10px] mt-0.5 font-medium truncate max-w-[64px]",
                  isActive && "font-semibold"
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
