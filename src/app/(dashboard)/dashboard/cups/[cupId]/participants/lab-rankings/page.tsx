import { redirect } from "next/navigation";

/**
 * Ancienne adresse du classement terpènes, rangé désormais dans « Résultats » :
 * redirection pour les liens et favoris existants.
 */
export default async function LegacyLabRankingsPage({
  params,
}: {
  params: Promise<{ cupId: string }>;
}) {
  const { cupId } = await params;
  redirect(`/dashboard/cups/${cupId}/results/lab-rankings`);
}
