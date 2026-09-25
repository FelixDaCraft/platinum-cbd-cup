/**
 * Favicon Generation API
 * Generates a favicon from an uploaded logo image
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";
import { requireOrganizer } from "../../_lib/route-auth";
import { consumeUploadBudget, COUT_FAVICON_OCTETS } from "../_lib/budget";

const FAVICON_SIZE = 32;
const UPLOADS_ROOT = path.resolve(process.cwd(), "public", "uploads");
const UPLOAD_DIR = path.join(UPLOADS_ROOT, "favicons");
// A 50MP source is far beyond anything a logo needs; guards against
// decompression bombs.
const MAX_INPUT_PIXELS = 50_000_000;

// Ensure favicon directory exists
async function ensureFaviconDir(): Promise<void> {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Générer un favicon est une action de marque du site : organisateurs
    // (ou admin plateforme) uniquement.
    const caller = await requireOrganizer();
    if (caller instanceof NextResponse) return caller;

    // Corps JSON fourni par le client : une syntaxe invalide est une erreur
    // de requête, pas une panne serveur.
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Corps JSON invalide" }, { status: 400 });
    }
    const logoUrl =
      typeof body === "object" && body !== null && "logoUrl" in body
        ? (body as { logoUrl?: unknown }).logoUrl
        : undefined;

    if (!logoUrl || typeof logoUrl !== "string") {
      return NextResponse.json(
        { error: "URL du logo requise" },
        { status: 400 }
      );
    }

    // Security: ensure the logo really resolves inside the uploads directory.
    // startsWith alone is not enough — `/uploads/../../.env` has the right
    // prefix but path.join collapses the `..` segments and escapes the dir.
    if (!logoUrl.startsWith("/uploads/")) {
      return NextResponse.json(
        { error: "Chemin non autorise" },
        { status: 403 }
      );
    }

    const logoPath = path.resolve(
      process.cwd(),
      "public",
      logoUrl.replace(/^\//, "")
    );
    if (!logoPath.startsWith(UPLOADS_ROOT + path.sep)) {
      return NextResponse.json(
        { error: "Chemin non autorise" },
        { status: 403 }
      );
    }

    if (!existsSync(logoPath)) {
      return NextResponse.json(
        { error: "Logo non trouve" },
        { status: 404 }
      );
    }

    // Read the logo file
    const logoBuffer = await readFile(logoPath);

    // Chaque appel écrit un fichier horodaté de plus : sans budget, une
    // boucle de POST remplit public/uploads/favicons.
    const budget = consumeUploadBudget(
      caller.userId,
      caller.isOrganizer,
      COUT_FAVICON_OCTETS
    );
    if (!budget.allowed) {
      return NextResponse.json(
        { error: "Trop d'uploads. Réessayez plus tard." },
        {
          status: 429,
          headers: { "Retry-After": String(budget.retryAfter ?? 60) },
        }
      );
    }

    // Ensure favicon directory exists
    await ensureFaviconDir();

    // Generate favicon filename
    const timestamp = Date.now();
    const faviconFilename = `favicon-${timestamp}.png`;
    const faviconPath = path.join(UPLOAD_DIR, faviconFilename);

    // Generate 32x32 favicon using Sharp
    await sharp(logoBuffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .resize(FAVICON_SIZE, FAVICON_SIZE, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 }, // Transparent background
      })
      .png()
      .toFile(faviconPath);

    // Generate public URL
    const faviconUrl = `/uploads/favicons/${faviconFilename}`;

    return NextResponse.json({
      success: true,
      faviconUrl,
    });

  } catch (error) {
    console.error("Favicon generation error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la generation du favicon" },
      { status: 500 }
    );
  }
}
