import { describe, it, expect, vi, beforeEach } from "vitest";

// L'URL publique est lue dans `process.env` par `~/server/services/app-url`,
// qui lève quand elle manque plutôt que de replier sur localhost.
process.env.NEXT_PUBLIC_APP_URL = "https://test.platinumcbdcup.eu";

// Mocks hoisted so they exist when the module under test is imported.
const {
  mockFindFirst,
  mockTransaction,
  mockLockedSelect,
  mockUpdate,
  mockAllocateInvoiceNumber,
  mockAnonymize,
  mockGetTransaction,
  mockSend,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockTransaction: vi.fn(),
  mockLockedSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockAllocateInvoiceNumber: vi.fn(),
  mockAnonymize: vi.fn(),
  mockGetTransaction: vi.fn(),
  mockSend: vi.fn(),
}));

vi.mock("~/server/db", () => ({
  db: {
    query: { registrations: { findFirst: mockFindFirst } },
    transaction: mockTransaction,
  },
}));

vi.mock("~/lib/viva", () => ({ getTransaction: mockGetTransaction }));

vi.mock("~/server/services/invoice.service", () => ({
  allocateInvoiceNumber: mockAllocateInvoiceNumber,
}));

vi.mock("~/server/services/anonymization.service", () => ({
  anonymizeRegistrationProducts: mockAnonymize,
}));

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mockSend };
  },
}));

vi.mock("~/env", () => ({
  env: {
    RESEND_API_KEY: "test-key",
    EMAIL_FROM: "test@platinumcbdcup.eu",
    BETTER_AUTH_URL: "http://localhost:3000",
    NODE_ENV: "test",
  },
}));

import {
  confirmPaidRegistration,
  PaymentVerificationError,
} from "./registration-payment.service";

/** Ligne d'inscription telle que la lit le SELECT ... FOR UPDATE. */
function lockedRow(overrides: Partial<{
  status: string;
  totalAmount: number;
  paymentOrderCode: string | null;
}> = {}) {
  return {
    status: "pending_payment",
    totalAmount: 18000,
    paymentOrderCode: "1234567890",
    ...overrides,
  };
}

/** Inscription complète renvoyée par la lecture hors transaction. */
function registrationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "reg_1",
    status: "pending_payment",
    totalAmount: 18000,
    currency: "EUR",
    paymentOrderCode: "1234567890",
    producer: {
      companyName: "Studio Garden",
      user: { email: "producteur@example.eu", name: "Jean Producteur" },
    },
    cup: { name: "Platinum CBD Cup 2026" },
    products: [{ id: "prod_1" }],
    ...overrides,
  };
}

function setupTransaction(row: ReturnType<typeof lockedRow> | undefined) {
  mockLockedSelect.mockReturnValue(row ? [row] : []);

  const tx = {
    select: () => ({
      from: () => ({
        where: () => ({
          for: () => Promise.resolve(mockLockedSelect()),
        }),
      }),
    }),
    update: mockUpdate,
  };

  mockTransaction.mockImplementation(
    (callback: (tx: unknown) => unknown) => callback(tx)
  );
}

describe("confirmPaidRegistration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdate.mockReturnValue({
      set: () => ({ where: () => Promise.resolve(undefined) }),
    });
    mockAllocateInvoiceNumber.mockResolvedValue("INV-2026-00001");
    mockAnonymize.mockResolvedValue([{ productId: "prod_1", anonymousCode: "CF12" }]);
    mockSend.mockResolvedValue({ error: null });
  });

  it("confirme quand le montant et l'orderCode correspondent", async () => {
    mockFindFirst.mockResolvedValue(registrationRow());
    setupTransaction(lockedRow());

    const result = await confirmPaidRegistration({
      registrationId: "reg_1",
      transactionId: "trx_1",
      orderCode: "1234567890",
      amount: 180,
    });

    expect(result).toEqual({ status: "confirmed", invoiceNumber: "INV-2026-00001" });
    expect(mockAllocateInvoiceNumber).toHaveBeenCalledTimes(1);
    expect(mockAnonymize).toHaveBeenCalledTimes(1);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it("convertit le décimal Viva en centimes", async () => {
    mockFindFirst.mockResolvedValue(registrationRow({ totalAmount: 4990 }));
    setupTransaction(lockedRow({ totalAmount: 4990 }));

    const result = await confirmPaidRegistration({
      registrationId: "reg_1",
      transactionId: "trx_1",
      orderCode: "1234567890",
      amount: 49.9,
    });

    expect(result.status).toBe("confirmed");
  });

  it("refuse un sous-paiement : produits ajoutés après la création de la commande", async () => {
    // Commande créée pour 1 produit (180 €), 10 produits au moment du paiement.
    mockFindFirst.mockResolvedValue(registrationRow({ totalAmount: 180000 }));
    setupTransaction(lockedRow({ totalAmount: 180000 }));

    await expect(
      confirmPaidRegistration({
        registrationId: "reg_1",
        transactionId: "trx_1",
        orderCode: "1234567890",
        amount: 180,
      })
    ).rejects.toMatchObject({ reason: "amount_mismatch" });

    expect(mockAllocateInvoiceNumber).not.toHaveBeenCalled();
    expect(mockAnonymize).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("refuse un paiement rattaché à une autre commande", async () => {
    mockFindFirst.mockResolvedValue(registrationRow());
    setupTransaction(lockedRow({ paymentOrderCode: "9999999999" }));

    await expect(
      confirmPaidRegistration({
        registrationId: "reg_1",
        transactionId: "trx_1",
        orderCode: "1234567890",
        amount: 180,
      })
    ).rejects.toBeInstanceOf(PaymentVerificationError);

    expect(mockAllocateInvoiceNumber).not.toHaveBeenCalled();
  });

  it("refuse une inscription sans commande de paiement enregistrée", async () => {
    mockFindFirst.mockResolvedValue(registrationRow({ paymentOrderCode: null }));
    setupTransaction(lockedRow({ paymentOrderCode: null }));

    await expect(
      confirmPaidRegistration({
        registrationId: "reg_1",
        transactionId: "trx_1",
        orderCode: "1234567890",
        amount: 180,
      })
    ).rejects.toMatchObject({ reason: "missing_order_code" });
  });

  it("relit le montant chez Viva quand l'appelant ne le fournit pas", async () => {
    mockFindFirst.mockResolvedValue(registrationRow());
    setupTransaction(lockedRow());
    mockGetTransaction.mockResolvedValue({
      transactionId: "trx_1",
      orderCode: "1234567890",
      statusId: "F",
      amount: 180,
      merchantTrns: "reg_1",
      email: null,
    });

    const result = await confirmPaidRegistration({
      registrationId: "reg_1",
      transactionId: "trx_1",
      orderCode: "1234567890",
    });

    expect(mockGetTransaction).toHaveBeenCalledWith("trx_1");
    expect(result.status).toBe("confirmed");
  });

  it("est idempotent : une redélivrance du webhook ne renumérote pas la facture", async () => {
    mockFindFirst.mockResolvedValue(registrationRow({ status: "confirmed" }));
    setupTransaction(lockedRow({ status: "confirmed" }));

    const result = await confirmPaidRegistration({
      registrationId: "reg_1",
      transactionId: "trx_1",
      orderCode: "1234567890",
      amount: 180,
    });

    expect(result).toEqual({ status: "already_confirmed" });
    expect(mockAllocateInvoiceNumber).not.toHaveBeenCalled();
  });

  it("court-circuite la confirmation concurrente détectée sous verrou", async () => {
    // Lue `pending_payment` hors transaction, déjà `confirmed` sous verrou :
    // c'est la course webhook / page de retour.
    mockFindFirst.mockResolvedValue(registrationRow());
    setupTransaction(lockedRow({ status: "confirmed" }));

    const result = await confirmPaidRegistration({
      registrationId: "reg_1",
      transactionId: "trx_1",
      orderCode: "1234567890",
      amount: 180,
    });

    expect(result).toEqual({ status: "already_confirmed" });
    expect(mockAllocateInvoiceNumber).not.toHaveBeenCalled();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("renvoie not_found pour une inscription inconnue", async () => {
    mockFindFirst.mockResolvedValue(undefined);

    const result = await confirmPaidRegistration({
      registrationId: "reg_inconnue",
      transactionId: "trx_1",
      orderCode: "1234567890",
      amount: 180,
    });

    expect(result).toEqual({ status: "not_found" });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
});
