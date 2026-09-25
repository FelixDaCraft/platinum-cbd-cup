/**
 * Invoice Download API Route
 * GET /api/invoices/[registrationId]
 *
 * Returns the PDF invoice for a registration.
 * Only the producer who owns the registration can download.
 */

import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { forbidden, requireSession } from "../../_lib/route-auth";
import { eq } from "drizzle-orm";
import * as schema from "~/server/db/schema";
import { generateInvoicePdf } from "~/server/services/invoice.service";

/**
 * Simple in-memory rate limiter for invoice downloads
 * Limits: 10 requests per minute per user
 * Note: For production with multiple instances, use Redis-based rate limiting
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();

  // Cheap eviction so the map cannot grow without bound.
  if (rateLimitMap.size > 500) {
    for (const [key, entry] of rateLimitMap) {
      if (now > entry.resetAt) rateLimitMap.delete(key);
    }
  }

  const userLimit = rateLimitMap.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (userLimit.count >= RATE_LIMIT_MAX_REQUESTS) {
    const retryAfter = Math.ceil((userLimit.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  userLimit.count++;
  return { allowed: true };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ registrationId: string }> }
) {
  try {
    const { registrationId } = await params;

    const session = await requireSession();
    if (session instanceof NextResponse) return session;

    // Check rate limit
    const rateLimit = checkRateLimit(session.userId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Trop de requetes. Reessayez plus tard." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfter ?? 60),
          },
        }
      );
    }

    // Get the registration with producer info
    const registration = await db.query.registrations.findFirst({
      where: eq(schema.registrations.id, registrationId),
      with: {
        producer: {
          columns: {
            userId: true,
          },
        },
      },
    });

    if (!registration) {
      return NextResponse.json(
        { error: "Inscription non trouvee" },
        { status: 404 }
      );
    }

    // Check if the user is the owner of this registration
    if (registration.producer.userId !== session.userId) {
      return forbidden();
    }

    // Check if registration is confirmed (has paid)
    if (registration.status !== "confirmed") {
      return NextResponse.json(
        { error: "La facture n'est pas disponible pour cette inscription" },
        { status: 400 }
      );
    }

    // Generate the PDF. generateInvoicePdf alloue et persiste le numero de
    // facture lui-meme, sous verrou : ne pas le reecrire ici, ce serait
    // ecraser invoiceGeneratedAt avec la date du telechargement.
    const { buffer, invoiceNumber } = await generateInvoicePdf(registrationId);

    // Return PDF as download
    const filename = `${invoiceNumber}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("[Invoice API] Error generating invoice:", error);
    return NextResponse.json(
      { error: "Erreur lors de la generation de la facture" },
      { status: 500 }
    );
  }
}
