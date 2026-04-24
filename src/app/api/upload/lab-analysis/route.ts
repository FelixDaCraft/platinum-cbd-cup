/**
 * Lab analysis PDF upload + parse endpoint.
 *
 * POC flow:
 *  1. Organizer uploads a SpectralFingerprints certificate for a given
 *     productId (multipart/form-data: "file" + "productId").
 *  2. We verify the caller is a member of the organization that owns the
 *     cup containing that product.
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
import { auth } from "~/lib/auth";
import { headers } from "next/headers";
import { db } from "~/server/db";
import { parseLabAnalysisPdf } from "~/server/services/lab-analysis/parser";

const MAX_PDF_SIZE = 20 * 1024 * 1024; // 20 MB is very generous for a 1-page certificate
const UPLOAD_SUBDIR = path.join("uploads", "lab-analyses");

export async function POST(request: NextRequest) {
  // 1. Auth
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const userId = session.user.id;

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

  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Le fichier doit être un PDF" },
      { status: 400 },
    );
  }
  if (file.size > MAX_PDF_SIZE) {
    return NextResponse.json(
      { error: `PDF trop volumineux (max ${MAX_PDF_SIZE / 1024 / 1024} MB)` },
      { status: 400 },
    );
  }

  // 3. Authorization: single-tenant — require authenticated organizer.
  //    Ownership is enforced by the org-wide role rather than by org
  //    membership (there is no organizations/members table anymore).
  const product = await db.query.products.findFirst({
    where: (p, { eq }) => eq(p.id, productId),
    columns: { id: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }

  const caller = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    columns: { role: true, isAdmin: true },
  });
  if (!caller || (caller.role !== "organizer" && !caller.isAdmin)) {
    return NextResponse.json(
      { error: "Accès non autorisé à ce produit" },
      { status: 403 },
    );
  }
  // Silence the unused-var lint if any downstream expected `userId`.
  void userId;

  // 4. Save the PDF to disk. Final path so the confirm step doesn't need
  //    to move the file — re-uploads for the same product just add a new
  //    file; confirmation overwrites the DB row and (later) we can GC.
  const dir = path.join(process.cwd(), "public", UPLOAD_SUBDIR, productId);
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
  const pdfFilename = `${nanoid(10)}.pdf`;
  const filePath = path.join(dir, pdfFilename);

  const buffer = Buffer.from(await file.arrayBuffer());
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
