import { z } from "zod";

/**
 * Supported currencies for cup pricing
 */
export const currencyEnum = ["EUR", "USD", "GBP", "CHF"] as const;
export type Currency = (typeof currencyEnum)[number];

/**
 * Maximum price in cents (1,000,000 EUR/USD/etc.)
 */
export const MAX_PRICE_CENTS = 100000000;

/**
 * Currency symbols for display
 */
export const currencySymbols: Record<Currency, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "CHF",
};

/**
 * Schema for updating cup pricing settings
 */
export const updateCupPricingSchema = z.object({
  cupId: z.string().min(1, "Cup ID requis"),
  defaultPricePerProduct: z
    .number()
    .int("Le prix doit être un entier (centimes)")
    .min(0, "Le prix ne peut pas être négatif")
    .max(MAX_PRICE_CENTS, "Le prix dépasse le maximum autorisé")
    .nullable()
    .optional(),
  currency: z.enum(currencyEnum, {
    errorMap: () => ({ message: "Devise non supportée" }),
  }).optional(),
});

export type UpdateCupPricingInput = z.infer<typeof updateCupPricingSchema>;

/**
 * Schema for updating category price override
 */
export const updateCategoryPriceSchema = z.object({
  categoryId: z.string().min(1, "Category ID requis"),
  priceOverride: z
    .number()
    .int("Le prix doit être un entier (centimes)")
    .min(0, "Le prix ne peut pas être négatif")
    .max(MAX_PRICE_CENTS, "Le prix dépasse le maximum autorisé")
    .nullable(),
});

export type UpdateCategoryPriceInput = z.infer<typeof updateCategoryPriceSchema>;

/**
 * Schema for pricing form in UI (converts user-friendly values)
 */
export const pricingFormSchema = z.object({
  defaultPricePerProduct: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val.trim() === "") return null;
      const cents = parsePriceInput(val);
      return cents;
    }),
  currency: z.enum(currencyEnum).default("EUR"),
});

export type PricingFormData = z.infer<typeof pricingFormSchema>;

/**
 * Format a price in cents for display
 * @param cents Price in cents (or null for free)
 * @param currency Currency code
 * @returns Formatted string e.g., "15,00 €" or "Gratuit"
 */
export function formatPrice(
  cents: number | null | undefined,
  currency: Currency = "EUR"
): string {
  if (cents === null || cents === undefined || cents === 0) return "Gratuit";
  const amount = (cents / 100).toFixed(2).replace(".", ",");
  const symbol = currencySymbols[currency];
  // EUR: "15,00 €", others: "$15.00"
  return currency === "EUR" ? `${amount} ${symbol}` : `${symbol}${amount.replace(",", ".")}`;
}

/**
 * Format a price in cents for form input (without currency symbol)
 * @param cents Price in cents
 * @returns String for input e.g., "15,00" or ""
 */
export function formatPriceForInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

/**
 * Parse a user input string to cents
 * @param value String input e.g., "15,50" or "15.50"
 * @returns Cents (integer) or null if invalid/empty
 */
export function parsePriceInput(value: string): number | null {
  if (!value || value.trim() === "") return null;
  const normalized = value.replace(",", ".").trim();
  const parsed = parseFloat(normalized);
  if (isNaN(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100);
}
