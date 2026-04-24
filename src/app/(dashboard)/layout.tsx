"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useSession } from "~/lib/auth-client";
import { NothingOrganizerLayout } from "~/components/dashboard/nothing-organizer-layout";

type SessionUserWithRole = {
  id: string;
  role?: "organizer" | "producer" | "jury" | string;
  isAdmin?: boolean;
};

export default function PortalDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending: isSessionLoading } = useSession();
  const hasShownToast = useRef(false);
  const lastUserId = useRef<string | null>(null);

  // Reset toast flag when user changes
  if (session?.user?.id !== lastUserId.current) {
    hasShownToast.current = false;
    lastUserId.current = session?.user?.id ?? null;
  }

  const isSessionDetermined = !isSessionLoading && session !== undefined;
  const isLoading = !isSessionDetermined;
  const sessionUser = session?.user as SessionUserWithRole | undefined;
  const isOrganizer =
    sessionUser?.isAdmin === true || sessionUser?.role === "organizer";

  useEffect(() => {
    if (!isSessionDetermined) return;

    if (!sessionUser) {
      router.push("/login");
      return;
    }

    if (!isOrganizer) {
      if (!hasShownToast.current) {
        toast.error("Vous n'avez pas acces a l'espace organisateur");
        hasShownToast.current = true;
      }
      if (sessionUser.role === "producer") {
        router.push("/producer");
      } else if (sessionUser.role === "jury") {
        router.push("/jury");
      } else {
        router.push("/login");
      }
    }
  }, [sessionUser, isSessionDetermined, isOrganizer, router]);

  // Nothing-styled loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#000000" }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "13px", letterSpacing: "0.08em", color: "#666666" }}>
          [LOADING...]
        </span>
      </div>
    );
  }

  if (!session?.user || !isOrganizer) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#000000" }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: "13px", letterSpacing: "0.08em", color: "#666666" }}>
          [LOADING...]
        </span>
      </div>
    );
  }

  return (
    <NothingOrganizerLayout>
      {children}
    </NothingOrganizerLayout>
  );
}
