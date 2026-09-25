/**
 * Content-based file type detection shared by the upload routes.
 *
 * The client-declared Content-Type and the file name are attacker-controlled:
 * only the bytes decide what a file is. Private folder (`_lib`) so Next.js
 * never routes it.
 */

export type UploadKind = "image" | "document";

export const SNIFFED_TYPES = {
  jpeg: { kind: "image", extension: "jpg" },
  png: { kind: "image", extension: "png" },
  gif: { kind: "image", extension: "gif" },
  webp: { kind: "image", extension: "webp" },
  svg: { kind: "image", extension: "svg" },
  pdf: { kind: "document", extension: "pdf" },
  zip: { kind: "document", extension: "zip" },
  rar: { kind: "document", extension: "rar" },
  "7z": { kind: "document", extension: "7z" },
} as const satisfies Record<string, { kind: UploadKind; extension: string }>;

export type SniffedType = keyof typeof SNIFFED_TYPES;

/** Identify a buffer from its magic bytes, or null when unrecognised. */
export function sniffType(buffer: Buffer): SniffedType | null {
  const startsWith = (...bytes: number[]) =>
    bytes.length <= buffer.length && bytes.every((b, i) => buffer[i] === b);

  if (startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (startsWith(0xff, 0xd8, 0xff)) return "jpeg";
  const gifHeader = buffer.subarray(0, 6).toString("ascii");
  if (gifHeader === "GIF87a" || gifHeader === "GIF89a") return "gif";
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  // ZIP: local file header, empty archive, spanned archive
  if (
    startsWith(0x50, 0x4b, 0x03, 0x04) ||
    startsWith(0x50, 0x4b, 0x05, 0x06) ||
    startsWith(0x50, 0x4b, 0x07, 0x08)
  ) {
    return "zip";
  }
  if (startsWith(0x52, 0x61, 0x72, 0x21, 0x1a, 0x07)) return "rar";
  if (startsWith(0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c)) return "7z";

  // SVG is text: accept it only when the document really starts with an XML
  // prolog or an <svg> root, after an optional BOM and leading whitespace.
  const head = buffer
    .subarray(0, 1024)
    .toString("utf8")
    .replace(/^﻿/, "")
    .trimStart();
  if (/^<(\?xml[\s?]|!DOCTYPE\s+svg|svg[\s>])/i.test(head)) return "svg";

  return null;
}
