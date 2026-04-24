"use client";

import { PortalContext, type PortalContextValue } from "./context";

interface PortalProviderProps {
  value: PortalContextValue;
  children: React.ReactNode;
}

/**
 * Client component wrapper for PortalContext.Provider
 * This is necessary because the layout is a Server Component
 * but Context.Provider must be used in a Client Component
 */
export function PortalProvider({ value, children }: PortalProviderProps) {
  return (
    <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
  );
}
