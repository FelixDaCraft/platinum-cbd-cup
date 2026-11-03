import { redirect } from "next/navigation";

/**
 * Jury root page - redirects to dashboard
 */
export default function JuryPage() {
  redirect("/jury/dashboard");
}
