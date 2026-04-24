"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

import { cn } from "~/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PortalBreadcrumbsProps {
  /** Base path for the portal section */
  basePath: string;
  /** Base label (e.g., "Tableau de bord", "Dashboard") */
  baseLabel?: string;
  /** Custom breadcrumb items to override auto-generation */
  items?: BreadcrumbItem[];
  /** Path segment to label mapping for auto-generation */
  pathLabels?: Record<string, string>;
  className?: string;
}

// Default French labels for common path segments
const defaultPathLabels: Record<string, string> = {
  dashboard: "Tableau de bord",
  profile: "Profil",
  settings: "Parametres",
  registrations: "Inscriptions",
  results: "Resultats",
  labels: "Distinctions",
  widget: "Widget",
  cups: "Cups",
  assignments: "Mes evaluations",
  ratings: "Notes soumises",
  category: "Categorie",
  rate: "Noter",
};

/**
 * Portal breadcrumbs component
 * Auto-generates breadcrumbs from URL path or accepts custom items
 */
export function PortalBreadcrumbs({
  basePath,
  baseLabel = "Tableau de bord",
  items,
  pathLabels = {},
  className,
}: PortalBreadcrumbsProps) {
  const pathname = usePathname();

  // Merge default labels with custom ones
  const allLabels = { ...defaultPathLabels, ...pathLabels };

  // Generate breadcrumbs from path if no custom items provided
  const breadcrumbs = React.useMemo<BreadcrumbItem[]>(() => {
    if (items) return items;

    // Remove base path and split remaining segments
    const relativePath = pathname.replace(basePath, "").replace(/^\//, "");
    if (!relativePath) {
      return [{ label: baseLabel }];
    }

    const segments = relativePath.split("/").filter(Boolean);
    const breadcrumbItems: BreadcrumbItem[] = [
      { label: baseLabel, href: basePath },
    ];

    let currentPath = basePath;
    segments.forEach((segment, idx) => {
      currentPath = `${currentPath}/${segment}`;
      const isLast = idx === segments.length - 1;

      // Try to find a label for this segment
      // First check if it's a known path, then check if it looks like an ID
      let label = allLabels[segment];
      if (!label) {
        // Check if previous segment provides context (e.g., "cups/[id]" -> "Cup")
        if (idx > 0) {
          const prevSegment = segments[idx - 1];
          if (prevSegment === "cups") {
            label = "Details";
          } else if (prevSegment === "registrations") {
            label = "Details";
          } else if (prevSegment === "category") {
            label = "Categorie";
          }
        }
        // If still no label, use the segment as-is (capitalize first letter)
        if (!label) {
          label = segment.charAt(0).toUpperCase() + segment.slice(1);
        }
      }

      breadcrumbItems.push({
        label,
        href: isLast ? undefined : currentPath,
      });
    });

    return breadcrumbItems;
  }, [pathname, basePath, baseLabel, items, allLabels]);

  if (breadcrumbs.length <= 1) {
    return null; // Don't show breadcrumbs if we're at the root
  }

  return (
    <nav
      aria-label="Fil d'Ariane"
      className={cn(
        "flex items-center text-sm text-[hsl(var(--portal-muted-foreground))]",
        className
      )}
    >
      <ol className="flex items-center gap-1">
        {breadcrumbs.map((item, idx) => {
          const isLast = idx === breadcrumbs.length - 1;

          return (
            <li key={idx} className="flex items-center">
              {idx > 0 && (
                <ChevronRight className="h-4 w-4 mx-1 text-[hsl(var(--portal-border))]" />
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-[hsl(var(--portal-foreground))] transition-colors"
                >
                  {idx === 0 ? (
                    <span className="flex items-center gap-1.5">
                      <Home className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{item.label}</span>
                    </span>
                  ) : (
                    item.label
                  )}
                </Link>
              ) : (
                <span
                  className={cn(
                    isLast && "text-[hsl(var(--portal-foreground))] font-medium"
                  )}
                >
                  {idx === 0 ? (
                    <span className="flex items-center gap-1.5">
                      <Home className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{item.label}</span>
                    </span>
                  ) : (
                    item.label
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
