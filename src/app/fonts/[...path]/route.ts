/**
 * Static file server for fonts
 * Serves font files from public/fonts directory
 * Required because Next.js standalone doesn't serve static files from public/
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const MIME_TYPES: Record<string, string> = {
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;

  if (!pathSegments || pathSegments.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  for (const segment of pathSegments) {
    if (segment.includes("..") || segment.includes("~")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
  }

  const filePath = path.join(process.cwd(), "public", "fonts", ...pathSegments);
  const fontsDir = path.join(process.cwd(), "public", "fonts");

  if (!filePath.startsWith(fontsDir) || !existsSync(filePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fileBuffer = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || "application/octet-stream";

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": fileBuffer.length.toString(),
      "Access-Control-Allow-Origin": "*",
    },
  });
}
