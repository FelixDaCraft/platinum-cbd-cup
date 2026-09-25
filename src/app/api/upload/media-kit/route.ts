import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { requireOrganizer } from "../../_lib/route-auth";
import { consumeUploadBudget } from "../_lib/budget";
import { SNIFFED_TYPES, sniffType, type SniffedType } from "../_lib/file-type";

// Max file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed file types, decided from the bytes rather than from the
// client-declared MIME type or the file name.
const ALLOWED_TYPES: readonly SniffedType[] = ["zip", "pdf", "rar", "7z"];

// Single-tenant upload subdirectory (no per-org nesting).
const UPLOAD_SUBDIR = "media-kit";

export async function POST(request: NextRequest) {
  try {
    const caller = await requireOrganizer();
    if (caller instanceof NextResponse) return caller;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Le fichier ne doit pas depasser 50 Mo" },
        { status: 400 }
      );
    }

    // Le kit média pèse jusqu'à 50 Mo : sans budget partagé avec les autres
    // routes d'upload, une boucle de POST sature le disque de l'hôte.
    const budget = consumeUploadBudget(
      caller.userId,
      caller.isOrganizer,
      file.size
    );
    if (!budget.allowed) {
      return NextResponse.json(
        { error: "Trop d'uploads. Reessayez plus tard." },
        {
          status: 429,
          headers: { "Retry-After": String(budget.retryAfter ?? 60) },
        }
      );
    }

    // Convert file to buffer and validate its real type
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const sniffed = sniffType(buffer);
    if (!sniffed || !ALLOWED_TYPES.includes(sniffed)) {
      return NextResponse.json(
        { error: "Type de fichier non autorise. Utilisez ZIP, PDF, RAR ou 7Z" },
        { status: 400 }
      );
    }

    // Create upload directory (single shared media-kit folder)
    const uploadDir = path.join(process.cwd(), "public", "uploads", UPLOAD_SUBDIR);
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Generate unique filename. The stored extension comes from the sniffed
    // type, not from the name the client sent.
    const timestamp = Date.now();
    const sanitizedName = file.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9-]/g, "_")
      .substring(0, 100);
    const fileName = `${timestamp}-${sanitizedName}.${SNIFFED_TYPES[sniffed].extension}`;
    const filePath = path.join(uploadDir, fileName);

    await writeFile(filePath, buffer);

    // Generate public URL
    const publicUrl = `/uploads/${UPLOAD_SUBDIR}/${fileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      fileName: file.name,
      size: file.size,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'upload" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const caller = await requireOrganizer();
    if (caller instanceof NextResponse) return caller;

    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get("url");

    if (!fileUrl) {
      return NextResponse.json(
        { error: "URL du fichier requise" },
        { status: 400 }
      );
    }

    // Verify the file really resolves inside the media-kit directory.
    // A substring test is not enough: `/uploads/media-kit/../../../server.js`
    // contains the expected prefix but path.join collapses the `..` segments
    // and escapes the folder. Resolve first, then compare the absolute path.
    const mediaKitRoot = path.resolve(
      process.cwd(),
      "public",
      "uploads",
      UPLOAD_SUBDIR
    );
    const filePath = path.resolve(
      process.cwd(),
      "public",
      fileUrl.replace(/^\//, "")
    );
    if (!filePath.startsWith(mediaKitRoot + path.sep)) {
      return NextResponse.json(
        { error: "Acces refuse a ce fichier" },
        { status: 403 }
      );
    }

    // Delete the file
    const { unlink } = await import("fs/promises");

    try {
      await unlink(filePath);
    } catch {
      // File might not exist, that's ok
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression" },
      { status: 500 }
    );
  }
}
