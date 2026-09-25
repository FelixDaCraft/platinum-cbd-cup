/**
 * Jury Product Detail PDF API Route
 * GET /api/jury-pdf/product/[productId]?cupId=xxx
 *
 * Returns a single-page PDF with this jury's detailed scores for a specific product.
 * Only the jury who owns the ratings can download.
 */

import { NextResponse } from "next/server";
import { generateJuryProductDetailPdf } from "~/server/services/jury-pdf.service";
import {
  checkJuryPdfRateLimit,
  PdfBusyError,
  withRenderSlot,
} from "../../_lib/throttle";
import { requireSession } from "../../../_lib/route-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const { productId } = await params;
    const { searchParams } = new URL(request.url);
    const cupId = searchParams.get("cupId");

    if (!cupId) {
      return NextResponse.json(
        { error: "Le paramètre cupId est requis" },
        { status: 400 }
      );
    }

    const session = await requireSession();
    if (session instanceof NextResponse) return session;

    const limit = checkJuryPdfRateLimit(session.userId);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Trop de téléchargements. Réessayez dans quelques minutes." },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfter ?? 60) },
        }
      );
    }

    const { buffer, filename } = await withRenderSlot(() =>
      generateJuryProductDetailPdf(productId, cupId, session.userId)
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    if (error instanceof PdfBusyError) {
      return NextResponse.json(
        { error: "Génération de PDF saturée. Réessayez dans un instant." },
        { status: 503, headers: { "Retry-After": "5" } }
      );
    }
    console.error("[Jury Product PDF API] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du PDF" },
      { status: 500 },
    );
  }
}
