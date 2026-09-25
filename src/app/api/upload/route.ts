/**
 * File Upload API Route
 * Handles image uploads with automatic WebP conversion
 * and document uploads (PDF, ZIP, etc.) without conversion
 *
 * Security model:
 *  - `folder` is never used to build a path: only the keys of FOLDER_RULES
 *    are accepted, and each key declares which roles may write there and
 *    what kind of file it accepts. No string sanitising, no traversal.
 *  - The real type is sniffed from the file content (magic bytes), never
 *    trusted from the client-declared Content-Type or the extension.
 *  - Per-user rate limit (file count + bytes) so a self-registered account
 *    cannot fill the host disk.
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";
import { db } from "~/server/db";
import type { UserRole } from "~/server/db/schema/auth";
import {
  forbidden,
  getCallerRole,
  requireCaller,
  requireSession,
} from "../_lib/route-auth";
import { consumeUploadBudget, refundUploadBudget } from "./_lib/budget";
import { SNIFFED_TYPES, sniffType, type UploadKind } from "./_lib/file-type";

// Configuration
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB for images (increased for better quality)
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for documents
const WEBP_QUALITY = 92; // High quality to avoid pixelation
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const UPLOAD_ROOT = path.resolve(UPLOAD_DIR);
// Guards against decompression bombs: a 50MP source is already far above
// anything a logo or a press picture needs.
const MAX_INPUT_PIXELS = 50_000_000;

const ORGANIZER: readonly UserRole[] = ["organizer"];

/**
 * Strict allowlist of upload folders. `folder` is never used to build a path
 * directly: only a key of this map is accepted, and each key declares which
 * roles may write there and what kind of file it accepts. The empty key is
 * the uploads root, used by the press manager for standalone PDFs (the
 * FileUpload component sends no `folder`).
 */
const FOLDER_RULES: Record<
  string,
  {
    roles: readonly UserRole[];
    kinds: readonly UploadKind[];
    /** Owning a profile of this kind also grants access (a user who wears
     *  two hats only has one `role`). */
    profile?: "producer" | "jury";
  }
> = {
  "": { roles: ORGANIZER, kinds: ["image", "document"] },
  articles: { roles: ORGANIZER, kinds: ["image"] },
  press: { roles: ORGANIZER, kinds: ["image", "document"] },
  images: { roles: ORGANIZER, kinds: ["image"] },
  logos: { roles: ORGANIZER, kinds: ["image"] },
  "producer-logos": {
    roles: ["producer", "organizer"],
    kinds: ["image"],
    profile: "producer",
  },
  "jury-avatars": {
    roles: ["jury", "organizer"],
    kinds: ["image"],
    profile: "jury",
  },
};

async function hasProfile(
  userId: string,
  kind: "producer" | "jury"
): Promise<boolean> {
  if (kind === "producer") {
    const producer = await db.query.producers.findFirst({
      where: (p, { eq }) => eq(p.userId, userId),
      columns: { id: true },
    });
    return Boolean(producer);
  }
  const jury = await db.query.juryProfiles.findFirst({
    where: (j, { eq }) => eq(j.userId, userId),
    columns: { id: true },
  });
  return Boolean(jury);
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

/**
 * Resolve an allowlisted folder to an absolute directory, creating it if
 * needed. The containment check is redundant with the allowlist and kept as
 * defence in depth: a future edit to FOLDER_RULES cannot escape the root.
 */
async function ensureUploadDir(folder: string): Promise<string> {
  const targetDir = folder ? path.resolve(UPLOAD_ROOT, folder) : UPLOAD_ROOT;
  if (
    targetDir !== UPLOAD_ROOT &&
    !targetDir.startsWith(UPLOAD_ROOT + path.sep)
  ) {
    throw new Error(`Upload folder escapes the uploads root: ${folder}`);
  }
  if (!existsSync(targetDir)) {
    await mkdir(targetDir, { recursive: true });
  }
  return targetDir;
}

export async function POST(request: NextRequest) {
  try {
    const caller = await requireCaller();
    if (caller instanceof NextResponse) return caller;
    const { userId, role, isOrganizer } = caller;

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file");
    const folderInput = formData.get("folder");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    // Validate the destination against the allowlist (never sanitise it)
    const folder = typeof folderInput === "string" ? folderInput : "";
    const folderRule = Object.prototype.hasOwnProperty.call(
      FOLDER_RULES,
      folder
    )
      ? FOLDER_RULES[folder]
      : undefined;
    if (!folderRule) {
      return NextResponse.json(
        { error: "Destination d'upload non autorisée" },
        { status: 400 }
      );
    }
    const allowed =
      folderRule.roles.includes(role) ||
      (folderRule.profile !== undefined &&
        (await hasProfile(userId, folderRule.profile)));
    if (!allowed) {
      return forbidden();
    }

    // Validate declared size before reading the body into memory
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Fichier trop volumineux. Taille maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    const budget = consumeUploadBudget(userId, isOrganizer, file.size);
    if (!budget.allowed) {
      return NextResponse.json(
        { error: "Trop d'uploads. Réessayez plus tard." },
        {
          status: 429,
          headers: { "Retry-After": String(budget.retryAfter ?? 60) },
        }
      );
    }

    // Le budget vient d'être décompté sur la taille ANNONCÉE, avant de savoir
    // si le contenu est du type prétendu. Tout rejet qui suit doit donc le
    // rendre : sinon un mauvais format coûte son quota à l'utilisateur alors
    // que rien n'a été écrit.
    const refuser = (error: string, status = 400) => {
      refundUploadBudget(userId, file.size);
      return NextResponse.json({ error }, { status });
    };

    // Read file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate the *real* file type, then the size limit for its kind
    const sniffed = sniffType(buffer);
    if (!sniffed) {
      return refuser(
        "Type de fichier non autorisé. Formats acceptés: JPG, PNG, SVG, WebP, GIF, PDF, ZIP"
      );
    }
    const { kind } = SNIFFED_TYPES[sniffed];
    if (!folderRule.kinds.includes(kind)) {
      return refuser("Type de fichier non autorisé pour cette destination");
    }
    // SVG is rasterised by librsvg inside the Node process: keep that parser
    // away from files supplied by self-registered accounts.
    if (sniffed === "svg" && !isOrganizer) {
      return refuser("Format SVG non autorisé. Utilisez JPG, PNG ou WebP");
    }

    const isImage = kind === "image";
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;
    if (buffer.length > maxSize) {
      return refuser(
        `Fichier trop volumineux. Taille maximum: ${maxSize / 1024 / 1024}MB`
      );
    }

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
      const sharpOptions = { limitInputPixels: MAX_INPUT_PIXELS };

      // Convert images to WebP using Sharp
      if (sniffed === "svg") {
        // SVG needs special handling - convert to PNG first then WebP
        outputBuffer = await sharp(buffer, sharpOptions)
          .png()
          .webp(webpOptions)
          .toBuffer();
      } else {
        // Direct conversion to WebP with high quality settings
        outputBuffer = await sharp(buffer, sharpOptions)
          .webp(webpOptions)
          .toBuffer();
      }
      outputExtension = "webp";
      compressionRatio = Math.round((1 - outputBuffer.length / file.size) * 100);
    } else {
      // Documents: no conversion, keep as-is
      outputBuffer = buffer;
      outputExtension = SNIFFED_TYPES[sniffed].extension;
    }

    // Ensure upload directory exists
    const uploadDir = await ensureUploadDir(folder);

    // Generate filename and save
    const filename = generateFilename(file.name, outputExtension);
    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, outputBuffer);

    // Also save a PNG version for PDF rendering (react-pdf doesn't support webp)
    let pngUrl: string | null = null;
    if (isImage && outputExtension === "webp") {
      const pngFilename = filename.replace(/\.webp$/, ".png");
      const pngBuffer = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
        .png({ quality: 90 })
        .toBuffer();
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

/**
 * A non-organizer may only delete the asset they own: their producer logo or
 * their own avatar. Uploads carry no owner column, so ownership is derived
 * from the entity that references the URL. Both variants written by POST
 * (.webp and its .png sibling) count as the same asset.
 */
async function ownsUploadedFile(
  userId: string,
  fileUrl: string
): Promise<boolean> {
  const variants = new Set([fileUrl]);
  if (fileUrl.endsWith(".png")) {
    variants.add(fileUrl.replace(/\.png$/, ".webp"));
  }

  const [producer, user] = await Promise.all([
    db.query.producers.findFirst({
      where: (p, { eq }) => eq(p.userId, userId),
      columns: { logo: true },
    }),
    db.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
      columns: { image: true },
    }),
  ]);

  for (const owned of [producer?.logo, user?.image]) {
    if (owned && variants.has(owned)) return true;
  }
  return false;
}

// Handle DELETE for removing files
export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSession();
    if (session instanceof NextResponse) return session;
    const { userId } = session;

    const { searchParams } = new URL(request.url);
    const fileUrl = searchParams.get("url");

    if (!fileUrl) {
      return NextResponse.json(
        { error: "URL du fichier requise" },
        { status: 400 }
      );
    }

    // Security: ensure the file is in the uploads directory.
    // The startsWith check is not sufficient on its own — `/uploads/../.env`
    // begins with `/uploads/` but path.join collapses the `..` segments and
    // escapes the dir. Resolve to an absolute path and require it to live
    // under the uploads root.
    if (!fileUrl.startsWith("/uploads/")) {
      return NextResponse.json(
        { error: "Chemin non autorisé" },
        { status: 403 }
      );
    }

    const filepath = path.resolve(process.cwd(), "public", fileUrl.replace(/^\//, ""));
    if (
      filepath !== UPLOAD_ROOT &&
      !filepath.startsWith(UPLOAD_ROOT + path.sep)
    ) {
      return NextResponse.json(
        { error: "Chemin non autorisé" },
        { status: 403 }
      );
    }

    // Ownership: organizers curate every asset, everyone else may only remove
    // the file their own profile points at.
    const role = await getCallerRole(userId);
    if (role !== "organizer" && !(await ownsUploadedFile(userId, fileUrl))) {
      return forbidden();
    }

    if (existsSync(filepath)) {
      await unlink(filepath);
      console.info(`[upload] deleted ${fileUrl} by user ${userId} (${role})`);
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
