"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Newspaper,
  Menu,
  ChevronDown,
  Info,
  Handshake,
  Mail,
  MessageSquare,
  Search,
  LayoutDashboard,
  FileText,
  Settings,
  CreditCard,
  Megaphone,
  Building2,
  Gavel,
} from "lucide-react";

import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { UserMenu } from "~/components/layout/user-menu";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface CollapsibleSection {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

interface DashboardSidebarProps {
  className?: string;
  /** Base URL for all navigation links. Defaults to "" (root). Use "/dashboard" for portal. */
  baseUrl?: string;
}

/**
 * Check if current path is inside a cup detail page
 * Pattern: /cups/[cupId]/... or /dashboard/cups/[cupId]/... where cupId is not empty
 */
function isInsideCupDetail(pathname: string, baseUrl: string): boolean {
  const cupsPath = baseUrl ? `${baseUrl}/cups` : "/cups";
  const match = pathname.match(new RegExp(`^${cupsPath.replace("/", "\\/")}\\/([^/]+)`));
  return !!(match && match[1] && match[1].length > 0 && pathname !== cupsPath);
}

export function DashboardSidebar({ className, baseUrl = "" }: DashboardSidebarProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Helper to build paths with baseUrl
  const buildPath = (path: string) => `${baseUrl}${path}`;

  // Track which mini-sections are expanded (only 2: contenu and domainSeo)
  const getInitialExpandedSections = (): Record<string, boolean> => {
    const aboutPath = buildPath("/settings/portal/about");
    const articlesPath = buildPath("/articles");
    const pressPath = buildPath("/settings/portal/press");
    const seoPath = buildPath("/settings/portal/seo");
    const domainPath = buildPath("/settings/portal");

    // Auto-expand based on current path
    const isInContenu = pathname.startsWith(aboutPath) || pathname.startsWith(articlesPath) || pathname.startsWith(pressPath);
    const isInDomainSeo = pathname === domainPath || pathname.startsWith(seoPath);

    return {
      contenu: isInContenu,
      domainSeo: isInDomainSeo
    };
  };

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(getInitialExpandedSections);

  // Hide sidebar when inside a cup detail (cup has its own sidebar)
  const inCupDetail = isInsideCupDetail(pathname, baseUrl);
  if (inCupDetail) {
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // NEW FLAT NAVIGATION STRUCTURE
  // ═══════════════════════════════════════════════════════════════

  // Main navigation items (direct links, no collapse)
  const mainNavItems: NavItem[] = [
    { href: buildPath(""), label: "Vue d'ensemble", icon: LayoutDashboard },
    { href: buildPath("/cups"), label: "Mes Cups", icon: Trophy },
    { href: buildPath("/producers"), label: "Producteurs", icon: Building2 },
    { href: buildPath("/juries"), label: "Jurys", icon: Gavel },
  ];

  // Portal section items (direct links)
  const portalNavItems: NavItem[] = [
    // "Contenu" will be a mini-collapsible inserted here
    { href: buildPath("/settings/portal/messages"), label: "Messages", icon: MessageSquare },
    { href: buildPath("/settings/newsletter"), label: "Newsletter", icon: Mail },
    { href: buildPath("/settings/sponsors"), label: "Sponsors", icon: Handshake },
  ];

  // Mini-collapsible: Contenu (À propos + Actualités + Presse)
  const contenuSection: CollapsibleSection = {
    id: "contenu",
    label: "Contenu",
    icon: FileText,
    items: [
      { href: buildPath("/settings/portal/about"), label: "À propos", icon: Info },
      { href: buildPath("/articles"), label: "Actualités", icon: Newspaper },
      { href: buildPath("/settings/portal/press"), label: "Presse & Médias", icon: Megaphone },
    ],
  };

  // SEO direct link
  const seoNavItem: NavItem = {
    href: buildPath("/settings/portal/seo"),
    label: "SEO",
    icon: Search,
  };

  // Payments item (direct link)
  const paymentsNavItem: NavItem = {
    href: buildPath("/settings/payments"),
    label: "Paiements",
    icon: CreditCard
  };

  // Settings item (direct link)
  const settingsNavItem: NavItem = {
    href: buildPath("/settings"),
    label: "Paramètres",
    icon: Settings
  };

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionId]: !prev[sectionId],
    }));
  };

  const isActive = (href: string) => {
    const dashboardRoot = buildPath("");
    const cupsPath = buildPath("/cups");
    const settingsPath = buildPath("/settings");
    const settingsPortalPath = buildPath("/settings/portal");

    // Vue d'ensemble - only exact match on dashboard root
    if (href === dashboardRoot) {
      return pathname === dashboardRoot || pathname === dashboardRoot + "/";
    }
    if (href === cupsPath) {
      return pathname === cupsPath;
    }
    if (href === settingsPath) {
      return pathname === settingsPath;
    }
    if (href === settingsPortalPath) {
      return pathname === settingsPortalPath;
    }
    return pathname === href || pathname.startsWith(href + "/");
  };

  const isMiniSectionActive = (section: CollapsibleSection) => {
    return section.items.some((item) => isActive(item.href));
  };

  // Helper to render a direct nav item
  const renderNavItem = (item: NavItem, onNavigate?: () => void) => {
    const Icon = item.icon;
    const active = isActive(item.href);

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNavigate}
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all relative group",
          active
            ? "bg-primary/10 text-primary border border-primary/20"
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent"
        )}
      >
        <div className={cn(
          "p-1.5 rounded-lg transition-all",
          active
            ? "bg-primary/15 text-primary"
            : "bg-white/5 text-muted-foreground group-hover:bg-white/10 group-hover:text-foreground"
        )}>
          <Icon className="h-4 w-4" />
        </div>
        <span>{item.label}</span>
      </Link>
    );
  };

  // Helper to render a mini-collapsible section
  const renderMiniSection = (section: CollapsibleSection, onNavigate?: () => void) => {
    const SectionIcon = section.icon;
    const isExpanded = expandedSections[section.id];
    const sectionActive = isMiniSectionActive(section);

    return (
      <div key={section.id}>
        {/* Mini-section header */}
        <button
          type="button"
          onClick={() => toggleSection(section.id)}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all w-full group",
            sectionActive
              ? "bg-primary/10 text-primary border border-primary/20"
              : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent"
          )}
        >
          <div className={cn(
            "p-1.5 rounded-lg transition-all",
            sectionActive
              ? "bg-primary/15 text-primary"
              : "bg-white/5 text-muted-foreground group-hover:bg-white/10 group-hover:text-foreground"
          )}>
            <SectionIcon className="h-4 w-4" />
          </div>
          <span className="flex-1 text-left">{section.label}</span>
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 opacity-50" />
          </motion.div>
        </button>

        {/* Mini-section items */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="mt-1 ml-5 space-y-0.5 border-l border-white/10 pl-3 py-1">
                {section.items.map((item, index) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <Link
                        href={item.href}
                        onClick={onNavigate}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-all relative group/item",
                          active
                            ? "text-primary font-medium"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {active && (
                          <motion.div
                            layoutId={`activeIndicator-${section.id}`}
                            className="absolute inset-0 bg-primary/10 border border-primary/20 rounded-lg"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                          />
                        )}
                        <Icon className={cn(
                          "h-3.5 w-3.5 shrink-0 relative z-10 transition-colors",
                          active ? "text-primary" : "group-hover/item:text-foreground"
                        )} />
                        <span className="relative z-10">{item.label}</span>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  // Shared navigation content with glassmorphism styling - NEW FLAT STRUCTURE
  const NavigationContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex flex-col h-full min-h-0">
      {/* Logo / Brand - Premium gradient header */}
      <div className="p-5 border-b border-white/5">
        <Link
          href={buildPath("/cups")}
          className="flex items-center gap-3 group"
          onClick={onNavigate}
        >
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full group-hover:bg-primary/30 transition-all" />
            <div className="relative icon-glow">
              <Trophy className="h-5 w-5" />
            </div>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg gradient-text">CupMetrics</span>
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest">Dashboard</span>
          </div>
        </Link>
      </div>

      {/* Navigation - FLAT STRUCTURE */}
      <div className="flex-1 overflow-y-auto py-4 px-3 min-h-0">
        <nav className="space-y-1">
          {/* ═══ MAIN SECTION ═══ */}
          {mainNavItems.map((item) => renderNavItem(item, onNavigate))}

          {/* ═══ SEPARATOR: PORTAIL ═══ */}
          <div className="divider-gradient my-3" />
          <p className="px-3 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2">
            Portail Public
          </p>

          {/* Contenu (mini-collapsible) */}
          {renderMiniSection(contenuSection, onNavigate)}

          {/* Messages, Newsletter, Sponsors (direct) */}
          {portalNavItems.map((item) => renderNavItem(item, onNavigate))}

          {/* ═══ SEPARATOR: CONFIGURATION ═══ */}
          <div className="divider-gradient my-3" />
          <p className="px-3 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2">
            Configuration
          </p>

          {/* SEO (direct) */}
          {renderNavItem(seoNavItem, onNavigate)}

          {/* Paiements (direct) */}
          {renderNavItem(paymentsNavItem, onNavigate)}

          {/* Paramètres (direct) */}
          {renderNavItem(settingsNavItem, onNavigate)}
        </nav>
      </div>

      {/* User Menu at bottom */}
      <div className="mt-auto border-t border-white/5 p-3 relative z-[9999]">
        <div className="flex items-center gap-3">
          <UserMenu settingsHref={buildPath("/settings")} dropdownSide="top" />
          <div className="flex-1 min-w-0 hidden group-hover:block">
            <p className="text-xs text-muted-foreground truncate">Mon compte</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar - Glass Panel - Fixed full height */}
      <aside
        className={cn(
          "hidden lg:flex w-64 flex-col fixed top-0 left-0 h-screen z-40",
          "glass-panel border-r-0",
          className
        )}
      >
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="relative z-10 h-full flex flex-col min-h-0">
          <NavigationContent />
        </div>
        {/* Right edge highlight */}
        <div className="absolute right-0 top-0 bottom-0 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent" />
      </aside>

      {/* Mobile Menu Button - Glass style */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMobileMenuOpen(true)}
          className="glass-button rounded-xl shadow-lg shadow-black/20 border-white/10"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Menu</span>
        </Button>
      </div>

      {/* Mobile Sidebar - Glass Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent
          side="left"
          className="w-72 p-0 glass-panel border-r-0 bg-background/95"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <NavigationContent onNavigate={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

/**
 * Mobile header for dashboard pages
 * Shows current section and menu button - Glass style
 */
export function DashboardMobileHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="lg:hidden flex items-center gap-3 p-4 pl-16 glass sticky top-0 z-40">
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold truncate">{title}</h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
    </div>
  );
}
