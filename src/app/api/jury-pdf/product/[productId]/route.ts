/**
 * Jury Product Detail PDF API Route
 * GET /api/jury-pdf/product/[productId]?cupId=xxx
 *
 * Returns a single-page PDF with this jury's detailed scores for a specific product.
 * Only the jury who owns the ratings can download.
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "~/lib/auth";
import { generateJuryProductDetailPdf } from "~/server/services/jury-pdf.service";

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

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Vous devez etre connecte" },
        { status: 401 }
      );
    }

    const { buffer, filename } = await generateJuryProductDetailPdf(
      productId,
      cupId,
      session.user.id
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
    console.error("[Jury Product PDF API] Error:", error);
    const message =
      error instanceof Error ? error.message : "Erreur lors de la generation du PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
