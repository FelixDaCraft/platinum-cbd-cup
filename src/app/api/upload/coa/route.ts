/**
 * Dépôt du certificat d'analyse (COA) d'un produit.
 *
 * Facultatif, déposable par le producteur du produit comme par l'organisation
 * (multipart/form-data : "file" + "productId"). Le PDF est rangé sous
 * public/uploads/coa/<productId>/, sous-dossier privé : la route /uploads ne
 * le sert qu'aux organisateurs et au producteur du produit, jamais au jury
 * (le COA porte souvent le nom du producteur et lèverait l'anonymat).
 *
 * Un nouveau dépôt remplace le précédent, dont le fichier est supprimé.
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "~/server/db";
import * as schema from "~/server/db/schema";
import { forbidden, requireCaller } from "../../_lib/route-auth";
import { consumeUploadBudget, refundUploadBudget } from "../_lib/budget";
import { sniffType } from "../_lib/file-type";
import { COA_ROOT, removeCoaFile } from "~/server/services/coa-files";

const MAX_PDF_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const caller = await requireCaller();
  if (caller instanceof NextResponse) return caller;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Requête invalide (multipart/form-data requis)" },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const productId = formData.get("productId");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Fichier PDF manquant" }, { status: 400 });
  }
  if (typeof productId !== "string" || !/^[A-Za-z0-9_-]+$/.test(productId)) {
    return NextResponse.json({ error: "productId invalide" }, { status: 400 });
  }
  if (file.size > MAX_PDF_SIZE) {
    return NextResponse.json(
      { error: `PDF trop volumineux (max ${MAX_PDF_SIZE / 1024 / 1024} Mo)` },
      { status: 400 }
    );
  }

  // Le produit doit exister (son id devient un segment de chemin) et
  // appartenir à l'appelant s'il n'est pas organisateur.
  const product = await db.query.products.findFirst({
    where: (p, { eq: eqFn }) => eqFn(p.id, productId),
    columns: { id: true, coaFile: true },
    with: { registration: { columns: {}, with: { producer: { columns: { userId: true } } } } },
  });
  if (!product) {
    return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
  }
  if (!caller.isOrganizer && product.registration.producer.userId !== caller.userId) {
    return forbidden();
  }

  const budget = consumeUploadBudget(caller.userId, caller.isOrganizer, file.size);
  if (!budget.allowed) {
    return NextResponse.json(
      { error: "Trop d'uploads. Réessayez plus tard." },
      { status: 429, headers: { "Retry-After": String(budget.retryAfter ?? 60) } }
    );
  }

  // Le type déclaré vient du navigateur : seuls les octets font foi.
  const buffer = Buffer.from(await file.arrayBuffer());
  if (sniffType(buffer) !== "pdf") {
    refundUploadBudget(caller.userId, file.size);
    return NextResponse.json({ error: "Le fichier doit être un PDF" }, { status: 400 });
  }

  const dir = path.join(COA_ROOT, product.id);
  await mkdir(dir, { recursive: true });
  const filename = `${nanoid()}.pdf`;
  await writeFile(path.join(dir, filename), buffer);
  const coaUrl = `/uploads/coa/${product.id}/${filename}`;

  await db
    .update(schema.products)
    .set({ coaFile: coaUrl, coaUploadedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.products.id, product.id));

  await removeCoaFile(product.coaFile);

  return NextResponse.json({ url: coaUrl });
}
