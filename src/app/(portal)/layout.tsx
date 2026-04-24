import type { ReactNode } from "react";
import { PlatinumShell } from "~/components/portal/platinum";

/**
 * Public portal layout — wraps every public-facing page in the Platinum
 * design shell (sticky topbar + page container + footer).
 *
 * Auth pages (login/register/etc.) live as siblings inside this same layout
 * so they get the topbar/footer and just center their card content.
 */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return <PlatinumShell>{children}</PlatinumShell>;
}
