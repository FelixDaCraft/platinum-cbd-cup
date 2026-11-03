import { localizedRedirect } from "~/i18n/server";

/**
 * Jury root page - redirects to dashboard
 */
export default async function JuryPage() {
  return localizedRedirect("/jury/dashboard");
}
