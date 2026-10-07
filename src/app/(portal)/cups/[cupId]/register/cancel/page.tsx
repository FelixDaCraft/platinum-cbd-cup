import { PaymentCancel } from "../../../../_components/payment-cancel";

/** Ancienne URL d'échec Viva, conservée pour les sources déjà configurées. */
export default async function Page({
  params,
}: {
  params: Promise<{ cupId: string }>;
}) {
  const { cupId } = await params;
  return <PaymentCancel cupId={cupId} />;
}
