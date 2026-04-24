/**
 * Jury PDF Download API Route
 * GET /api/jury-pdf/[cupId]
 *
 * Returns the PDF synthesis for the current jury's ratings on a cup.
 * Only the jury who owns the ratings can download.
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "~/lib/auth";
import { generateJurySynthesisPdf } from "~/server/services/jury-pdf.service";

export async function GET(
  request: Request,
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

    const { buffer, filename } = await generateJurySynthesisPdf(
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
    console.error("[Jury PDF API] Error:", error);
    const message =
      error instanceof Error ? error.message : "Erreur lors de la generation du PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
