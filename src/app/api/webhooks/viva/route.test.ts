import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetTransaction, mockGetWebhookVerificationKey, mockConfirm } =
  vi.hoisted(() => ({
    mockGetTransaction: vi.fn(),
    mockGetWebhookVerificationKey: vi.fn(),
    mockConfirm: vi.fn(),
  }));

vi.mock("~/lib/viva", () => ({
  getTransaction: mockGetTransaction,
  getWebhookVerificationKey: mockGetWebhookVerificationKey,
}));

// La vraie classe d'erreur est conservée : la route la teste par `instanceof`.
vi.mock("~/server/services/registration-payment.service", async () => {
  class PaymentVerificationError extends Error {
    constructor(
      readonly reason: string,
      message: string
    ) {
      super(message);
      this.name = "PaymentVerificationError";
    }
  }
  return { confirmPaidRegistration: mockConfirm, PaymentVerificationError };
});

import { GET, POST } from "./route";
import { PaymentVerificationError } from "~/server/services/registration-payment.service";

/** Chaque test part d'une IP distincte : le rate limit est un état de module. */
function webhookRequest(body: unknown, ip: string) {
  return new Request("https://example.test/api/webhooks/viva", {
    method: "POST",
    headers: { "content-type": "application/json", "cf-connecting-ip": ip },
    body: JSON.stringify(body),
  });
}

/** Le GET est lui aussi limité par IP : même précaution. */
function verificationRequest(ip: string) {
  return new Request("https://example.test/api/webhooks/viva", {
    method: "GET",
    headers: { "cf-connecting-ip": ip },
  });
}

const settledTransaction = {
  transactionId: "trx_1",
  orderCode: "1234567890",
  statusId: "F",
  amount: 180,
  merchantTrns: "reg_1",
  email: "producteur@example.eu",
};

describe("Viva webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfirm.mockResolvedValue({ status: "confirmed", invoiceNumber: "INV-2026-00001" });
  });

  it("renvoie la clé de vérification sur GET, puis la sert depuis le cache", async () => {
    mockGetWebhookVerificationKey.mockResolvedValue("cle-viva");

    const response = await GET(verificationRequest("10.0.9.1"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ Key: "cle-viva" });
    expect(mockGetWebhookVerificationKey).toHaveBeenCalledTimes(1);

    // Deuxième appel : la clé vient du cache, aucun appel sortant vers Viva.
    // C'est ce qui ferme l'amplification par le verbe le plus facile à trouver.
    const cached = await GET(verificationRequest("10.0.9.2"));

    expect(cached.status).toBe(200);
    await expect(cached.json()).resolves.toEqual({ Key: "cle-viva" });
    expect(mockGetWebhookVerificationKey).toHaveBeenCalledTimes(1);
  });

  it("ignore un type d'événement non géré sans appeler Viva", async () => {
    const response = await POST(
      webhookRequest({ EventTypeId: 1797, EventData: { TransactionId: "trx_1" } }, "10.0.0.1")
    );

    expect(response.status).toBe(200);
    expect(mockGetTransaction).not.toHaveBeenCalled();
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("rejette un événement de paiement sans TransactionId", async () => {
    const response = await POST(
      webhookRequest({ EventTypeId: 1796, EventData: {} }, "10.0.0.2")
    );

    expect(response.status).toBe(400);
    expect(mockGetTransaction).not.toHaveBeenCalled();
  });

  it("ne confirme rien tant que la transaction n'est pas réglée", async () => {
    mockGetTransaction.mockResolvedValue({ ...settledTransaction, statusId: "A" });

    const response = await POST(
      webhookRequest({ EventTypeId: 1796, EventData: { TransactionId: "trx_1" } }, "10.0.0.3")
    );

    expect(response.status).toBe(200);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("transmet le montant relu chez Viva à la confirmation", async () => {
    mockGetTransaction.mockResolvedValue(settledTransaction);

    const response = await POST(
      webhookRequest({ EventTypeId: 1796, EventData: { TransactionId: "trx_1" } }, "10.0.0.4")
    );

    expect(response.status).toBe(200);
    expect(mockConfirm).toHaveBeenCalledWith({
      registrationId: "reg_1",
      transactionId: "trx_1",
      orderCode: "1234567890",
      amount: 180,
    });
  });

  it("ne se fie pas au corps du webhook pour le montant", async () => {
    mockGetTransaction.mockResolvedValue(settledTransaction);

    await POST(
      webhookRequest(
        { EventTypeId: 1796, EventData: { TransactionId: "trx_1", Amount: 1 } },
        "10.0.0.5"
      )
    );

    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 180 })
    );
  });

  it("refuse sans redélivrance quand le paiement ne correspond pas", async () => {
    mockGetTransaction.mockResolvedValue(settledTransaction);
    mockConfirm.mockRejectedValue(
      new PaymentVerificationError("amount_mismatch", "montant incoherent")
    );

    const response = await POST(
      webhookRequest({ EventTypeId: 1796, EventData: { TransactionId: "trx_1" } }, "10.0.0.6")
    );

    // 200 : réessayer ne corrigerait rien, Viva doit arrêter de redélivrer.
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ received: true, matched: false });
  });

  it("répond 500 sur une panne technique pour que Viva réessaie", async () => {
    mockGetTransaction.mockRejectedValue(new Error("Viva injoignable"));

    const response = await POST(
      webhookRequest({ EventTypeId: 1796, EventData: { TransactionId: "trx_1" } }, "10.0.0.7")
    );

    expect(response.status).toBe(500);
  });

  it("limite le débit par IP pour ne pas amplifier vers l'API Viva", async () => {
    mockGetTransaction.mockResolvedValue(settledTransaction);

    const body = { EventTypeId: 1796, EventData: { TransactionId: "trx_1" } };
    const statuses: number[] = [];
    for (let i = 0; i < 35; i++) {
      const response = await POST(webhookRequest(body, "10.0.0.8"));
      statuses.push(response.status);
    }

    expect(statuses).toContain(429);
    // L'API Viva n'est pas appelée pour les requêtes rejetées.
    expect(mockGetTransaction.mock.calls.length).toBeLessThan(35);
  });
});
