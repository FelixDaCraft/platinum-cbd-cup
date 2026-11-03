import { redirect } from "next/navigation";

/**
 * Producer root page - redirects to dashboard
 */
export default function ProducerPage() {
  redirect("/producer/dashboard");
}
