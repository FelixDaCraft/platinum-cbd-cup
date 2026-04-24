"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  ClipboardList,
  Trophy,
  User,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Scale,
  Building2,
  Package,
  type LucideIcon,
} from "lucide-react";

import { cn } from "~/lib/utils";
import { useOrganization, usePortalTheme } from "~/lib/portal/context";
import { authClient } from "~/lib/auth-client";
import { api } from "~/trpc/react";
import { PWAWrapper } from "~/components/pwa/pwa-wrapper";

// ─── Nothing Design CSS ────────────────────────────────────────────────────

const nothingCss = `
/* Nothing Design System — Jury Portal Override */
@import url('https://fonts.googleapis.com/css2?family=Doto:wght@400;700&family=Space+Grotesk:wght@300;400;500;700&family=Space+Mono:wght@400;700&display=swap');

#portal-root .nothing-jury {
  --n-black: #000000;
  --n-surface: #111111;
  --n-surface-raised: #1A1A1A;
  --n-border: #222222;
  --n-border-visible: #333333;
  --n-text-disabled: #666666;
  --n-text-secondary: #999999;
  --n-text-primary: #E8E8E8;
  --n-text-display: #FFFFFF;
  --n-accent: #D71921;
  --n-accent-subtle: rgba(215,25,33,0.15);
  --n-success: #4A9E5C;
  --n-warning: #D4A843;
  --n-interactive: #5B9BF6;

  font-family: "Space Grotesk", system-ui, sans-serif;
  background-color: var(--n-black);
  color: var(--n-text-primary);
  -webkit-font-smoothing: antialiased;
}

/* Override portal variables so portal components adopt Nothing look */
#portal-root .nothing-jury {
  --portal-background: 0 0% 0%;
  --portal-foreground: 0 0% 91%;
  --portal-card: 0 0% 6.7%;
  --portal-border: 0 0% 13.3%;
  --portal-muted: 0 0% 10.2%;
  --portal-muted-foreground: 0 0% 60%;
  --portal-primary: 357 80% 47%;
  --portal-secondary: 0 0% 20%;
  --portal-accent: 357 80% 47%;
}

/* Typography utilities */
.nothing-jury .n-font-display { font-family: "Doto", "Space Mono", monospace; }
.nothing-jury .n-font-body { font-family: "Space Grotesk", system-ui, sans-serif; }
.nothing-jury .n-font-data { font-family: "Space Mono", monospace; }
.nothing-jury .n-label {
  font-family: "Space Mono", monospace;
  font-size: 11px;
  line-height: 1.2;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--n-text-secondary);
}

/* Segmented progress bar */
.nothing-jury .n-progress-bar {
  display: flex;
  gap: 2px;
  width: 100%;
}
.nothing-jury .n-progress-segment {
  flex: 1;
  height: 8px;
  background: var(--n-border);
  transition: background-color 200ms ease-out;
}
.nothing-jury .n-progress-segment.filled {
  background: var(--n-text-display);
}
.nothing-jury .n-progress-segment.filled.success {
  background: var(--n-success);
}
.nothing-jury .n-progress-segment.filled.warning {
  background: var(--n-warning);
}
.nothing-jury .n-progress-segment.filled.accent {
  background: var(--n-accent);
}

/* Nothing button styles */
.nothing-jury .n-btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: "Space Mono", monospace;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 12px 24px;
  min-height: 44px;
  border-radius: 999px;
  background: var(--n-text-display);
  color: var(--n-black);
  border: none;
  cursor: pointer;
  transition: opacity 200ms ease-out;
  white-space: nowrap;
}
.nothing-jury .n-btn-primary:hover { opacity: 0.85; }
.nothing-jury .n-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.nothing-jury .n-btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: "Space Mono", monospace;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 12px 24px;
  min-height: 44px;
  border-radius: 999px;
  background: transparent;
  color: var(--n-text-primary);
  border: 1px solid var(--n-border-visible);
  cursor: pointer;
  transition: border-color 200ms ease-out, color 200ms ease-out;
  white-space: nowrap;
}
.nothing-jury .n-btn-secondary:hover {
  border-color: var(--n-text-primary);
  color: var(--n-text-display);
}
.nothing-jury .n-btn-secondary:disabled { opacity: 0.4; cursor: not-allowed; }

.nothing-jury .n-btn-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: "Space Mono", monospace;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 8px 16px;
  min-height: 44px;
  border-radius: 0;
  background: transparent;
  color: var(--n-text-secondary);
  border: none;
  cursor: pointer;
  transition: color 200ms ease-out;
  white-space: nowrap;
}
.nothing-jury .n-btn-ghost:hover { color: var(--n-text-display); }

.nothing-jury .n-btn-destructive {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-family: "Space Mono", monospace;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 12px 24px;
  min-height: 44px;
  border-radius: 999px;
  background: transparent;
  color: var(--n-accent);
  border: 1px solid var(--n-accent);
  cursor: pointer;
  transition: opacity 200ms ease-out;
  white-space: nowrap;
}
.nothing-jury .n-btn-destructive:hover { opacity: 0.85; }

/* Nothing card */
.nothing-jury .n-card {
  background: var(--n-surface);
  border: 1px solid var(--n-border);
  border-radius: 12px;
  padding: 24px;
}

/* Nothing tag/chip */
.nothing-jury .n-tag {
  display: inline-flex;
  align-items: center;
  font-family: "Space Mono", monospace;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--n-border-visible);
  color: var(--n-text-secondary);
  white-space: nowrap;
}
.nothing-jury .n-tag.active {
  border-color: var(--n-text-display);
  color: var(--n-text-display);
}
.nothing-jury .n-tag.success {
  border-color: var(--n-success);
  color: var(--n-success);
}
.nothing-jury .n-tag.warning {
  border-color: var(--n-warning);
  color: var(--n-warning);
}
.nothing-jury .n-tag.accent {
  border-color: var(--n-accent);
  color: var(--n-accent);
}

/* Dot grid background */
.nothing-jury .n-dot-grid {
  background-image: radial-gradient(circle, var(--n-border-visible) 1px, transparent 1px);
  background-size: 16px 16px;
}

/* Scrollbar styling */
.nothing-jury ::-webkit-scrollbar { width: 4px; }
.nothing-jury ::-webkit-scrollbar-track { background: transparent; }
.nothing-jury ::-webkit-scrollbar-thumb { background: var(--n-border-visible); border-radius: 2px; }

/* Input Nothing style */
.nothing-jury .n-input {
  font-family: "Space Mono", monospace;
  font-size: 16px;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--n-border-visible);
  color: var(--n-text-primary);
  padding: 12px 0;
  width: 100%;
  outline: none;
  transition: border-color 200ms ease-out;
}
.nothing-jury .n-input:focus { border-color: var(--n-text-primary); }
.nothing-jury .n-input::placeholder { color: var(--n-text-disabled); }

/* Textarea Nothing style */
.nothing-jury .n-textarea {
  font-family: "Space Grotesk", system-ui, sans-serif;
  font-size: 14px;
  background: var(--n-surface-raised);
  border: 1px solid var(--n-border);
  border-radius: 8px;
  color: var(--n-text-primary);
  padding: 12px 16px;
  width: 100%;
  outline: none;
  resize: none;
  transition: border-color 200ms ease-out;
}
.nothing-jury .n-textarea:focus { border-color: var(--n-text-secondary); }
.nothing-jury .n-textarea::placeholder { color: var(--n-text-disabled); }
`;

// ─── Navigation Config ─────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const juryNavItems: NavItem[] = [
  { href: "/jury", label: "ACCUEIL", icon: Home },
  { href: "/jury/assignments", label: "NOTER", icon: ClipboardList },
  { href: "/jury/results", label: "RESULTATS", icon: Trophy },
  { href: "/jury/profile", label: "PROFIL", icon: User },
];

// ─── Sidebar ────────────────────────────────────────────────────────────────

function NothingSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const organization = useOrganization();
  const theme = usePortalTheme();
  const { data: session } = authClient.useSession();
  const { data: rolesData } = api.user.getMyRoles.useQuery(undefined, {
    enabled: !!session?.user,
    staleTime: 30000,
  });
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: { onSuccess: () => router.push("/login") },
    });
  };

  const isActive = (href: string) => {
    if (href === "/jury") {
      return pathname === "/jury" || pathname === "/jury/dashboard";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  // Dashboard switch links
  const dashboardLinks: Array<{ href: string; label: string; icon: LucideIcon; isExternal?: boolean }> = [];
  if (rolesData?.roles) {
    const { roles } = rolesData;
    if (roles.organizer) {
      dashboardLinks.push({
        href: roles.organizer.href ?? "/dashboard",
        label: "ORGANISATEUR",
        icon: Building2,
      });
    }
    if (roles.producer) {
      dashboardLinks.push({ href: "/producer/dashboard", label: "PRODUCTEUR", icon: Package });
    }
  }

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 border-r transition-all duration-200",
        isCollapsed ? "w-[72px]" : "w-64"
      )}
      style={{
        backgroundColor: "var(--n-black)",
        borderColor: "var(--n-border)",
      }}
    >
      {/* Header */}
      <div
        className={cn(
          "flex items-center gap-3 p-4 border-b",
          isCollapsed && "justify-center"
        )}
        style={{ borderColor: "var(--n-border)" }}
      >
        {theme.logoUrl ? (
          <img
            src={theme.logoUrl}
            alt={organization.name}
            className="h-10 w-10 rounded-lg object-contain p-1"
            style={{ backgroundColor: "var(--n-surface)" }}
          />
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: "var(--n-surface)" }}
          >
            <Scale className="h-5 w-5" style={{ color: "var(--n-text-secondary)" }} />
          </div>
        )}
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <p
              className="n-font-data text-xs uppercase tracking-[0.08em] font-bold truncate"
              style={{ color: "var(--n-text-display)" }}
            >
              ESPACE JURY
            </p>
            <p
              className="text-xs truncate mt-0.5"
              style={{ color: "var(--n-text-disabled)" }}
            >
              {organization.name}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {!isCollapsed && (
          <p className="n-label px-3 mb-3" style={{ color: "var(--n-text-disabled)" }}>
            NAVIGATION
          </p>
        )}
        {juryNavItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-none text-sm transition-all duration-200 relative",
                isCollapsed && "justify-center px-2"
              )}
              style={{
                color: active ? "var(--n-text-display)" : "var(--n-text-disabled)",
                fontFamily: "'Space Mono', monospace",
                fontSize: "12px",
                letterSpacing: "0.06em",
              }}
              title={isCollapsed ? item.label : undefined}
            >
              {active && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5"
                  style={{ backgroundColor: "var(--n-text-display)" }}
                />
              )}
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Dashboard switch */}
      {!isCollapsed && dashboardLinks.length > 0 && (
        <div className="px-3 pb-2 space-y-1 border-t" style={{ borderColor: "var(--n-border)" }}>
          <p className="n-label px-3 pt-3 pb-1" style={{ color: "var(--n-text-disabled)" }}>
            MES ESPACES
          </p>
          {dashboardLinks.map((link) => {
            const LinkIcon = link.icon;
            const Comp = link.isExternal ? "a" : Link;
            return (
              <Comp
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 px-3 py-1.5 text-xs transition-colors duration-200"
                style={{
                  color: "var(--n-text-disabled)",
                  fontFamily: "'Space Mono', monospace",
                  letterSpacing: "0.06em",
                }}
              >
                <LinkIcon className="h-4 w-4" strokeWidth={1.5} />
                <span>{link.label}</span>
              </Comp>
            );
          })}
        </div>
      )}

      {/* User section */}
      {session?.user && (
        <div className="border-t p-3" style={{ borderColor: "var(--n-border)" }}>
          {!isCollapsed ? (
            <div className="flex items-center gap-3 px-2">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full shrink-0 n-font-data text-xs font-bold"
                style={{
                  backgroundColor: "var(--n-surface-raised)",
                  color: "var(--n-text-secondary)",
                }}
              >
                {session.user.name
                  ? session.user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                  : "??"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: "var(--n-text-primary)" }}>
                  {session.user.name ?? "Utilisateur"}
                </p>
                <p className="text-[10px] truncate" style={{ color: "var(--n-text-disabled)" }}>
                  {session.user.email}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 transition-colors duration-200"
                style={{ color: "var(--n-text-disabled)" }}
                title="Deconnexion"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex justify-center p-2 transition-colors duration-200"
              style={{ color: "var(--n-text-disabled)" }}
              title="Deconnexion"
            >
              <LogOut className="h-5 w-5" strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}

      {/* Collapse toggle */}
      <div className="hidden lg:block border-t p-2" style={{ borderColor: "var(--n-border)" }}>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center gap-2 p-2 text-xs transition-colors duration-200"
          style={{
            color: "var(--n-text-disabled)",
            fontFamily: "'Space Mono', monospace",
            letterSpacing: "0.06em",
          }}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <>
              <ChevronLeft className="h-4 w-4" strokeWidth={1.5} />
              <span className="uppercase">REDUIRE</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}

// ─── Bottom Navigation (Mobile) ─────────────────────────────────────────────

function NothingBottomNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/jury") {
      return pathname === "/jury" || pathname === "/jury/dashboard";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t safe-area-bottom"
      style={{
        backgroundColor: "var(--n-black)",
        borderColor: "var(--n-border)",
      }}
    >
      <div className="flex items-center justify-around px-2 py-1">
        {juryNavItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center min-w-[64px] py-2 px-3"
            >
              <div className="relative flex items-center justify-center w-10 h-7">
                <Icon
                  className="h-5 w-5"
                  strokeWidth={active ? 2 : 1.5}
                  style={{
                    color: active ? "var(--n-text-display)" : "var(--n-text-disabled)",
                  }}
                />
                {active && (
                  <div
                    className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ backgroundColor: "var(--n-text-display)" }}
                  />
                )}
              </div>
              <span
                className="mt-0.5 truncate max-w-[64px]"
                style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: "9px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  color: active ? "var(--n-text-display)" : "var(--n-text-disabled)",
                }}
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

// ─── Main Layout ────────────────────────────────────────────────────────────

interface NothingJuryLayoutProps {
  children: React.ReactNode;
}

export function NothingJuryLayout({ children }: NothingJuryLayoutProps) {
  return (
    <PWAWrapper portal="jury">
      <style dangerouslySetInnerHTML={{ __html: nothingCss }} />
      <div className="nothing-jury min-h-screen">
        <NothingSidebar />
        <div className="lg:pl-64 transition-all duration-200">
          <main className="min-h-screen">
            <div className="container mx-auto px-4 lg:px-8 py-8 pb-24 lg:pb-8">
              {children}
            </div>
          </main>
        </div>
        <NothingBottomNav />
      </div>
    </PWAWrapper>
  );
}
