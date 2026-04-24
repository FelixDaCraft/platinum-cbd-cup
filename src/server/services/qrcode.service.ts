import QRCode from "qrcode";

/**
 * QR Code generation service for CupMetrics
 *
 * Generates QR codes for:
 * - Product reception (colis): Producer scans to identify product for shipment
 * - Product notation: Jury scans to access rating interface
 */

export interface QRCodeOptions {
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

const DEFAULT_OPTIONS: QRCodeOptions = {
  width: 256,
  margin: 2,
  color: {
    dark: "#000000",
    light: "#ffffff",
  },
};

/**
 * Generate QR code data URL (base64 PNG)
 */
export async function generateQRCodeDataUrl(
  data: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  return QRCode.toDataURL(data, {
    width: mergedOptions.width,
    margin: mergedOptions.margin,
    color: mergedOptions.color,
    errorCorrectionLevel: "M",
  });
}

/**
 * Generate QR code as PNG buffer
 */
export async function generateQRCodeBuffer(
  data: string,
  options: QRCodeOptions = {}
): Promise<Buffer> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  return QRCode.toBuffer(data, {
    type: "png",
    width: mergedOptions.width,
    margin: mergedOptions.margin,
    color: mergedOptions.color,
    errorCorrectionLevel: "M",
  });
}

/**
 * Generate QR code as SVG string
 */
export async function generateQRCodeSVG(
  data: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  return QRCode.toString(data, {
    type: "svg",
    width: mergedOptions.width,
    margin: mergedOptions.margin,
    color: mergedOptions.color,
    errorCorrectionLevel: "M",
  });
}

/**
 * Build URL for product reception QR code
 * This is the QR code that producers put on their shipping boxes
 */
export function buildProductReceptionUrl(productId: string, cupId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl}/receipt/${cupId}/product/${productId}`;
}

/**
 * Build URL for product notation QR code
 * This is the QR code that jurys scan to access the rating interface
 */
export function buildProductNotationUrl(productId: string, cupId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${baseUrl}/rate/${cupId}/product/${productId}`;
}

/**
 * Generate a reception QR code for a product (for shipping boxes)
 */
export async function generateProductReceptionQRCode(
  productId: string,
  cupId: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const url = buildProductReceptionUrl(productId, cupId);
  return generateQRCodeDataUrl(url, options);
}

/**
 * Generate a notation QR code for a product (for jury rating)
 */
export async function generateProductNotationQRCode(
  productId: string,
  cupId: string,
  options: QRCodeOptions = {}
): Promise<string> {
  const url = buildProductNotationUrl(productId, cupId);
  return generateQRCodeDataUrl(url, options);
}

export type QRCodeType = "reception" | "notation";

/**
 * Generate QR code for a product based on type
 */
export async function generateProductQRCode(
  productId: string,
  cupId: string,
  type: QRCodeType,
  options: QRCodeOptions = {}
): Promise<{ dataUrl: string; url: string }> {
  const url = type === "reception"
    ? buildProductReceptionUrl(productId, cupId)
    : buildProductNotationUrl(productId, cupId);

  const dataUrl = await generateQRCodeDataUrl(url, options);

  return { dataUrl, url };
}

/**
 * Batch generate QR codes for multiple products
 */
export async function generateBatchQRCodes(
  products: Array<{ id: string; cupId: string; anonymousCode: string | null }>,
  type: QRCodeType,
  options: QRCodeOptions = {}
): Promise<Array<{
  productId: string;
  anonymousCode: string | null;
  dataUrl: string;
  url: string;
}>> {
  const results = await Promise.all(
    products.map(async (product) => {
      const { dataUrl, url } = await generateProductQRCode(
        product.id,
        product.cupId,
        type,
        options
      );
      return {
        productId: product.id,
        anonymousCode: product.anonymousCode,
        dataUrl,
        url,
      };
    })
  );

  return results;
}
