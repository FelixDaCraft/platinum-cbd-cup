/**
 * Jury All-Details PDF API Route
 * GET /api/jury-pdf/[cupId]/all-details
 *
 * Returns a multi-page PDF with one page per product, showing this jury's
 * detailed criterion scores for every product they rated in the cup.
 * Products are sorted by jury score descending within each category.
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "~/lib/auth";
import { generateJuryAllDetailsPdf } from "~/server/services/jury-pdf.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cupId: string }> }
) {
  try {
    const { cupId } = await params;

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Vous devez etre connecte" },
        { status: 401 }
      );
    }

    const { buffer, filename } = await generateJuryAllDetailsPdf(
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
    console.error("[Jury All-Details PDF API] Error:", error);
    const message =
      error instanceof Error ? error.message : "Erreur lors de la generation du PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
