import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { auth } from "~/lib/auth";
import { headers } from "next/headers";
import { db } from "~/server/db";

// Max file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024;

// Allowed file types
const ALLOWED_TYPES = [
  "application/zip",
  "application/x-zip-compressed",
  "application/pdf",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
];

const ALLOWED_EXTENSIONS = [".zip", ".pdf", ".rar", ".7z"];

// Single-tenant upload subdirectory (no per-org nesting).
const UPLOAD_SUBDIR = "media-kit";

/**
 * Authorize the caller as an organizer (or platform admin). Single-tenant:
 * we no longer have organizations/members, so the `role` column on users
 * is the source of truth.
 */
async function requireOrganizer(userId: string): Promise<boolean> {
  const caller = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    columns: { role: true, isAdmin: true },
  });
  return Boolean(caller && (caller.role === "organizer" || caller.isAdmin));
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Non autorise" },
        { status: 401 }
      );
    }

    if (!(await requireOrganizer(session.user.id))) {
      return NextResponse.json(
        { error: "Permission refusee" },
        { status: 403 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
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

    // Validate file type (mime OR extension)
    const fileExtension = path.extname(file.name).toLowerCase();
    if (
      !ALLOWED_EXTENSIONS.includes(fileExtension) &&
      !ALLOWED_TYPES.includes(file.type)
    ) {
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

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .substring(0, 100);
    const fileName = `${timestamp}-${sanitizedName}`;
    const filePath = path.join(uploadDir, fileName);

    // Convert file to buffer and save
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
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
    // Check authentication
    const reqHeaders = await headers();
    const session = await auth.api.getSession({
      headers: reqHeaders,
    });

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Non autorise" },
        { status: 401 }
      );
    }

    if (!(await requireOrganizer(session.user.id))) {
      return NextResponse.json(
        { error: "Permission refusee" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get("url");

    if (!fileUrl) {
      return NextResponse.json(
        { error: "URL du fichier requise" },
        { status: 400 }
      );
    }

    // Verify the file belongs to the media-kit directory
    if (!fileUrl.includes(`/uploads/${UPLOAD_SUBDIR}/`)) {
      return NextResponse.json(
        { error: "Acces refuse a ce fichier" },
        { status: 403 }
      );
    }

    // Delete the file
    const filePath = path.join(process.cwd(), "public", fileUrl);
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
