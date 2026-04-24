"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, Suspense } from "react";

function RedirectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const code = searchParams.get("code") ?? "";

  useEffect(() => {
    // Redirect old /jury/activate?code=XXX to public /activate?code=XXX
    router.replace(code ? `/activate?code=${code}` : "/activate");
  }, [code, router]);

  return null;
}

export default function JuryActivateRedirect() {
  return (
    <Suspense fallback={null}>
      <RedirectContent />
    </Suspense>
  );
}
