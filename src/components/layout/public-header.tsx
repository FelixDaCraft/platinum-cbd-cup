"use client";

import Link from "next/link";
import { Loader2 } from "lucide-react";

import { useSession } from "~/lib/auth-client";
import { UserMenu } from "./user-menu";

export function PublicHeader() {
  const { data: session, isPending } = useSession();

  return (
    <header className="sticky top-0 z-50 glass border-b">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="text-lg font-semibold text-primary">
          CupMetrics
        </Link>
        <nav className="flex items-center gap-4">
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : session?.user ? (
            <UserMenu />
          ) : (
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Connexion
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
