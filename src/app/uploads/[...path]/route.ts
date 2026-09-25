/**
 * Static file server for uploads
 * Serves files from public/uploads directory
 * Required because Next.js standalone doesn't serve static files from public/
 */

import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { Readable } from "stream";
import { auth } from "~/lib/auth";
import { headers } from "next/headers";
import { db } from "~/server/db";

// MIME types mapping
const MIME_TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".rar": "application/x-rar-compressed",
  ".7z": "application/x-7z-compressed",
};

const UPLOADS_ROOT = path.resolve(process.cwd(), "public", "uploads");

/**
 * Sub-trees that are not public. Lab certificates are only shown in the
 * organizer dashboard, and their URLs end up in the DB and in PDF exports:
 * serving them to anyone who guesses a product id would leak a producer's
 * analysis results.
 */
const PRIVATE_PREFIXES = ["lab-analyses"] as const;

async function callerIsOrganizer(): Promise<boolean> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) return false;
  const caller = await db.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, session.user.id),
    columns: { role: true, isAdmin: true },
  });
  return Boolean(caller && (caller.role === "organizer" || caller.isAdmin));
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    // Security: validate path segments
    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Security: prevent path traversal
    for (const segment of pathSegments) {
      if (
        segment.length === 0 ||
        segment.includes("..") ||
        segment.includes("~") ||
        segment.includes("\0") ||
        segment.includes("/") ||
        segment.includes("\\")
      ) {
        return NextResponse.json({ error: "Invalid path" }, { status: 400 });
      }
    }

    // Build file path, then require it to resolve inside the uploads dir.
    // Comparing with the trailing separator matters: a sibling directory
    // named `uploads-public` shares the prefix but is not the uploads root.
    const filePath = path.resolve(UPLOADS_ROOT, ...pathSegments);
    if (!filePath.startsWith(UPLOADS_ROOT + path.sep)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    if (
      PRIVATE_PREFIXES.includes(
        pathSegments[0] as (typeof PRIVATE_PREFIXES)[number]
      ) &&
      !(await callerIsOrganizer())
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Check the file exists and is a regular file (never a directory)
    let fileStat;
    try {
      fileStat = await stat(filePath);
    } catch {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!fileStat.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Conditional request: uploaded files are immutable, so size+mtime is a
    // sufficient validator and saves re-sending the body on every hit.
    const etag = `"${fileStat.size.toString(16)}-${fileStat.mtimeMs.toString(16)}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // Determine MIME type
    const ext = path.extname(filePath).toLowerCase();
    const knownType = MIME_TYPES[ext];
    const mimeType = knownType ?? "application/octet-stream";

    const responseHeaders: Record<string, string> = {
      "Content-Type": mimeType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": fileStat.size.toString(),
      ETag: etag,
      "Last-Modified": new Date(fileStat.mtimeMs).toUTCString(),
    };

    // Uploaded content is served from our own origin. An SVG — or anything
    // we can't type — navigated to directly would otherwise run its script
    // with our cookies: force it into an opaque origin, and never render an
    // unknown type inline. Images and PDFs keep their normal handling.
    if (!knownType || ext === ".svg") {
      responseHeaders["Content-Security-Policy"] = "default-src 'none'; sandbox";
      if (!knownType) {
        responseHeaders["Content-Disposition"] = "attachment";
      }
    }

    // Stream the file instead of buffering it: documents go up to 50 MB and
    // a handful of concurrent downloads would otherwise pin that much heap.
    const stream = Readable.toWeb(
      createReadStream(filePath)
    ) as ReadableStream<Uint8Array>;

    return new NextResponse(stream, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
