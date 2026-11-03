import { redirect } from "next/navigation";

/**
 * /jury/profile now redirects to the unified edit page.
 * The edit page is permanently visible (no separate read-only mode).
 */
export default function JuryProfilePage() {
  redirect("/jury/profile/edit");
}
