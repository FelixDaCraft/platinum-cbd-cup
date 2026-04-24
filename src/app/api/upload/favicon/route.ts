/**
 * Favicon Generation API
 * Generates a favicon from an uploaded logo image
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";
import { auth } from "~/lib/auth";
import { headers } from "next/headers";

const FAVICON_SIZE = 32;
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "favicons");

// Ensure favicon directory exists
async function ensureFaviconDir(): Promise<void> {
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { error: "Non autorise" },
        { status: 401 }
      );
    }

    // Parse request body
    const { logoUrl } = await request.json();

    if (!logoUrl || typeof logoUrl !== "string") {
      return NextResponse.json(
        { error: "URL du logo requise" },
        { status: 400 }
      );
    }

    // Security: ensure the logo is in the uploads directory
    if (!logoUrl.startsWith("/uploads/")) {
      return NextResponse.json(
        { error: "Chemin non autorise" },
        { status: 403 }
      );
    }

    // Get the local file path
    const logoPath = path.join(process.cwd(), "public", logoUrl);

    if (!existsSync(logoPath)) {
      return NextResponse.json(
        { error: "Logo non trouve" },
        { status: 404 }
      );
    }

    // Read the logo file
    const logoBuffer = await readFile(logoPath);

    // Ensure favicon directory exists
    await ensureFaviconDir();

    // Generate favicon filename
    const timestamp = Date.now();
    const faviconFilename = `favicon-${timestamp}.png`;
    const faviconPath = path.join(UPLOAD_DIR, faviconFilename);

    // Generate 32x32 favicon using Sharp
    await sharp(logoBuffer)
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
