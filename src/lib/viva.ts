import { env } from "~/env";

/**
 * Viva.com (ex Viva Wallet) client for the single payment flow of the app:
 * a producer paying their registration fee for a cup.
 *
 * Two credential sets are involved, which is why the env holds five values:
 *
 *  - `VIVA_CLIENT_ID` / `VIVA_CLIENT_SECRET` — OAuth2 client credentials
 *    ("Smart Checkout" API). Used to create payment orders and to read back
 *    transactions.
 *  - `VIVA_MERCHANT_ID` / `VIVA_API_KEY` — Basic-auth credentials. Viva only
 *    exposes the webhook verification key through this older scheme.
 *  - `VIVA_SOURCE_CODE` — the payment source created in the Viva dashboard.
 *    The success / failure redirect URLs are configured *on that source*, not
 *    per order, so they live in the Viva back-office rather than here.
 */

interface VivaEndpoints {
  accounts: string;
  api: string;
  checkout: string;
}

const ENDPOINTS: Record<"demo" | "production", VivaEndpoints> = {
  demo: {
    accounts: "https://demo-accounts.vivapayments.com",
    api: "https://demo-api.vivapayments.com",
    checkout: "https://demo.vivapayments.com",
  },
  production: {
    accounts: "https://accounts.vivapayments.com",
    api: "https://api.vivapayments.com",
    checkout: "https://www.vivapayments.com",
  },
};

export function vivaEndpoints(): VivaEndpoints {
  return ENDPOINTS[env.VIVA_ENV];
}

/**
 * Credentials required to create and read payment orders.
 */
interface VivaOAuthCredentials {
  clientId: string;
  clientSecret: string;
  sourceCode: string;
}

/**
 * Throws a human-readable error when the Viva credentials are missing, so a
 * misconfigured deploy surfaces as an explicit message instead of a cryptic
 * 401 from Viva.
 */
export function assertVivaConfigured(): VivaOAuthCredentials {
  const missing: string[] = [];
  if (!env.VIVA_CLIENT_ID) missing.push("VIVA_CLIENT_ID");
  if (!env.VIVA_CLIENT_SECRET) missing.push("VIVA_CLIENT_SECRET");
  if (!env.VIVA_SOURCE_CODE) missing.push("VIVA_SOURCE_CODE");

  if (missing.length > 0) {
    throw new Error(
      `Viva.com n'est pas configuré : ${missing.join(", ")} manquant(s) dans l'environnement.`
    );
  }

  return {
    clientId: env.VIVA_CLIENT_ID!,
    clientSecret: env.VIVA_CLIENT_SECRET!,
    sourceCode: env.VIVA_SOURCE_CODE!,
  };
}

export function isVivaConfigured(): boolean {
  return Boolean(
    env.VIVA_CLIENT_ID && env.VIVA_CLIENT_SECRET && env.VIVA_SOURCE_CODE
  );
}

/**
 * Access tokens last an hour; keep the live one in module scope so a burst of
 * checkouts does not re-authenticate on every request. Refreshed 60s early to
 * avoid racing the expiry.
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

function basicAuth(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

export async function getAccessToken(): Promise<string> {
  const { clientId, clientSecret } = assertVivaConfigured();

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const response = await fetch(`${vivaEndpoints().accounts}/connect/token`, {
    method: "POST",
    headers: {
      Authorization: basicAuth(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Viva: échec de l'authentification OAuth (${response.status}) ${detail.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(0, data.expires_in - 60) * 1000,
  };

  return cachedToken.value;
}

/** Exposed for tests — drops the in-memory access token. */
export function resetVivaTokenCache(): void {
  cachedToken = null;
}

export interface CreatePaymentOrderParams {
  /** Amount in cents. */
  amount: number;
  /** Shown to the customer on the Viva checkout page and on their statement. */
  customerTrns: string;
  /** Our own reference — echoed back on the webhook. */
  merchantTrns: string;
  customerEmail?: string;
  customerName?: string;
  /** Seconds the order stays payable. Defaults to 30 minutes. */
  paymentTimeout?: number;
}

/**
 * Creates a payment order and returns its order code, which is what the
 * checkout URL is built from.
 */
export async function createPaymentOrder(
  params: CreatePaymentOrderParams
): Promise<{ orderCode: string; checkoutUrl: string }> {
  const { sourceCode } = assertVivaConfigured();
  const token = await getAccessToken();

  const response = await fetch(`${vivaEndpoints().api}/checkout/v2/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: params.amount,
      customerTrns: params.customerTrns,
      merchantTrns: params.merchantTrns,
      sourceCode,
      paymentTimeout: params.paymentTimeout ?? 1800,
      preauth: false,
      allowRecurring: false,
      maxInstallments: 0,
      paymentNotification: true,
      disableCash: true,
      disableWallet: false,
      customer: {
        email: params.customerEmail,
        fullName: params.customerName,
        countryCode: "FR",
        requestLang: "fr-FR",
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Viva: création de la commande refusée (${response.status}) ${detail.slice(0, 300)}`
    );
  }

  const data = (await response.json()) as { orderCode: number | string };
  const orderCode = String(data.orderCode);

  return { orderCode, checkoutUrl: buildCheckoutUrl(orderCode) };
}

export function buildCheckoutUrl(orderCode: string): string {
  return `${vivaEndpoints().checkout}/web/checkout?ref=${encodeURIComponent(orderCode)}`;
}

/**
 * A Viva transaction, trimmed to the fields the confirmation flow needs.
 * `statusId` is "F" once the payment has actually settled.
 */
export interface VivaTransaction {
  transactionId: string;
  orderCode: string;
  statusId: string;
  /** Amount in the order currency, as a decimal (e.g. 49.9), not cents. */
  amount: number;
  merchantTrns: string | null;
  email: string | null;
}

/**
 * Reads a transaction straight from Viva. Viva's webhooks carry no signature,
 * so every confirmation is re-checked against this endpoint before a
 * registration is marked as paid.
 */
export async function getTransaction(
  transactionId: string
): Promise<VivaTransaction> {
  const token = await getAccessToken();

  const response = await fetch(
    `${vivaEndpoints().api}/checkout/v2/transactions/${encodeURIComponent(transactionId)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Viva: transaction ${transactionId} illisible (${response.status}) ${detail.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as {
    transactionId?: string;
    orderCode?: number | string;
    statusId?: string;
    amount?: number;
    merchantTrns?: string | null;
    email?: string | null;
  };

  return {
    transactionId: data.transactionId ?? transactionId,
    orderCode: String(data.orderCode ?? ""),
    statusId: data.statusId ?? "",
    amount: data.amount ?? 0,
    merchantTrns: data.merchantTrns ?? null,
    email: data.email ?? null,
  };
}

/**
 * The key Viva expects our webhook endpoint to echo back on a GET, to prove we
 * own it. Only reachable with the Basic-auth credentials.
 */
export async function getWebhookVerificationKey(): Promise<string> {
  if (!env.VIVA_MERCHANT_ID || !env.VIVA_API_KEY) {
    throw new Error(
      "Viva: VIVA_MERCHANT_ID et VIVA_API_KEY sont requis pour la vérification du webhook."
    );
  }

  const response = await fetch(
    `${vivaEndpoints().api}/api/messages/config/token`,
    {
      method: "GET",
      headers: {
        Authorization: basicAuth(env.VIVA_MERCHANT_ID, env.VIVA_API_KEY),
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Viva: clé de vérification webhook indisponible (${response.status}) ${detail.slice(0, 200)}`
    );
  }

  const data = (await response.json()) as { Key?: string };
  if (!data.Key) {
    throw new Error("Viva: réponse de vérification webhook sans champ `Key`.");
  }

  return data.Key;
}
