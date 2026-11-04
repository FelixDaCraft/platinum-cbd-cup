/**
 * Réception des échantillons : changement de statut d'un produit, partagé par
 * la réception produit par produit (`product.updateStatus`) et la réception
 * d'un colis entier depuis le panneau d'une inscription.
 */

import { nanoid } from "nanoid";
import { and, eq, inArray, notExists, sql } from "drizzle-orm";

import { activityLogs, productRatings, products } from "~/server/db/schema";
import type { ProductStatus } from "~/server/db/schema/products";

/** Colonnes à écrire pour passer un produit à `status` ; « reçu » date la réception. */
export function productStatusChange(status: ProductStatus, now: Date = new Date()) {
  return status === "received"
    ? { status, updatedAt: now, receivedAt: now }
    : { status, updatedAt: now };
}

/**
 * Produits encore « à envoyer » des inscriptions d'un colis (une seule, ou
 * toutes celles d'un colis commun) : ceux que sa réception fait passer « reçus ».
 */
export function parcelReceivableWhere(registrationIds: string[]) {
  return and(inArray(products.registrationId, registrationIds), eq(products.status, "pending"));
}

/**
 * Produits dont on peut annuler la réception : « reçus », et sans aucune note
 * de juré. Un produit en notation (ou noté) n'est jamais remis « à envoyer ».
 */
export function parcelCancellableWhere(registrationId: string) {
  return and(
    eq(products.registrationId, registrationId),
    eq(products.status, "received"),
    notExists(
      sql`(select 1 from ${productRatings} where ${productRatings.productId} = ${products.id})`
    )
  );
}

interface ReceiptLogInput {
  userId: string | null;
  product: { id: string; name: string };
  registration: {
    id: string;
    cupId: string;
    producerId: string;
    producer: { brandName: string };
    cup: { name: string };
  };
  via: "product" | "parcel";
}

/**
 * Ligne `activity_logs` d'un produit marqué reçu. Écrite dans la transaction
 * de la réception groupée, et par `product.updateStatus`.
 */
export function productReceivedLog({ userId, product, registration, via }: ReceiptLogInput) {
  return {
    id: nanoid(),
    userId,
    action: "product_received" as const,
    description: `Produit reçu : ${product.name} — ${registration.producer.brandName} (${registration.cup.name})`,
    metadata: JSON.stringify({
      productId: product.id,
      registrationId: registration.id,
      cupId: registration.cupId,
      producerId: registration.producerId,
      via,
    }),
  } satisfies typeof activityLogs.$inferInsert;
}

/** Ligne `activity_logs` d'une réception annulée (produit remis « à envoyer »). */
export function receiptCancelledLog({ userId, product, registration }: Omit<ReceiptLogInput, "via">) {
  return {
    id: nanoid(),
    userId,
    action: "other" as const,
    description: `Réception annulée : ${product.name} — ${registration.producer.brandName} (${registration.cup.name})`,
    metadata: JSON.stringify({
      kind: "parcel_receipt_cancelled",
      productId: product.id,
      registrationId: registration.id,
      cupId: registration.cupId,
      producerId: registration.producerId,
    }),
  } satisfies typeof activityLogs.$inferInsert;
}
