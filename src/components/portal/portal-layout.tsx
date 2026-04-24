"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { cn } from "~/lib/utils";
import { PortalSidebar, type SidebarSection } from "./portal-sidebar";
import { PortalBreadcrumbs } from "./portal-breadcrumbs";
import { PortalBottomNav, type BottomNavItem } from "./portal-bottom-nav";
import { api } from "~/trpc/react";
import { authClient } from "~/lib/auth-client";
import { PWAWrapper } from "~/components/pwa/pwa-wrapper";

interface PortalLayoutProps {
  children: React.ReactNode;
  /** Title shown in the sidebar header */
  title: string;
  /** Icon name for the header */
  icon: string;
  /** Base path for the portal section */
  basePath: string;
  /** Sections of navigation links */
  sections: SidebarSection[];
  /** Items for mobile bottom navigation (max 5) */
  bottomNavItems?: BottomNavItem[];
  /** Custom path labels for breadcrumbs */
  pathLabels?: Record<string, string>;
  /** Whether to show breadcrumbs (default: true) */
  showBreadcrumbs?: boolean;
  className?: string;
}

/**
 * Portal layout wrapper component
 * Combines sidebar navigation, breadcrumbs, and main content area
 * Handles user data and logout functionality
 */
export function PortalLayout({
  children,
  title,
  icon,
  basePath,
  sections,
  bottomNavItems,
  pathLabels,
  showBreadcrumbs = true,
  className,
}: PortalLayoutProps) {
  const router = useRouter();

  // Get user session
  const { data: session } = authClient.useSession();

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
        },
      },
    });
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--portal-background))]">
      {/* Sidebar - desktop only */}
      <PortalSidebar
        title={title}
        icon={icon}
        basePath={basePath}
        sections={sections}
        user={
          session?.user
            ? {
                name: session.user.name ?? undefined,
                email: session.user.email ?? undefined,
                image: session.user.image ?? undefined,
              }
            : undefined
        }
        onLogout={handleLogout}
      />

      {/* Main content area */}
      <div className="lg:pl-64 transition-all duration-200">
        <main className={cn("min-h-screen", className)}>
          {/* Header with breadcrumbs - only render if showBreadcrumbs is true */}
          {showBreadcrumbs && (
            <header className="sticky top-0 z-20 bg-[hsl(var(--portal-background))] border-b border-[hsl(var(--portal-border))]">
              <div className="container mx-auto px-4 lg:px-8 py-4">
                <PortalBreadcrumbs
                  basePath={basePath}
                  pathLabels={pathLabels}
                />
              </div>
            </header>
          )}

          {/* Page content - extra padding at bottom for mobile nav */}
          <div className="container mx-auto px-4 lg:px-8 py-6 pb-24 lg:pb-6">
            {children}
          </div>
        </main>
      </div>

      {/* Bottom navigation - mobile only */}
      {bottomNavItems && bottomNavItems.length > 0 && (
        <PortalBottomNav items={bottomNavItems} basePath={basePath} />
      )}
    </div>
  );
}

// Pre-configured layouts for Jury and Producer portals

interface JuryLayoutProps {
  children: React.ReactNode;
}

export function JuryPortalLayout({ children }: JuryLayoutProps) {
  return (
    <PWAWrapper portal="jury">
      <PortalLayout
        title="Espace Jury"
        icon="Scale"
        basePath="/jury"
        showBreadcrumbs={false}
        sections={[
          {
            title: "Navigation",
            links: [
              { href: "/jury", label: "Tableau de bord", icon: "Home" },
              { href: "/jury/assignments", label: "Noter", icon: "ClipboardList" },
              { href: "/jury/ratings", label: "Historique", icon: "Star" },
              { href: "/jury/results", label: "Résultats", icon: "Trophy" },
            ],
          },
          {
            title: "Mon compte",
            links: [
              { href: "/jury/profile", label: "Profil", icon: "User" },
            ],
          },
        ]}
        bottomNavItems={[
          { href: "/jury", label: "Accueil", icon: "Home" },
          { href: "/jury/assignments", label: "Noter", icon: "ClipboardList" },
          { href: "/jury/results", label: "Résultats", icon: "Trophy" },
          { href: "/jury/profile", label: "Profil", icon: "User" },
        ]}
      >
        {children}
      </PortalLayout>
    </PWAWrapper>
  );
}

interface ProducerLayoutProps {
  children: React.ReactNode;
}

export function ProducerPortalLayout({ children }: ProducerLayoutProps) {
  return (
    <PWAWrapper portal="producer">
      <PortalLayout
        title="Espace Producteur"
        icon="Package"
        basePath="/producer"
        showBreadcrumbs={false}
        sections={[
          {
            title: "Navigation",
            links: [
              { href: "/producer/dashboard", label: "Tableau de bord", icon: "Home" },
              { href: "/producer/registrations", label: "Mes inscriptions", icon: "Trophy" },
              { href: "/producer/results", label: "Resultats", icon: "TrendingUp" },
              { href: "/producer/labels", label: "Mes distinctions", icon: "Award" },
            ],
          },
          {
            title: "Outils",
            links: [
              { href: "/producer/widget", label: "Widget", icon: "Code" },
            ],
          },
          {
            title: "Mon compte",
            links: [
              { href: "/producer/profile", label: "Profil", icon: "Building2" },
            ],
          },
        ]}
        bottomNavItems={[
          { href: "/producer/dashboard", label: "Accueil", icon: "Home" },
          { href: "/producer/registrations", label: "Inscriptions", icon: "Trophy" },
          { href: "/producer/results", label: "Résultats", icon: "TrendingUp" },
          { href: "/producer/labels", label: "Distinctions", icon: "Award" },
          { href: "/producer/profile", label: "Profil", icon: "Building2" },
        ]}
      >
        {children}
      </PortalLayout>
    </PWAWrapper>
  );
}
