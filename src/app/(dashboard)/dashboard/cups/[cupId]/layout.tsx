"use client";

import { useState } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Layers,
  Users,
  Package,
  UserCheck,
  Euro,
  Award,
  Calendar,
  Trophy,
  FileText,
  Upload,
  Settings,
  Users2,
  BarChart3,
  Activity,
  QrCode,
  Menu,
  ChevronLeft,
  FlaskConical,
} from "lucide-react";

import { cn } from "~/lib/utils";
import { api } from "~/trpc/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { UserMenu } from "~/components/layout/user-menu";
import { getStatusLabel } from "~/lib/validations/cup";
import { CupNavSection, type NavItem } from "~/components/features/cups/navigation";

interface NavSection {
  title: string;
  icon: typeof Settings;
  items: NavItem[];
}

export default function CupLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const cupId = params.cupId as string;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: cup, isLoading } = api.cup.getById.useQuery({ id: cupId });

  const navSections: NavSection[] = [
    {
      title: "Configuration",
      icon: Settings,
      items: [
        {
          href: `/dashboard/cups/${cupId}/config/categories`,
          label: "Catégories & Critères",
          icon: Layers,
        },
        {
          href: `/dashboard/cups/${cupId}/config/labels`,
          label: "Labels & Récompenses",
          icon: Award,
        },
        {
          href: `/dashboard/cups/${cupId}/config/phases`,
          label: "Phases & Dates",
          icon: Calendar,
        },
        {
          href: `/dashboard/cups/${cupId}/config/pricing`,
          label: "Tarification",
          icon: Euro,
        },
        {
          href: `/dashboard/cups/${cupId}/config/import`,
          label: "Import CSV",
          icon: Upload,
        },
      ],
    },
    {
      title: "Participants",
      icon: Users2,
      items: [
        {
          href: `/dashboard/cups/${cupId}/participants/registrations`,
          label: "Inscriptions",
          icon: Users,
        },
        {
          href: `/dashboard/cups/${cupId}/participants/products`,
          label: "Produits",
          icon: Package,
        },
        {
          href: `/dashboard/cups/${cupId}/participants/lab-rankings`,
          label: "Classement terpènes",
          icon: FlaskConical,
        },
      ],
    },
    {
      title: "Notation",
      icon: BarChart3,
      items: [
        {
          href: `/dashboard/cups/${cupId}/scoring/juries`,
          label: "Jurys & Assignations",
          icon: UserCheck,
        },
        {
          href: `/dashboard/cups/${cupId}/scoring/invitation-codes`,
          label: "Codes d'invitation",
          icon: QrCode,
        },
      ],
    },
    {
      title: "Résultats",
      icon: Trophy,
      items: [
        {
          href: `/dashboard/cups/${cupId}/results/live`,
          label: "Suivi en direct",
          icon: Activity,
        },
        {
          href: `/dashboard/cups/${cupId}/results/details`,
          label: "Résultats détaillés",
          icon: BarChart3,
        },
        {
          href: `/dashboard/cups/${cupId}/results/publication`,
          label: "Publication",
          icon: Trophy,
        },
        {
          href: `/dashboard/cups/${cupId}/results/synthesis`,
          label: "Synthèses PDF",
          icon: FileText,
        },
      ],
    },
  ];

  const allNavItems = navSections.flatMap((section) => section.items);

  const isActive = (href: string) => {
    if (href === `/dashboard/cups/${cupId}`) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const currentPage = allNavItems.find((item) => isActive(item.href));
  const isOverview = pathname === `/dashboard/cups/${cupId}`;

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "400px",
        }}
      >
        <span
          style={{
            fontFamily: '"Space Mono", monospace',
            fontSize: "12px",
            letterSpacing: "0.08em",
            color: "var(--n-text-secondary)",
          }}
        >
          [LOADING...]
        </span>
      </div>
    );
  }

  if (!cup) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "400px",
          padding: "24px",
        }}
      >
        <div
          className="n-card"
          style={{
            padding: "48px 32px",
            maxWidth: "400px",
            width: "100%",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <p
            style={{
              fontFamily: '"Space Mono", monospace',
              fontSize: "11px",
              letterSpacing: "0.08em",
              color: "var(--n-accent)",
              textTransform: "uppercase",
              margin: 0,
            }}
          >
            CUP NON TROUVÉE
          </p>
          <p
            className="n-font-body"
            style={{
              fontSize: "14px",
              color: "var(--n-text-secondary)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            Cette cup n&apos;existe pas ou vous n&apos;avez pas accès.
          </p>
          <Link href="/dashboard">
            <button className="n-btn-secondary" style={{ marginTop: "8px" }}>
              RETOUR AU DASHBOARD
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusLabel(cup.status);
  const statusColor = getStatusColor(cup.status);

  const NavigationContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Overview link */}
      <Link
        href={`/dashboard/cups/${cupId}`}
        onClick={onNavigate}
        style={{ textDecoration: "none" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 10px",
            borderRadius: "6px",
            background: isOverview
              ? "var(--n-surface-raised)"
              : "transparent",
            borderLeft: isOverview
              ? "2px solid var(--n-text-display)"
              : "2px solid transparent",
            transition: "all 150ms ease-out",
          }}
        >
          <LayoutDashboard
            size={14}
            style={{
              color: isOverview
                ? "var(--n-text-display)"
                : "var(--n-text-disabled)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "11px",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: isOverview
                ? "var(--n-text-display)"
                : "var(--n-text-disabled)",
            }}
          >
            VUE D&apos;ENSEMBLE
          </span>
        </div>
      </Link>

      {/* Separator */}
      <div
        style={{ height: "1px", background: "var(--n-border)" }}
      />

      {/* Navigation Sections */}
      {navSections.map((section) => (
        <CupNavSection
          key={section.title}
          title={section.title}
          icon={section.icon}
          items={section.items}
          cupId={cupId}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Desktop Sidebar */}
      <aside
        className="hidden lg:flex"
        style={{
          width: "240px",
          flexDirection: "column",
          position: "fixed",
          top: 0,
          left: 0,
          height: "100vh",
          background: "var(--n-surface)",
          borderRight: "1px solid var(--n-border)",
          zIndex: 40,
        }}
      >
        {/* Cup header */}
        <div
          style={{
            padding: "16px 16px 12px 16px",
            borderBottom: "1px solid var(--n-border)",
            flexShrink: 0,
          }}
        >
          {/* Back link */}
          <Link
            href="/dashboard/cups"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              textDecoration: "none",
              marginBottom: "12px",
            }}
          >
            <ChevronLeft
              size={12}
              style={{ color: "var(--n-text-disabled)" }}
            />
            <span
              style={{
                fontSize: "10px",
                letterSpacing: "0.08em",
                color: "var(--n-text-disabled)",
                textTransform: "uppercase",
              }}
            >
              MES CUPS
            </span>
          </Link>

          {/* Cup name */}
          <h2
            className="n-font-display"
            style={{
              fontSize: "15px",
              fontWeight: 500,
              color: "var(--n-text-display)",
              margin: "0 0 8px 0",
              lineHeight: 1.2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={cup.name}
          >
            {cup.name}
          </h2>

          {/* Status + type */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                fontFamily: '"Space Mono", monospace',
                fontSize: "10px",
                letterSpacing: "0.06em",
                color: statusColor,
                border: `1px solid ${statusColor}`,
                borderRadius: "999px",
                padding: "2px 8px",
                textTransform: "uppercase",
              }}
            >
              {statusInfo.label.toUpperCase()}
            </span>
            <span
              style={{
                fontFamily: '"Space Mono", monospace',
                fontSize: "10px",
                letterSpacing: "0.06em",
                color: "var(--n-text-disabled)",
                textTransform: "uppercase",
              }}
            >
              {cup.type === "public" ? "PUBLIC" : "PRO"}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 12px",
            minHeight: 0,
          }}
        >
          <NavigationContent />
        </div>

        {/* User menu */}
        <div
          style={{
            borderTop: "1px solid var(--n-border)",
            padding: "12px",
            flexShrink: 0,
          }}
        >
          <UserMenu settingsHref="/dashboard/settings" dropdownSide="top" />
        </div>
      </aside>

      {/* Mobile Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="left"
          className="p-0"
          style={{
            width: "280px",
            background: "var(--n-surface)",
            border: "none",
            borderRight: "1px solid var(--n-border)",
          }}
        >
          <SheetHeader
            style={{
              padding: "16px 16px 12px 16px",
              borderBottom: "1px solid var(--n-border)",
              textAlign: "left",
            }}
          >
            <Link
              href="/dashboard/cups"
              onClick={() => setMobileMenuOpen(false)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                textDecoration: "none",
                marginBottom: "10px",
              }}
            >
              <ChevronLeft
                size={12}
                style={{ color: "var(--n-text-disabled)" }}
              />
              <span
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.08em",
                  color: "var(--n-text-disabled)",
                  textTransform: "uppercase",
                }}
              >
                MES CUPS
              </span>
            </Link>
            <SheetTitle
              className="n-font-display"
              style={{
                fontSize: "15px",
                fontWeight: 500,
                color: "var(--n-text-display)",
                margin: "0 0 8px 0",
                textAlign: "left",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {cup.name}
            </SheetTitle>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontFamily: '"Space Mono", monospace',
                  fontSize: "10px",
                  letterSpacing: "0.06em",
                  color: statusColor,
                  border: `1px solid ${statusColor}`,
                  borderRadius: "999px",
                  padding: "2px 8px",
                  textTransform: "uppercase",
                }}
              >
                {statusInfo.label.toUpperCase()}
              </span>
              <span
                style={{
                  fontFamily: '"Space Mono", monospace',
                  fontSize: "10px",
                  letterSpacing: "0.06em",
                  color: "var(--n-text-disabled)",
                  textTransform: "uppercase",
                }}
              >
                {cup.type === "public" ? "PUBLIC" : "PRO"}
              </span>
            </div>
          </SheetHeader>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px 12px",
            }}
          >
            <NavigationContent onNavigate={() => setMobileMenuOpen(false)} />
          </div>

          <div
            style={{
              borderTop: "1px solid var(--n-border)",
              padding: "12px",
            }}
          >
            <UserMenu settingsHref="/dashboard/settings" dropdownSide="top" />
          </div>
        </SheetContent>
      </Sheet>

      {/* Content area */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
        }}
        className="lg:ml-[240px]"
      >
        {/* Mobile top bar */}
        <div
          className="lg:hidden"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "12px 16px",
            background: "var(--n-surface)",
            borderBottom: "1px solid var(--n-border)",
            position: "sticky",
            top: 0,
            zIndex: 40,
          }}
        >
          <button
            onClick={() => setMobileMenuOpen(true)}
            style={{
              background: "transparent",
              border: "1px solid var(--n-border-visible)",
              borderRadius: "6px",
              width: "36px",
              height: "36px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
            aria-label="Menu"
          >
            <Menu size={16} style={{ color: "var(--n-text-secondary)" }} />
          </button>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              className="n-font-display"
              style={{
                fontSize: "14px",
                fontWeight: 500,
                color: "var(--n-text-display)",
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {cup.name}
            </p>
            {(currentPage ?? isOverview) && (
              <p
                style={{
                  fontSize: "10px",
                  letterSpacing: "0.06em",
                  color: "var(--n-text-disabled)",
                  textTransform: "uppercase",
                  margin: "2px 0 0 0",
                }}
              >
                {isOverview ? "VUE D'ENSEMBLE" : currentPage?.label.toUpperCase()}
              </p>
            )}
          </div>

          <span
            style={{
              fontFamily: '"Space Mono", monospace',
              fontSize: "10px",
              letterSpacing: "0.06em",
              color: statusColor,
              border: `1px solid ${statusColor}`,
              borderRadius: "999px",
              padding: "2px 8px",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            {statusInfo.label.toUpperCase()}
          </span>
        </div>

        {/* Main content */}
        <main style={{ flex: 1, overflow: "auto" }}>
          <div
            style={{ padding: "24px 16px" }}
            className={cn("lg:p-8")}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

/* Helper: get status color from cup.status */
function getStatusColor(status: string): string {
  switch (status) {
    case "active":
    case "registration":
      return "var(--n-success)";
    case "rating":
      return "var(--n-warning)";
    case "draft":
      return "var(--n-text-disabled)";
    case "completed":
    case "published":
      return "var(--n-text-secondary)";
    default:
      return "var(--n-text-disabled)";
  }
}
