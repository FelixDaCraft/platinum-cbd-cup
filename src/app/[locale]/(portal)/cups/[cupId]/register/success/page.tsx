import { PaymentSuccess } from "../../../../_components/payment-success";

/** Ancienne URL de retour Viva, conservée pour les sources déjà configurées. */
export default async function Page({
  params,
}: {
  params: Promise<{ cupId: string }>;
}) {
  const { cupId } = await params;
  return <PaymentSuccess cupId={cupId} />;
}
