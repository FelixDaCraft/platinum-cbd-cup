"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  Trophy,
  TrendingUp,
  Award,
  Building2,
  Code,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Package,
  Scale,
  type LucideIcon,
} from "lucide-react";

import { cn } from "~/lib/utils";
import { useOrganization, usePortalTheme } from "~/lib/portal/context";
import { authClient } from "~/lib/auth-client";
import { api } from "~/trpc/react";
import { PWAWrapper } from "~/components/pwa/pwa-wrapper";

// ─── Nothing CSS ────────────────────────────────────────────────────────────

const nothingCss = `
@import url('https://fonts.googleapis.com/css2?family=Doto:wght@400;700&family=Space+Grotesk:wght@300;400;500;700&family=Space+Mono:wght@400;700&display=swap');

.nothing-producer {
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

  --portal-background: 0 0% 0%;
  --portal-foreground: 0 0% 91%;
  --portal-card: 0 0% 6.7%;
  --portal-border: 0 0% 13.3%;
  --portal-muted: 0 0% 10.2%;
  --portal-muted-foreground: 0 0% 60%;
  --portal-primary: 0 0% 100%;
  --portal-secondary: 0 0% 20%;
}

.nothing-producer .n-font-display { font-family: "Doto", "Space Mono", monospace; }
.nothing-producer .n-font-body { font-family: "Space Grotesk", system-ui, sans-serif; }
.nothing-producer .n-font-data { font-family: "Space Mono", monospace; }
.nothing-producer .n-label {
  font-family: "Space Mono", monospace; font-size: 11px; line-height: 1.2;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--n-text-secondary);
}

.nothing-producer .n-card { background: var(--n-surface); border: 1px solid var(--n-border); border-radius: 12px; padding: 24px; }
.nothing-producer .n-progress-bar { display: flex; gap: 2px; width: 100%; }
.nothing-producer .n-progress-segment { flex: 1; height: 8px; background: var(--n-border); }
.nothing-producer .n-progress-segment.filled { background: var(--n-text-display); }
.nothing-producer .n-progress-segment.filled.success { background: var(--n-success); }

.nothing-producer .n-tag {
  display: inline-flex; align-items: center;
  font-family: "Space Mono", monospace; font-size: 11px;
  text-transform: uppercase; letter-spacing: 0.06em;
  padding: 4px 12px; border-radius: 999px;
  border: 1px solid var(--n-border-visible); color: var(--n-text-secondary);
}
.nothing-producer .n-tag.active { border-color: var(--n-text-display); color: var(--n-text-display); }
.nothing-producer .n-tag.success { border-color: var(--n-success); color: var(--n-success); }

.nothing-producer .n-btn-primary {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: "Space Mono", monospace; font-size: 13px;
  text-transform: uppercase; letter-spacing: 0.06em;
  padding: 12px 24px; min-height: 44px; border-radius: 999px;
  background: var(--n-text-display); color: var(--n-black);
  border: none; cursor: pointer; transition: opacity 200ms ease-out;
}
.nothing-producer .n-btn-primary:hover { opacity: 0.85; }
.nothing-producer .n-btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

.nothing-producer .n-btn-secondary {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: "Space Mono", monospace; font-size: 13px;
  text-transform: uppercase; letter-spacing: 0.06em;
  padding: 12px 24px; min-height: 44px; border-radius: 999px;
  background: transparent; color: var(--n-text-primary);
  border: 1px solid var(--n-border-visible); cursor: pointer;
  transition: border-color 200ms ease-out;
}
.nothing-producer .n-btn-secondary:hover { border-color: var(--n-text-primary); color: var(--n-text-display); }

.nothing-producer .n-btn-ghost {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: "Space Mono", monospace; font-size: 13px;
  text-transform: uppercase; letter-spacing: 0.06em;
  padding: 8px 16px; min-height: 44px; border-radius: 0;
  background: transparent; color: var(--n-text-secondary);
  border: none; cursor: pointer; transition: color 200ms ease-out;
}
.nothing-producer .n-btn-ghost:hover { color: var(--n-text-display); }

.nothing-producer .n-btn-destructive {
  display: inline-flex; align-items: center; justify-content: center;
  font-family: "Space Mono", monospace; font-size: 13px;
  text-transform: uppercase; letter-spacing: 0.06em;
  padding: 12px 24px; min-height: 44px; border-radius: 999px;
  background: transparent; color: var(--n-accent);
  border: 1px solid var(--n-accent); cursor: pointer; transition: opacity 200ms ease-out;
}
.nothing-producer .n-btn-destructive:hover { opacity: 0.85; }

.nothing-producer ::-webkit-scrollbar { width: 4px; }
.nothing-producer ::-webkit-scrollbar-track { background: transparent; }
.nothing-producer ::-webkit-scrollbar-thumb { background: var(--n-border-visible); border-radius: 2px; }
`;

// ─── Navigation ─────────────────────────────────────────────────────────────

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const producerNavItems: NavItem[] = [
  { href: "/producer", label: "ACCUEIL", icon: Home },
  { href: "/producer/registrations", label: "INSCRIPTIONS", icon: Trophy },
  { href: "/producer/results", label: "RESULTATS", icon: TrendingUp },
  { href: "/producer/labels", label: "DISTINCTIONS", icon: Award },
  { href: "/producer/widget", label: "WIDGET", icon: Code },
  { href: "/producer/profile", label: "PROFIL", icon: Building2 },
];

// ─── Sidebar ────────────────────────────────────────────────────────────────

function NothingProdSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const organization = useOrganization();
  const theme = usePortalTheme();
  const { data: session } = authClient.useSession();
  const { data: rolesData } = api.user.getMyRoles.useQuery(undefined, { enabled: !!session?.user, staleTime: 30000 });
  const [isCollapsed, setIsCollapsed] = React.useState(false);

  const handleLogout = async () => {
    await authClient.signOut({ fetchOptions: { onSuccess: () => router.push("/login") } });
  };

  const isActive = (href: string) => {
    if (href === "/producer") return pathname === "/producer" || pathname === "/producer/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const dashboardLinks: Array<{ href: string; label: string; icon: LucideIcon; isExternal?: boolean }> = [];
  if (rolesData?.roles) {
    const { roles } = rolesData;
    if (roles.organizer) {
      dashboardLinks.push({ href: roles.organizer.href ?? "/dashboard", label: "ORGANISATEUR", icon: Building2 });
    }
    if (roles.jury) dashboardLinks.push({ href: "/jury/dashboard", label: "JURY", icon: Scale });
  }

  return (
    <aside
      className={cn("hidden lg:flex flex-col fixed inset-y-0 left-0 z-30 border-r transition-all duration-200", isCollapsed ? "w-[72px]" : "w-64")}
      style={{ backgroundColor: "var(--n-black)", borderColor: "var(--n-border)" }}
    >
      {/* Header */}
      <div className={cn("flex items-center gap-3 p-4 border-b", isCollapsed && "justify-center")} style={{ borderColor: "var(--n-border)" }}>
        {theme.logoUrl ? (
          <img src={theme.logoUrl} alt={organization.name} className="h-10 w-10 rounded-lg object-contain p-1" style={{ backgroundColor: "var(--n-surface)" }} />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: "var(--n-surface)" }}>
            <Package className="h-5 w-5" style={{ color: "var(--n-text-secondary)" }} strokeWidth={1.5} />
          </div>
        )}
        {!isCollapsed && (
          <div className="flex-1 min-w-0">
            <p className="n-font-data text-xs uppercase tracking-[0.08em] font-bold truncate" style={{ color: "var(--n-text-display)" }}>ESPACE PRODUCTEUR</p>
            <p className="text-xs truncate mt-0.5" style={{ color: "var(--n-text-disabled)" }}>{organization.name}</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {!isCollapsed && <p className="n-label px-3 mb-3" style={{ color: "var(--n-text-disabled)" }}>NAVIGATION</p>}
        {producerNavItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href} href={item.href}
              className={cn("flex items-center gap-3 px-3 py-2.5 rounded-none text-sm transition-all duration-200 relative", isCollapsed && "justify-center px-2")}
              style={{ color: active ? "var(--n-text-display)" : "var(--n-text-disabled)", fontFamily: "'Space Mono', monospace", fontSize: "12px", letterSpacing: "0.06em" }}
              title={isCollapsed ? item.label : undefined}
            >
              {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5" style={{ backgroundColor: "var(--n-text-display)" }} />}
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Dashboard switch */}
      {!isCollapsed && dashboardLinks.length > 0 && (
        <div className="px-3 pb-2 space-y-1 border-t" style={{ borderColor: "var(--n-border)" }}>
          <p className="n-label px-3 pt-3 pb-1" style={{ color: "var(--n-text-disabled)" }}>MES ESPACES</p>
          {dashboardLinks.map((link) => {
            const LIcon = link.icon;
            const Comp = link.isExternal ? "a" : Link;
            return (
              <Comp key={link.href} href={link.href} className="flex items-center gap-2 px-3 py-1.5 text-xs transition-colors duration-200"
                style={{ color: "var(--n-text-disabled)", fontFamily: "'Space Mono', monospace", letterSpacing: "0.06em" }}>
                <LIcon className="h-4 w-4" strokeWidth={1.5} /><span>{link.label}</span>
              </Comp>
            );
          })}
        </div>
      )}

      {/* User */}
      {session?.user && (
        <div className="border-t p-3" style={{ borderColor: "var(--n-border)" }}>
          {!isCollapsed ? (
            <div className="flex items-center gap-3 px-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full shrink-0 n-font-data text-xs font-bold"
                style={{ backgroundColor: "var(--n-surface-raised)", color: "var(--n-text-secondary)" }}>
                {session.user.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) ?? "??"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: "var(--n-text-primary)" }}>{session.user.name ?? "Utilisateur"}</p>
                <p className="text-[10px] truncate" style={{ color: "var(--n-text-disabled)" }}>{session.user.email}</p>
              </div>
              <button onClick={handleLogout} className="p-2" style={{ color: "var(--n-text-disabled)" }} title="Deconnexion">
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <button onClick={handleLogout} className="w-full flex justify-center p-2" style={{ color: "var(--n-text-disabled)" }}>
              <LogOut className="h-5 w-5" strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}

      {/* Collapse */}
      <div className="hidden lg:block border-t p-2" style={{ borderColor: "var(--n-border)" }}>
        <button onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center gap-2 p-2 text-xs transition-colors"
          style={{ color: "var(--n-text-disabled)", fontFamily: "'Space Mono', monospace", letterSpacing: "0.06em" }}>
          {isCollapsed ? <ChevronRight className="h-4 w-4" strokeWidth={1.5} /> : <><ChevronLeft className="h-4 w-4" strokeWidth={1.5} /><span className="uppercase">REDUIRE</span></>}
        </button>
      </div>
    </aside>
  );
}

// ─── Bottom Nav ─────────────────────────────────────────────────────────────

function NothingProdBottomNav() {
  const pathname = usePathname();
  const items: NavItem[] = [
    { href: "/producer", label: "ACCUEIL", icon: Home },
    { href: "/producer/registrations", label: "INSCRIPTIONS", icon: Trophy },
    { href: "/producer/results", label: "RESULTATS", icon: TrendingUp },
    { href: "/producer/labels", label: "DISTINCTIONS", icon: Award },
    { href: "/producer/profile", label: "PROFIL", icon: Building2 },
  ];

  const isActive = (href: string) => {
    if (href === "/producer") return pathname === "/producer" || pathname === "/producer/dashboard";
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t safe-area-bottom"
      style={{ backgroundColor: "var(--n-black)", borderColor: "var(--n-border)" }}>
      <div className="flex items-center justify-around px-2 py-1">
        {items.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex flex-col items-center justify-center min-w-[64px] py-2 px-3">
              <div className="relative flex items-center justify-center w-10 h-7">
                <Icon className="h-5 w-5" strokeWidth={active ? 2 : 1.5} style={{ color: active ? "var(--n-text-display)" : "var(--n-text-disabled)" }} />
                {active && <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ backgroundColor: "var(--n-text-display)" }} />}
              </div>
              <span className="mt-0.5 truncate max-w-[64px]"
                style={{ fontFamily: "'Space Mono', monospace", fontSize: "9px", letterSpacing: "0.08em", textTransform: "uppercase", color: active ? "var(--n-text-display)" : "var(--n-text-disabled)" }}>
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

export function NothingProducerLayout({ children }: { children: React.ReactNode }) {
  return (
    <PWAWrapper portal="producer">
      <style dangerouslySetInnerHTML={{ __html: nothingCss }} />
      <div className="nothing-producer min-h-screen">
        <NothingProdSidebar />
        <div className="lg:pl-64 transition-all duration-200">
          <main className="min-h-screen">
            <div className="container mx-auto px-4 lg:px-8 py-8 pb-24 lg:pb-8">
              {children}
            </div>
          </main>
        </div>
        <NothingProdBottomNav />
      </div>
    </PWAWrapper>
  );
}
