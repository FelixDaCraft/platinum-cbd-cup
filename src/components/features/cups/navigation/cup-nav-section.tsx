"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

import { Badge } from "~/components/ui/badge";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
  badgeVariant?: "default" | "secondary" | "destructive" | "outline";
}

export interface CupNavSectionProps {
  title: string;
  icon: LucideIcon;
  items: NavItem[];
  cupId: string;
  defaultOpen?: boolean;
  onNavigate?: () => void;
}

export function CupNavSection({
  title,
  icon: SectionIcon,
  items,
  cupId,
  onNavigate,
}: CupNavSectionProps) {
  const pathname = usePathname();

  const isItemActive = (href: string) => {
    if (href === `/dashboard/cups/${cupId}`) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const isSectionActive = items.some((item) => isItemActive(item.href));

  return (
    <div className="space-y-1">
      {/* Section Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 transition-colors"
        style={{
          fontSize: "10px",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: isSectionActive ? "var(--n-text-display)" : "var(--n-text-disabled)",
        }}
      >
        <SectionIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span>{title}</span>
      </div>

      {/* Section Items */}
      <div className="space-y-0.5 pl-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isItemActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className="flex items-center gap-2.5 px-3 py-2 text-sm transition-colors relative"
              style={{
                borderRadius: "6px",
                color: active ? "var(--n-text-display)" : "var(--n-text-disabled)",
                background: active ? "var(--n-surface-raised)" : "transparent",
                borderLeft: active ? "2px solid var(--n-text-display)" : "2px solid transparent",
              }}
            >
              {/* Icon */}
              <Icon className="h-3.5 w-3.5 relative z-10 shrink-0" strokeWidth={1.5} />

              {/* Label */}
              <span
                className="relative z-10 flex-1 truncate"
                style={{
                  fontSize: "11px",
                  letterSpacing: "0.04em",
                }}
              >
                {item.label}
              </span>

              {/* Badge */}
              {item.badge !== undefined && (
                <Badge
                  variant={item.badgeVariant ?? "secondary"}
                  className="relative z-10 text-[10px] px-1.5 py-0 h-4 min-w-4 justify-center"
                >
                  {item.badge}
                </Badge>
              )}

              {/* Active indicator */}
              {active && (
                <ChevronRight
                  className="relative z-10 h-3.5 w-3.5 shrink-0"
                  strokeWidth={1.5}
                  style={{ color: "var(--n-text-secondary)" }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
