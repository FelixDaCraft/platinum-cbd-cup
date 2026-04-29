"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe media query hook.
 *
 * On the server, returns the `defaultValue` (default: false) so server-rendered
 * markup is stable. On the client, the first effect tick reads the actual
 * `window.matchMedia(query).matches` value and subscribes to changes.
 *
 * This drives the mobile/desktop split for the public portal: components that
 * gate on `isMobile = useMediaQuery("(max-width: 880px)")` will mount the
 * mobile variant only on phones, leaving the desktop tree completely untouched
 * above the breakpoint.
 */
export function useMediaQuery(query: string, defaultValue = false): boolean {
  const [matches, setMatches] = useState<boolean>(defaultValue);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    setMatches(mql.matches);

    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
