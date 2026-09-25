/**
 * Lab analysis PDF upload + parse endpoint.
 *
 * POC flow:
 *  1. Organizer uploads a SpectralFingerprints certificate for a given
 *     productId (multipart/form-data: "file" + "productId").
 *  2. We verify the caller is an organizer (or the platform admin): the
 *     app is single-tenant, there is no organization membership anymore.
 *  3. We save the PDF under public/uploads/lab-analyses/<productId>/<nanoid>.pdf
 *     (this is an authoritative final location — orphans from cancelled
 *     previews are accepted trade-off for POC simplicity).
 *  4. We run the parser and return its output PLUS {pdfUrl, pdfFilename}
 *     so the UI can show a preview WITHOUT persisting anything. Persistence
 *     happens through product.confirmLabAnalysis tRPC mutation after the
 *     organizer reviews the parsed data.
 *
 * Not a tRPC endpoint because tRPC doesn't handle multipart ergonomically.
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { db } from "~/server/db";
import { parseLabAnalysisPdf } from "~/server/services/lab-analysis/parser";
import { requireOrganizer } from "../../_lib/route-auth";
import { consumeUploadBudget } from "../_lib/budget";
import { sniffType } from "../_lib/file-type";

const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20 MB is very generous for a 1-page certificate
const UPLOAD_SUBDIR = path.join("uploads", "lab-analyses");

export async function POST(request: NextRequest) {
  // 1. Auth — mono-tenant : le certificat est déposé par l'organisateur
  //    (ou l'admin plateforme), l'appartenance à une organisation n'existe
  //    plus.
  const caller = await requireOrganizer();
  if (caller instanceof NextResponse) return caller;

  // 2. Multipart parsing
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Requête invalide (multipart/form-data requis)" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  const productId = formData.get("productId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier PDF manquant" }, { status: 400 });
  }
  if (typeof productId !== "string" || productId.length === 0) {
    return NextResponse.json({ error: "productId manquant" }, { status: 400 });
  }

  if (file.size > MAX_PDF_SIZE) {
    return NextResponse.json(
      { error: `PDF trop volumineux (max ${MAX_PDF_SIZE / 1024 / 1024} MB)` },
      { status: 400 },
    );
  }

  // 3. Le produit doit exister : son id sert ensuite de segment de chemin
  //    sur le disque, la table fait donc office d'allowlist.
  const product = await db.query.products.findFirst({
    where: (p, { eq }) => eq(p.id, productId),
    columns: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  // Chaque dépôt écrit un PDF de plus, jamais purgé (les orphelins d'un
  // aperçu abandonné sont assumés) : budget partagé avec les autres routes
  // d'upload pour qu'une boucle ne remplisse pas le disque de l'hôte.
  const budget = consumeUploadBudget(caller.userId, caller.isOrganizer, file.size);
  if (!budget.allowed) {
    return NextResponse.json(
      { error: "Trop d'uploads. Réessayez plus tard." },
      {
        status: 429,
        headers: { "Retry-After": String(budget.retryAfter ?? 60) },
      },
    );
  }

  // The declared Content-Type is attacker-controlled: the bytes decide.
  const buffer = Buffer.from(await file.arrayBuffer());
  if (sniffType(buffer) !== "pdf") {
    return NextResponse.json(
      { error: "Le fichier doit être un PDF" },
      { status: 400 },
    );
  }

  // 4. Save the PDF to disk. Final path so the confirm step doesn't need
  //    to move the file — re-uploads for the same product just add a new
  //    file; confirmation overwrites the DB row and (later) we can GC.
  const dir = path.join(process.cwd(), "public", UPLOAD_SUBDIR, productId);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const pdfFilename = `${nanoid(10)}.pdf`;
  const filePath = path.join(dir, pdfFilename);

  await writeFile(filePath, buffer);

  const pdfUrl = `/${UPLOAD_SUBDIR.replace(/\\/g, "/")}/${productId}/${pdfFilename}`;

  // 5. Parse. If parsing fails we remove the file immediately — no point
  //    keeping an unparseable upload around.
  try {
    const parsed = await parseLabAnalysisPdf(buffer);
    return NextResponse.json({
      success: true,
      pdfUrl,
      pdfFilename: file.name, // original filename shown to the organizer
      storedFilename: pdfFilename,
      parsed,
    });
  } catch (err) {
    await unlink(filePath).catch(() => {});
    const message =
      err instanceof Error ? err.message : "Erreur inconnue de parsing";
    return NextResponse.json(
      {
        error: `Impossible de lire le PDF : ${message}`,
      },
      { status: 422 },
    );
  }
}
