"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { useSession } from "~/lib/auth-client";
import { UserMenu } from "~/components/layout/user-menu";

export default function RateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending: isSessionLoading } = useSession();

  useEffect(() => {
    if (!isSessionLoading && !session?.user) {
      router.push("/login?callbackUrl=/jury");
    }
  }, [session, isSessionLoading, router]);

  if (isSessionLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--n-black)",
        }}
      >
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "12px",
            color: "var(--n-text-secondary)",
            letterSpacing: "0.1em",
          }}
        >
          [LOADING...]
        </span>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--n-black)",
        }}
      >
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: "12px",
            color: "var(--n-text-secondary)",
            letterSpacing: "0.1em",
          }}
        >
          [LOADING...]
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "var(--n-black)" }}>
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "var(--n-black)",
          borderBottom: "1px solid var(--n-border)",
          height: "48px",
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flex: 1,
          }}
        >
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "12px",
              fontWeight: 400,
              color: "var(--n-text-secondary)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            PLATINUM CBD CUP
          </span>
          <span
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "12px",
              fontWeight: 700,
              color: "var(--n-text-display)",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            JURY
          </span>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <Link
            href="/jury"
            className="n-btn-ghost"
            style={{
              fontFamily: "'Space Mono', monospace",
              fontSize: "11px",
              letterSpacing: "0.1em",
              textDecoration: "none",
              padding: "4px 8px",
            }}
          >
            &lt; ACCUEIL
          </Link>
          <UserMenu />
        </nav>
      </header>

      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}
