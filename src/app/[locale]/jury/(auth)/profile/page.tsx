import { localizedRedirect } from "~/i18n/server";

/**
 * /jury/profile now redirects to the unified edit page.
 * The edit page is permanently visible (no separate read-only mode).
 */
export default async function JuryProfilePage() {
  return localizedRedirect("/jury/profile/edit");
}
