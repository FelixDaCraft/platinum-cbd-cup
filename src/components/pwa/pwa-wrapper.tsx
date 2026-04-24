"use client";

import { useContext } from "react";
import { PortalContext } from "~/lib/portal/context";
import { PWAProvider } from "./pwa-provider";

type PortalType = "producer" | "jury" | "organizer" | "admin";

interface PWAWrapperProps {
  portal: PortalType;
  children: React.ReactNode;
}

/**
 * PWA Wrapper Component
 * Wraps PWAProvider and automatically gets theme data from portal context
 * Gracefully handles cases where portal context is not available (e.g., admin on main domain)
 */
export function PWAWrapper({ portal, children }: PWAWrapperProps) {
  const portalContext = useContext(PortalContext);

  // Use theme from context if available, otherwise undefined (PWAProvider will use defaults)
  const themeColor = portalContext?.theme.primaryColor;
  const logoUrl = portalContext?.theme.logoUrl;

  return (
    <PWAProvider
      portal={portal}
      themeColor={themeColor}
      logoUrl={logoUrl}
    >
      {children}
    </PWAProvider>
  );
}
