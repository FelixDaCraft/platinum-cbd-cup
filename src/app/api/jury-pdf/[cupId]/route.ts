/**
 * Jury PDF Download API Route
 * GET /api/jury-pdf/[cupId]
 *
 * Returns the PDF synthesis for the current jury's ratings on a cup.
 * Only the jury who owns the ratings can download.
 */

import { NextResponse } from "next/server";
import { generateJurySynthesisPdf } from "~/server/services/jury-pdf.service";
import {
  checkJuryPdfRateLimit,
  PdfBusyError,
  withRenderSlot,
} from "../_lib/throttle";
import { requireSession } from "../../_lib/route-auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cupId: string }> }
) {
  try {
    const { cupId } = await params;

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
      generateJurySynthesisPdf(cupId, session.userId)
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
    // Internal details (DB error messages, file paths, stack traces) stay
    // server-side. Client only learns that generation failed.
    console.error("[Jury PDF API] Error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération du PDF" },
      { status: 500 },
    );
  }
}
