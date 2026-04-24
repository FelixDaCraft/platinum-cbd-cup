/**
 * Dump raw pdfjs-dist text items for a sample PDF so we can see X/Y
 * coordinates and confirm the parser's column-splitting assumptions.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const file = process.argv[2] ?? "sample1.pdf";
const samplePath = path.resolve(process.cwd(), "tmp", "lab-samples", file);

const buf = await readFile(samplePath);
const data = new Uint8Array(
  buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
);

const pdf = await pdfjsLib.getDocument({
  data,
  isEvalSupported: false,
  useSystemFonts: false,
  disableFontFace: true,
}).promise;

const page = await pdf.getPage(1);
const content = await page.getTextContent();

type Row = { str: string; x: number; y: number; w: number };
const items: Row[] = content.items
  .filter((it: unknown): it is { str: string; transform: number[]; width?: number } => {
    return typeof it === "object" && it !== null && "str" in it;
  })
  .map((it) => ({
    str: it.str,
    x: it.transform[4] ?? 0,
    y: it.transform[5] ?? 0,
    w: it.width ?? 0,
  }))
  .filter((r) => r.str.trim().length > 0);

// Sort top-to-bottom, then left-to-right
items.sort((a, b) => (Math.abs(a.y - b.y) < 2 ? a.x - b.x : b.y - a.y));

console.log(`items: ${items.length}`);
for (const it of items) {
  console.log(
    `  y=${it.y.toFixed(1).padStart(7)}  x=${it.x.toFixed(1).padStart(7)}  w=${it.w.toFixed(1).padStart(5)}  ${JSON.stringify(it.str)}`,
  );
}
