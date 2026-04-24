"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { LogOut, User, Loader2, Building2, Package, Star } from "lucide-react";
import { toast } from "sonner";

import { useSession, signOut } from "~/lib/auth-client";
import { api } from "~/trpc/react";
import { buildPortalUrl } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

interface UserMenuProps {
  settingsHref?: string;
  profileHref?: string;
  /** Hide the "Gérer mon compte" link */
  hideSettings?: boolean;
  /** Direction the dropdown should open. Use "top" when UserMenu is at the bottom of a sidebar */
  dropdownSide?: "top" | "bottom" | "left" | "right";
}

export function UserMenu({
  settingsHref = "/settings",
  profileHref,
  hideSettings = false,
  dropdownSide,
}: UserMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  // Story 1.9: Get tRPC utils for cache invalidation
  const utils = api.useUtils();

  // Story 1.11.1: Get user roles for dashboard navigation
  // Force fresh data to avoid stale cache after user switch
  const { data: rolesData } = api.user.getMyRoles.useQuery(undefined, {
    enabled: !!session?.user,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const user = session?.user;

  if (!user) {
    return null;
  }

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase() ?? "??";

  // Story 1.11.1: Build dashboard links based on roles
  const dashboardLinks: Array<{
    href: string;
    label: string;
    icon: typeof Building2;
    isActive: boolean;
    isExternal?: boolean;
  }> = [];

  if (rolesData?.roles) {
    const { roles } = rolesData;
    if (roles.organizer && roles.organizer.organizations.length > 0) {
      // Use the first organization's portal
      const org = roles.organizer.organizations[0];
      if (org?.slug) {
        const portalPath = roles.organizer.isWriter ? "/articles" : "/dashboard";
        dashboardLinks.push({
          href: buildPortalUrl(org.slug, portalPath),
          label: "Espace Organisateur",
          icon: Building2,
          isActive: false, // External link, never active on main domain
          isExternal: true,
        });
      }
    }
    if (roles.producer) {
      dashboardLinks.push({
        href: "/producer/dashboard",
        label: "Espace Producteur",
        icon: Package,
        isActive: pathname.startsWith("/producer"),
      });
    }
    if (roles.jury) {
      dashboardLinks.push({
        href: "/jury/dashboard",
        label: "Espace Jury",
        icon: Star,
        isActive: pathname.startsWith("/jury"),
      });
    }
  }

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Story 1.9: Invalidate ALL user-related caches before logout
      // This ensures next login gets fresh data and prevents stale role toasts
      // Reset the entire user router cache to be safe
      await utils.user.invalidate();

      await signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/login?logout=true");
          },
          onError: (ctx) => {
            toast.error(ctx.error.message || "Erreur lors de la déconnexion");
            setIsLoggingOut(false);
          },
        },
      });
    } catch {
      toast.error("Erreur lors de la déconnexion");
      setIsLoggingOut(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-xl glass-button border-white/10 p-0">
          <Avatar className="h-9 w-9 rounded-xl">
            <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs rounded-xl">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 glass-panel border-white/10"
        align="end"
        side={dropdownSide}
        sideOffset={dropdownSide === "top" ? 8 : 4}
        forceMount
      >
        <DropdownMenuLabel className="font-normal p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 rounded-xl">
              <AvatarImage src={user.image ?? undefined} alt={user.name ?? ""} />
              <AvatarFallback className="bg-primary/10 text-primary text-sm rounded-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col space-y-0.5 min-w-0">
              <p className="text-sm font-medium leading-none truncate">{user.name}</p>
              <p className="text-xs leading-none text-muted-foreground truncate">
                {user.email}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/5" />
        {/* Story 1.11.1: Dashboard links for multi-role users */}
        {dashboardLinks.length > 0 && (
          <>
            <DropdownMenuGroup className="p-1">
              {dashboardLinks.map((link) => (
                <DropdownMenuItem key={link.href} asChild>
                  {link.isExternal ? (
                    <a
                      href={link.href}
                      className="cursor-pointer rounded-lg hover:bg-white/5 flex items-center"
                    >
                      <link.icon className="mr-2 h-4 w-4" />
                      <span>{link.label}</span>
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className={`cursor-pointer rounded-lg ${link.isActive ? "bg-primary/10 text-primary" : "hover:bg-white/5"}`}
                    >
                      <link.icon className="mr-2 h-4 w-4" />
                      <span>{link.label}</span>
                    </Link>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-white/5" />
          </>
        )}
        <DropdownMenuGroup className="p-1">
          {profileHref && (
            <DropdownMenuItem asChild>
              <Link href={profileHref} className="cursor-pointer rounded-lg hover:bg-white/5">
                <User className="mr-2 h-4 w-4" />
                <span>Mon profil</span>
              </Link>
            </DropdownMenuItem>
          )}
          {!hideSettings && (
            <DropdownMenuItem asChild>
              <Link href={settingsHref} className="cursor-pointer rounded-lg hover:bg-white/5">
                <User className="mr-2 h-4 w-4" />
                <span>Gérer mon compte</span>
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="bg-white/5" />
        <div className="p-1">
          <DropdownMenuItem
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="cursor-pointer rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            {isLoggingOut ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogOut className="mr-2 h-4 w-4" />
            )}
            <span>Se déconnecter</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
