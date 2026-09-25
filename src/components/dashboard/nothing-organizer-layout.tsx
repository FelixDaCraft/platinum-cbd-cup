"use client";

import * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trophy,
  Newspaper,
  Menu,
  ChevronDown,
  Info,
  Handshake,
  Mail,
  MessageSquare,
  LayoutDashboard,
  FileText,
  Settings,
  Megaphone,
  Building2,
  Gavel,
  LogOut,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "~/lib/utils";
import { useOrganization } from "~/lib/portal/context";
import { authClient, useSession } from "~/lib/auth-client";
import { PWAWrapper } from "~/components/pwa/pwa-wrapper";

// ─── Nothing Design CSS (shared with jury) ─────────────────────────────────

const nothingCss = `
@import url('https://fonts.googleapis.com/css2?family=Doto:wght@400;700&family=Space+Grotesk:wght@300;400;500;700&family=Space+Mono:wght@400;700&display=swap');

.nothing-org {
  --n-black: #000000;
  --n-surface: #111111;
  --n-surface-raised: #1A1A1A;
  --n-border: #222222;
  --n-border-visible: #333333;
  /* #666666 ne donnait que 3.66:1 sur --n-black, sous le seuil WCAG AA (4.5:1),
     alors que ce token porte de l'information (libellés de stats, en-têtes de
     tableau, "[LOADING...]") et pas seulement des éléments désactivés.
     #858585 = 5.70:1 sur #000, 5.12:1 sur --n-surface, 4.72:1 sur --n-surface-raised. */
  --n-text-disabled: #858585;
  --n-text-secondary: #999999;
  --n-text-primary: #E8E8E8;
  --n-text-display: #FFFFFF;
  --n-accent: #D71921;
  --n-accent-subtle: rgba(215,25,33,0.15);
  --n-success: #4A9E5C;
  --n-warning: #D4A843;
  --n-interactive: #5B9BF6;

  font-family: "Space Grotesk", system-ui, sans-serif;
  background-color: var(--n-black) !important;
  color: var(--n-text-primary) !important;
  -webkit-font-smoothing: antialiased;

  /* Override shadcn/dashboard variables for Nothing look */
  --background: 0 0% 0% !important;
  --foreground: 0 0% 91% !important;
  --card: 0 0% 6.7% !important;
  --card-foreground: 0 0% 91% !important;
  --popover: 0 0% 6.7% !important;
  --popover-foreground: 0 0% 91% !important;
  --primary: 0 0% 100% !important;
  --primary-foreground: 0 0% 0% !important;
  --secondary: 0 0% 10.2% !important;
  --secondary-foreground: 0 0% 91% !important;
  --muted: 0 0% 10.2% !important;
  --muted-foreground: 0 0% 60% !important;
  --accent: 0 0% 13.3% !important;
  --accent-foreground: 0 0% 91% !important;
  --destructive: 357 80% 47% !important;
  --destructive-foreground: 0 0% 100% !important;
  --border: 0 0% 13.3% !important;
  --input: 0 0% 13.3% !important;
  --ring: 0 0% 40% !important;
  --radius: 0.5rem !important;

  /* Portal variable overrides */
  --portal-background: 0 0% 0%;
  --portal-foreground: 0 0% 91%;
  --portal-card: 0 0% 6.7%;
  --portal-border: 0 0% 13.3%;
  --portal-muted: 0 0% 10.2%;
  --portal-muted-foreground: 0 0% 60%;
  --portal-primary: 0 0% 100%;
  --portal-secondary: 0 0% 20%;
}

.nothing-org .n-font-display { font-family: "Doto", "Space Mono", monospace; }
.nothing-org .n-font-body { font-family: "Space Grotesk", system-ui, sans-serif; }
.nothing-org .n-font-data { font-family: "Space Mono", monospace; }
.nothing-org .n-label {
  font-family: "Space Mono", monospace;
  font-size: 11px;
  line-height: 1.2;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--n-text-secondary);
}

.nothing-org .n-card {
  background: var(--n-surface);
  border: 1px solid var(--n-border);
  border-radius: 12px;
  padding: 24px;
}

.nothing-org .n-progress-bar { display: flex; gap: 2px; width: 100%; }
.nothing-org .n-progress-segment { flex: 1; height: 8px; background: var(--n-border); }
.nothing-org .n-progress-segment.filled { background: var(--n-text-display); }
.nothing-org .n-progress-segment.filled.success { background: var(--n-success); }
.nothing-org .n-progress-segment.filled.warning { background: var(--n-warning); }
.nothing-org .n-progress-segment.filled.accent { background: var(--n-accent); }

.nothing-org .n-tag {
  display: inline-flex; align-items: center;
  font-family: "Space Mono", monospace; font-size: 11px;
  text-transform: uppercase; letter-spacing: 0.06em;
  padding: 4px 12px; border-radius: 999px;
  border: 1px solid var(--n-border-visible); color: var(--n-text-secondary);
}
.nothing-org .n-tag.active { border-color: var(--n-text-display); color: var(--n-text-display); }
.nothing-org .n-tag.success { border-color: var(--n-success); color: var(--n-success); }

.nothing-org .n-btn-primary {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: "Space Mono", monospace; font-size: 13px;
  text-transform: uppercase; letter-spacing: 0.06em;
  padding: 12px 24px; min-height: 44px; border-radius: 999px;
  background: var(--n-text-display); color: var(--n-black);
  border: none; cursor: pointer; transition: opacity 200ms ease-out; white-space: nowrap;
}
.nothing-org .n-btn-primary:hover { opacity: 0.85; }
.nothing-org .n-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.nothing-org .n-btn-secondary {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: "Space Mono", monospace; font-size: 13px;
  text-transform: uppercase; letter-spacing: 0.06em;
  padding: 12px 24px; min-height: 44px; border-radius: 999px;
  background: transparent; color: var(--n-text-primary);
  border: 1px solid var(--n-border-visible); cursor: pointer;
  transition: border-color 200ms ease-out, color 200ms ease-out; white-space: nowrap;
}
.nothing-org .n-btn-secondary:hover { border-color: var(--n-text-primary); color: var(--n-text-display); }

.nothing-org .n-btn-ghost {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: "Space Mono", monospace; font-size: 13px;
  text-transform: uppercase; letter-spacing: 0.06em;
  padding: 8px 16px; min-height: 44px; border-radius: 0;
  background: transparent; color: var(--n-text-secondary);
  border: none; cursor: pointer; transition: color 200ms ease-out; white-space: nowrap;
}
.nothing-org .n-btn-ghost:hover { color: var(--n-text-display); }

.nothing-org .n-input {
  font-family: "Space Mono", monospace; font-size: 16px;
  background: transparent; border: none;
  border-bottom: 1px solid var(--n-border-visible);
  color: var(--n-text-primary); padding: 12px 0; width: 100%; outline: none;
  transition: border-color 200ms ease-out;
}
.nothing-org .n-input:focus { border-color: var(--n-text-primary); }
.nothing-org .n-input::placeholder { color: var(--n-text-disabled); }

.nothing-org ::-webkit-scrollbar { width: 4px; }
.nothing-org ::-webkit-scrollbar-track { background: transparent; }
.nothing-org ::-webkit-scrollbar-thumb { background: var(--n-border-visible); border-radius: 2px; }

/* Override all shadcn components to remove shadows/gradients */
.nothing-org [class*="shadow"] { box-shadow: none !important; }
.nothing-org .glass, .nothing-org .glass-card, .nothing-org .glass-panel,
.nothing-org .glass-button { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
.nothing-org [class*="blur-"] { filter: none !important; }
.nothing-org [class*="gradient"] { background-image: none !important; }
.nothing-org .animate-pulse { animation: none !important; }
.nothing-org .animated-gradient-bg { display: none !important; }
.nothing-org .bg-grid-pattern { display: none !important; }

/* Lien d'évitement : hors écran tant qu'il n'a pas le focus. */
.nothing-org .n-skip-link {
  position: absolute;
  left: -9999px;
  top: 0;
  z-index: 100;
  padding: 10px 16px;
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  letter-spacing: 0.06em;
  background-color: var(--n-surface-raised);
  color: var(--n-text-display);
  border: 1px solid var(--n-border-visible);
}
.nothing-org .n-skip-link:focus {
  left: 8px;
  top: 8px;
}
`;

// ─── Navigation Types ───────────────────────────────────────────────────────

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

// ─── Sidebar check ──────────────────────────────────────────────────────────

// Racine de l'espace organisateur. C'était un préfixe de sous-domaine
// paramétrable du temps du SaaS multi-tenant ; il ne reste qu'une seule
// installation, donc une seule racine.
const ORG_ROOT = "/dashboard";
const CUPS_PATH = `${ORG_ROOT}/cups`;

function isInsideCupDetail(pathname: string): boolean {
  const match = pathname.match(new RegExp(`^${CUPS_PATH.replace("/", "\\/")}\\/([^/]+)`));
  return !!(match && match[1] && match[1].length > 0 && pathname !== CUPS_PATH);
}

// ─── Nothing Organizer Sidebar ──────────────────────────────────────────────

function NothingOrgSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const organization = useOrganization();
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => ({
    contenu:
      pathname.startsWith(`${ORG_ROOT}/settings/portal/about`) ||
      pathname.startsWith(`${ORG_ROOT}/articles`) ||
      pathname.startsWith(`${ORG_ROOT}/settings/portal/press`),
  }));
  // Référence stable : MobileNavDrawer la garde en dépendance de son effet
  // (piège à focus + écouteur Échap), qu'on ne veut pas réinstaller à chaque
  // rendu de la barre latérale.
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);

  const inCupDetail = isInsideCupDetail(pathname);
  if (inCupDetail) return null;

  const buildPath = (path: string) => `${ORG_ROOT}${path}`;

  const handleLogout = async () => {
    await authClient.signOut({ fetchOptions: { onSuccess: () => router.push("/login") } });
  };

  const mainNavItems: NavItem[] = [
    { href: buildPath(""), label: "VUE D'ENSEMBLE", icon: LayoutDashboard },
    { href: buildPath("/cups"), label: "MES CUPS", icon: Trophy },
    { href: buildPath("/producers"), label: "PRODUCTEURS", icon: Building2 },
    { href: buildPath("/juries"), label: "JURYS", icon: Gavel },
  ];

  const portalNavItems: NavItem[] = [
    { href: buildPath("/settings/portal/messages"), label: "MESSAGES", icon: MessageSquare },
    { href: buildPath("/settings/newsletter"), label: "NEWSLETTER", icon: Mail },
    { href: buildPath("/settings/sponsors"), label: "SPONSORS", icon: Handshake },
  ];

  const contenuSection: CollapsibleSection = {
    id: "contenu", label: "CONTENU", icon: FileText,
    items: [
      { href: buildPath("/settings/portal/about"), label: "À PROPOS", icon: Info },
      { href: buildPath("/articles"), label: "ACTUALITÉS", icon: Newspaper },
      { href: buildPath("/settings/portal/press"), label: "PRESSE", icon: Megaphone },
    ],
  };

  const isActive = (href: string) => {
    const dashRoot = buildPath("");
    const settingsPath = buildPath("/settings");
    const portalPath = buildPath("/settings/portal");
    if (href === dashRoot) return pathname === dashRoot || pathname === dashRoot + "/";
    if (href === CUPS_PATH) return pathname === CUPS_PATH;
    if (href === settingsPath) return pathname === settingsPath;
    if (href === portalPath) return pathname === portalPath;
    return pathname === href || pathname.startsWith(href + "/");
  };

  const toggleSection = (id: string) => setExpandedSections(p => ({ ...p, [id]: !p[id] }));

  const renderItem = (item: NavItem, onNav?: () => void) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onNav}
        // L'état actif n'était signalé que par la couleur : inaudible au
        // lecteur d'écran sans aria-current.
        aria-current={active ? "page" : undefined}
        className="flex items-center gap-3 px-3 py-2 text-xs relative transition-colors duration-200"
        style={{
          fontFamily: "'Space Mono', monospace",
          letterSpacing: "0.06em",
          color: active ? "var(--n-text-display)" : "var(--n-text-disabled)",
        }}
      >
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4" style={{ backgroundColor: "var(--n-text-display)" }} />
        )}
        <Icon className="h-[16px] w-[16px] shrink-0" strokeWidth={1.5} />
        <span>{item.label}</span>
      </Link>
    );
  };

  const renderSection = (section: CollapsibleSection, onNav?: () => void) => {
    const SIcon = section.icon;
    const expanded = expandedSections[section.id];
    const sActive = section.items.some(i => isActive(i.href));
    return (
      <div key={section.id}>
        <button
          type="button"
          onClick={() => toggleSection(section.id)}
          aria-expanded={expanded ?? false}
          className="flex items-center gap-3 px-3 py-2 text-xs w-full transition-colors duration-200"
          style={{
            fontFamily: "'Space Mono', monospace",
            letterSpacing: "0.06em",
            color: sActive ? "var(--n-text-display)" : "var(--n-text-disabled)",
          }}
        >
          <SIcon className="h-[16px] w-[16px] shrink-0" strokeWidth={1.5} />
          <span className="flex-1 text-left">{section.label}</span>
          <ChevronDown
            className={cn("h-3 w-3 transition-transform duration-200", expanded && "rotate-180")}
            style={{ opacity: 0.5 }}
            strokeWidth={1.5}
          />
        </button>
        {expanded && (
          <div className="ml-6 pl-3 space-y-0.5 py-1" style={{ borderLeft: "1px solid var(--n-border)" }}>
            {section.items.map(item => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNav}
                  aria-current={active ? "page" : undefined}
                  className="flex items-center gap-2 px-2 py-1.5 text-xs transition-colors duration-200"
                  style={{
                    fontFamily: "'Space Mono', monospace",
                    letterSpacing: "0.06em",
                    color: active ? "var(--n-text-display)" : "var(--n-text-disabled)",
                  }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const navContent = (onNav?: () => void) => (
    <div className="flex flex-col h-full min-h-0">
      {/* Brand */}
      <div className="p-4 border-b" style={{ borderColor: "var(--n-border)" }}>
        <Link href={buildPath("/cups")} onClick={onNav} className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--n-surface)" }}>
            <Trophy className="h-4 w-4" style={{ color: "var(--n-text-secondary)" }} strokeWidth={1.5} />
          </div>
          <div>
            <p className="n-font-data text-xs font-bold" style={{ color: "var(--n-text-display)", letterSpacing: "0.08em" }}>
              {organization.name.toUpperCase()}
            </p>
            <p className="text-[10px]" style={{ color: "var(--n-text-disabled)", fontFamily: "'Space Mono', monospace", letterSpacing: "0.08em" }}>
              ORGANISATEUR
            </p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav aria-label="Navigation organisateur" className="flex-1 overflow-y-auto py-3 px-2 min-h-0 space-y-1">
        {mainNavItems.map(i => renderItem(i, onNav))}

        <div className="my-3 mx-3" style={{ borderTop: "1px solid var(--n-border)" }} />
        <p className="px-3 pb-1" style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", color: "var(--n-text-disabled)" }}>
          PORTAIL PUBLIC
        </p>
        {renderSection(contenuSection, onNav)}
        {portalNavItems.map(i => renderItem(i, onNav))}

        <div className="my-3 mx-3" style={{ borderTop: "1px solid var(--n-border)" }} />
        <p className="px-3 pb-1" style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", color: "var(--n-text-disabled)" }}>
          CONFIGURATION
        </p>
        {renderItem({ href: buildPath("/settings"), label: "PARAMÈTRES", icon: Settings }, onNav)}
      </nav>

      {/* User */}
      {session?.user && (
        <div className="border-t p-3" style={{ borderColor: "var(--n-border)" }}>
          <div className="flex items-center gap-3 px-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full shrink-0 text-xs font-bold"
              style={{ backgroundColor: "var(--n-surface-raised)", color: "var(--n-text-secondary)", fontFamily: "'Space Mono', monospace" }}
            >
              {session.user.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) ?? "??"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "var(--n-text-primary)" }}>{session.user.name ?? "Utilisateur"}</p>
              <p className="text-[10px] truncate" style={{ color: "var(--n-text-disabled)" }}>{session.user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 transition-colors"
              style={{ color: "var(--n-text-disabled)" }}
              title="Déconnexion"
              aria-label="Déconnexion"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:flex w-64 flex-col fixed top-0 left-0 h-screen z-40 border-r" style={{ backgroundColor: "var(--n-black)", borderColor: "var(--n-border)" }}>
        {navContent()}
      </aside>

      {/* Mobile trigger */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={mobileMenuOpen}
          aria-controls={MOBILE_DRAWER_ID}
          className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors"
          style={{ backgroundColor: "var(--n-surface)", border: "1px solid var(--n-border-visible)", color: "var(--n-text-secondary)" }}
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      {/* Mobile overlay */}
      <MobileNavDrawer open={mobileMenuOpen} onClose={closeMobileMenu}>
        {navContent(closeMobileMenu)}
      </MobileNavDrawer>
    </>
  );
}

// ─── Mobile drawer ──────────────────────────────────────────────────────────

const MOBILE_DRAWER_ID = "nothing-org-mobile-nav";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Tiroir de navigation mobile.
 *
 * C'était un simple `div fixed inset-0` : pas de rôle, pas de fermeture au
 * clavier, et le focus continuait de parcourir la page masquée derrière lui.
 * On lui donne donc le contrat d'une boîte de dialogue modale — role/aria-modal,
 * touche Échap, piège à focus, restitution du focus au déclencheur — et on
 * gèle le défilement de la page tant qu'il est ouvert.
 */
function MobileNavDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !panel) return;

      const focusables = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        id={MOBILE_DRAWER_ID}
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navigation"
        tabIndex={-1}
        className="relative w-72 h-full border-r outline-none"
        style={{ backgroundColor: "var(--n-black)", borderColor: "var(--n-border)" }}
      >
        <button
          onClick={onClose}
          aria-label="Fermer le menu"
          className="absolute top-4 right-4 p-1"
          style={{ color: "var(--n-text-disabled)" }}
        >
          <X className="h-5 w-5" strokeWidth={1.5} />
        </button>
        {children}
      </div>
    </div>
  );
}

// ─── Main Layout ────────────────────────────────────────────────────────────

interface NothingOrganizerLayoutProps {
  children: React.ReactNode;
}

export function NothingOrganizerLayout({ children }: NothingOrganizerLayoutProps) {
  const pathname = usePathname();
  const inCupDetail = isInsideCupDetail(pathname);

  return (
    <PWAWrapper>
      <style dangerouslySetInnerHTML={{ __html: nothingCss }} />
      <div className="nothing-org min-h-screen" style={{ backgroundColor: "var(--n-black)" }}>
        {/* Premier élément focusable de la page : permet de sauter la barre
            latérale, qui compte une trentaine de liens répétés à chaque écran. */}
        <a href="#contenu-principal" className="n-skip-link">
          Aller au contenu
        </a>
        <NothingOrgSidebar />
        <div className={cn("flex-1 flex flex-col min-h-screen relative", !inCupDetail && "lg:ml-64")}>
          <main
            id="contenu-principal"
            tabIndex={-1}
            className={inCupDetail ? "flex-1 overflow-auto" : "flex-1 overflow-auto p-6 lg:p-8"}
          >
            {children}
          </main>
        </div>
      </div>
    </PWAWrapper>
  );
}
