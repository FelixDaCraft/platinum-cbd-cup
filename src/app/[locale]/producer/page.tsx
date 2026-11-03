import { localizedRedirect } from "~/i18n/server";

/**
 * Producer root page - redirects to dashboard
 */
export default async function ProducerPage() {
  await localizedRedirect("/producer/dashboard");
}
