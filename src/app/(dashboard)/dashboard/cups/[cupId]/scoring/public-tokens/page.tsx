import { redirect } from "next/navigation";

/**
 * Les jetons du jury public sont remplacés par les QR codes (codes
 * d'invitation) : l'ancienne adresse renvoie vers la page unique.
 */
export default async function PublicTokensPage({
  params,
}: {
  params: Promise<{ cupId: string }>;
}) {
  const { cupId } = await params;
  redirect(`/dashboard/cups/${cupId}/scoring/invitation-codes`);
}
