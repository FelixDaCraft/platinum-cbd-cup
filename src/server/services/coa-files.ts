/**
 * Fichiers des certificats d'analyse (COA), rangés sous
 * public/uploads/coa/<productId>/<id>.pdf (sous-dossier privé, voir la route
 * /uploads).
 */

import { unlink } from "fs/promises";
import path from "path";

export const COA_ROOT = path.resolve(process.cwd(), "public", "uploads", "coa");

const COA_URL_PATTERN = /^\/uploads\/coa\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\.pdf$/;

/** Supprime le fichier d'un COA, sans jamais sortir du dossier coa. */
export async function removeCoaFile(url: string | null): Promise<void> {
  if (!url || !COA_URL_PATTERN.test(url)) return;
  const filePath = path.resolve(process.cwd(), "public", url.slice(1));
  if (!filePath.startsWith(COA_ROOT + path.sep)) return;
  await unlink(filePath).catch(() => undefined);
}
