/**
 * File Upload API Route
 * Handles image uploads with automatic WebP conversion
 * and document uploads (PDF, ZIP, etc.) without conversion
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";
import { auth } from "~/lib/auth";
import { headers } from "next/headers";

// Configuration
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for images (increased for better quality)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for documents
const WEBP_QUALITY = 92; // High quality to avoid pixelation
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Allowed file types
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/svg+xml", "image/webp", "image/gif"];
const DOCUMENT_TYPES = ["application/pdf", "application/zip", "application/x-rar-compressed", "application/x-7z-compressed"];
const ALLOWED_TYPES = [...IMAGE_TYPES, ...DOCUMENT_TYPES];

// Ensure upload directory exists
async function ensureUploadDir(subDir?: string): Promise<string> {
  const targetDir = subDir ? path.join(UPLOAD_DIR, subDir) : UPLOAD_DIR;
  if (!existsSync(targetDir)) {
    await mkdir(targetDir, { recursive: true });
  }
  return targetDir;
}

// Generate unique filename
function generateFilename(originalName: string, extension: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const baseName = originalName
    .toLowerCase()
    .replace(/\.[^.]+$/, "") // Remove extension
    .replace(/[^a-z0-9]/g, "-") // Replace non-alphanumeric
    .substring(0, 50); // Limit length
  return `${baseName}-${timestamp}-${random}.${extension}`;
}

// Get file extension from mime type
function getExtension(mimeType: string, originalName: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": "webp",
    "image/png": "webp",
    "image/svg+xml": "webp",
    "image/webp": "webp",
    "image/gif": "webp",
    "application/pdf": "pdf",
    "application/zip": "zip",
    "application/x-rar-compressed": "rar",
    "application/x-7z-compressed": "7z",
  };
  return mimeToExt[mimeType] || originalName.split(".").pop() || "bin";
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folder = formData.get("folder") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Type de fichier non autorisé. Formats acceptés: JPG, PNG, SVG, WebP, GIF, PDF, ZIP" },
        { status: 400 }
      );
    }

    // Determine if it's an image or document
    const isImage = IMAGE_TYPES.includes(file.type);
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;

    // Validate file size
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `Fichier trop volumineux. Taille maximum: ${maxSize / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Read file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let outputBuffer: Buffer;
    let outputExtension: string;
    let compressionRatio = 0;

    if (isImage) {
      // WebP options for high quality output
      const webpOptions = {
        quality: WEBP_QUALITY,
        smartSubsample: true, // Better chroma subsampling
        effort: 4, // Balanced encoding effort (0-6, higher = better compression but slower)
      };

      // Convert images to WebP using Sharp
      if (file.type === "image/svg+xml") {
        // SVG needs special handling - convert to PNG first then WebP
        outputBuffer = await sharp(buffer)
          .png()
          .webp(webpOptions)
          .toBuffer();
      } else {
        // Direct conversion to WebP with high quality settings
        outputBuffer = await sharp(buffer)
          .webp(webpOptions)
          .toBuffer();
      }
      outputExtension = "webp";
      compressionRatio = Math.round((1 - outputBuffer.length / file.size) * 100);
    } else {
      // Documents: no conversion, keep as-is
      outputBuffer = buffer;
      outputExtension = getExtension(file.type, file.name);
    }

    // Ensure upload directory exists
    const uploadDir = await ensureUploadDir(folder || undefined);

    // Generate filename and save
    const filename = generateFilename(file.name, outputExtension);
    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, outputBuffer);

    // Also save a PNG version for PDF rendering (react-pdf doesn't support webp)
    let pngUrl: string | null = null;
    if (isImage && outputExtension === "webp") {
      const pngFilename = filename.replace(/\.webp$/, ".png");
      const pngBuffer = await sharp(buffer).png({ quality: 90 }).toBuffer();
      await writeFile(path.join(uploadDir, pngFilename), pngBuffer);
      pngUrl = folder
        ? `/uploads/${folder}/${pngFilename}`
        : `/uploads/${pngFilename}`;
    }

    // Generate public URL
    const publicUrl = folder
      ? `/uploads/${folder}/${filename}`
      : `/uploads/${filename}`;

    // Return success response with URL
    return NextResponse.json({
      success: true,
      url: publicUrl,
      pngUrl,
      fileName: filename,
      originalName: file.name,
      size: outputBuffer.length,
      originalSize: file.size,
      compressionRatio,
      isImage,
    });

  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'upload" },
      { status: 500 }
    );
  }
}

// Handle DELETE for removing files
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 }
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

    // Security: ensure the file is in the uploads directory
    if (!fileUrl.startsWith("/uploads/")) {
      return NextResponse.json(
        { error: "Chemin non autorisé" },
        { status: 403 }
      );
    }

    const filepath = path.join(process.cwd(), "public", fileUrl);

    if (existsSync(filepath)) {
      await unlink(filepath);
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

// Handle OPTIONS for CORS if needed
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Methods": "POST, DELETE",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
