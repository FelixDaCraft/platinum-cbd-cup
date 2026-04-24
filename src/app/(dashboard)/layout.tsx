"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { useSession } from "~/lib/auth-client";
import { api } from "~/trpc/react";
import { NothingOrganizerLayout } from "~/components/dashboard/nothing-organizer-layout";

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

  // Check whether the signed-in user has organizer access.
  const { data: accessData, isLoading: isAccessLoading } = api.portal.validateUserAccess.useQuery(
    undefined,
    {
      enabled: !!session?.user,
      staleTime: 60000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    }
  );

  const isSessionDetermined = !isSessionLoading && session !== undefined;
  const isLoading = !isSessionDetermined || (!!session?.user && isAccessLoading);
  const isOrganizer = accessData?.role === "organizer";

  useEffect(() => {
    if (!isSessionDetermined) return;

    if (!session?.user) {
      router.push("/login");
      return;
    }

    if (!isAccessLoading && accessData && !isOrganizer) {
      if (!hasShownToast.current) {
        toast.error("Vous n'avez pas acces a l'espace organisateur");
        hasShownToast.current = true;
      }
      if (accessData.role === "producer") {
        router.push("/producer");
      } else if (accessData.role === "jury") {
        router.push("/jury");
      } else {
        router.push("/login");
      }
    }
  }, [session, isSessionDetermined, accessData, isAccessLoading, isOrganizer, router]);

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
