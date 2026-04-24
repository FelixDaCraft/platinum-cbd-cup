/**
 * Lab analysis PDF parser — SpectralFingerprints (SFP) GC-FID certificates.
 *
 * Format: A4 portrait, single page, header block + totals block + two
 * side-by-side tables (Cannabinoïdes left, Terpènes right).
 *
 * Strategy:
 *  1. Extract text items (string + XY position) with pdfjs-dist.
 *  2. Locate the "Cannabinoïdes" and "Terpènes" headings — their X defines
 *     the column boundary. Their Y defines the start of the data tables.
 *  3. Split items into header / left-column / right-column by X,Y.
 *  4. Group each column into lines (Y-binned), sort top-to-bottom, parse rows
 *     until "Méthode d'analyse".
 *  5. Parse metadata (analysis nb, serial, dates, totals) from the header zone.
 */

/**
 * pdfjs-dist 5.x's legacy build expects browser globals like `DOMMatrix`,
 * `ImageData` and `Path2D` to exist — it tries to polyfill them at init
 * time but silently fails in Node (warning: "Cannot polyfill DOMMatrix"),
 * then crashes with `ReferenceError: DOMMatrix is not defined` when its
 * module code tries to reference them.
 *
 * For text-only extraction via `getTextContent()` these classes are never
 * actually invoked, so empty stubs are enough. The stubs MUST be installed
 * before pdfjs-dist is loaded — that's why we use a dynamic `import()`
 * inside `parseLabAnalysisPdf` rather than a static top-level import.
 */
type GlobalStub = Record<string, unknown>;
const __g = globalThis as unknown as GlobalStub;
if (typeof __g.DOMMatrix === "undefined") {
  __g.DOMMatrix = class DOMMatrix {
    constructor(_init?: unknown) {}
  };
}
if (typeof __g.ImageData === "undefined") {
  __g.ImageData = class ImageData {
    constructor(_data?: unknown, _w?: number, _h?: number) {}
  };
}
if (typeof __g.Path2D === "undefined") {
  __g.Path2D = class Path2D {
    constructor(_path?: unknown) {}
  };
}

type PdfjsModule = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
let pdfjsPromise: Promise<PdfjsModule> | null = null;
function loadPdfjs(): Promise<PdfjsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist/legacy/build/pdf.mjs");
  }
  return pdfjsPromise;
}

export type CompoundRow = {
  abbreviation: string;
  name: string;
  /** null when ND (not detected) or below LOQ */
  percentage: number | null;
  /** "ND" | "LOQ" | "value" — lets downstream distinguish absence vs measured 0 */
  flag: "ND" | "LOQ" | "value";
  /** measurement uncertainty, same unit as percentage. null when ND */
  uncertainty: number | null;
};

export type LabAnalysisMetadata = {
  analysisNumber: string | null;
  sfpCode: string | null;
  serial: string | null;
  productDescription: string | null;
  sampleType: string | null;
  receivedAt: string | null; // ISO date
  approvedAt: string | null; // ISO date
  methodName: string | null;
  labName: string;
};

export type LabAnalysisTotals = {
  terpenesTotal: number | null;
};

export type ParsedLabAnalysis = {
  metadata: LabAnalysisMetadata;
  totals: LabAnalysisTotals;
  terpenes: CompoundRow[];
  /** Sum of measured terpenes (ignoring ND/LOQ) — used for ranking. */
  computedTerpeneSum: number;
};

type TextItem = {
  str: string;
  x: number;
  y: number;
  width: number;
};

const LAB_NAME = "SpectralFingerprints";

/**
 * Parse a SpectralFingerprints lab analysis PDF buffer into a structured
 * object. Throws with a descriptive message if the PDF doesn't match the
 * expected layout.
 */
export async function parseLabAnalysisPdf(
  buffer: Buffer | Uint8Array,
): Promise<ParsedLabAnalysis> {
  // pdfjs-dist rejects Node Buffer even though it extends Uint8Array.
  // Copy into a plain Uint8Array view.
  const data = new Uint8Array(
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ),
  );

  // Lazy-load pdfjs-dist so the DOMMatrix/ImageData stubs installed above
  // are already on globalThis before pdfjs evaluates its module code.
  const pdfjsLib = await loadPdfjs();

  // Disable worker — we're on the server, single-threaded parsing is fine.
  const loadingTask = pdfjsLib.getDocument({
    data,
    isEvalSupported: false,
    useSystemFonts: false,
    disableFontFace: true,
  });
  const pdf = await loadingTask.promise;

  // All SFP certificates we've seen are single-page.
  if (pdf.numPages < 1) {
    throw new Error("PDF has no pages");
  }
  const page = await pdf.getPage(1);
  const content = await page.getTextContent();

  const items: TextItem[] = content.items
    .filter((it): it is Extract<typeof it, { str: string }> => "str" in it)
    .map((it) => {
      // transform = [a, b, c, d, e, f] — e is X, f is Y (PDF user space).
      const t = (it as unknown as { transform: number[] }).transform;
      return {
        str: it.str,
        x: t[4] ?? 0,
        y: t[5] ?? 0,
        width:
          (it as unknown as { width?: number }).width ??
          (it.str.length ?? 0) * 3,
      };
    })
    .filter((it) => it.str.trim().length > 0);

  if (items.length === 0) {
    throw new Error("PDF contains no extractable text");
  }

  // 1. Locate column headings ("Cannabinoïdes" / "Terpènes") to find the
  //    boundary between the two tables.
  const cannabHeading = items.find((it) => it.str.trim() === "Cannabinoïdes");
  const terpHeading = items.find((it) => it.str.trim() === "Terpènes");
  if (!cannabHeading || !terpHeading) {
    throw new Error(
      "Expected headings 'Cannabinoïdes' and 'Terpènes' not found — is this a SpectralFingerprints certificate?",
    );
  }

  // Column boundary: the terpene table's left edge sits at the "Terpènes"
  // heading X. The cannabinoid table's rightmost data column (U.M.) ends
  // well before that, so `terpHeading.x - 1` cleanly separates the two.
  const midX = terpHeading.x - 1;

  // 2. Header zone = everything above the tables (Y > headings Y in PDF user
  //    space, since Y grows upward).
  const tablesTopY = Math.max(cannabHeading.y, terpHeading.y);
  const headerItems = items.filter((it) => it.y > tablesTopY);

  // The SFP header is laid out as three descriptor columns. We partition the
  // header items by X so metadata regexes don't bleed across columns.
  // Thresholds picked from observed layout: col1 ~20, col2 ~230, col3 ~440.
  const COL2_MIN_X = 225;
  const COL3_MIN_X = 440;
  const headerCol1 = headerItems.filter((it) => it.x < COL2_MIN_X);
  const headerCol2 = headerItems.filter(
    (it) => it.x >= COL2_MIN_X && it.x < COL3_MIN_X,
  );
  const headerCol3 = headerItems.filter((it) => it.x >= COL3_MIN_X);

  const col1Lines = groupIntoLines(headerCol1);
  const col2Lines = groupIntoLines(headerCol2);
  const col3Lines = groupIntoLines(headerCol3);

  const metadata = extractMetadata({
    col1: col1Lines.map((l) => l.text).join("\n"),
    col2: col2Lines.map((l) => l.text).join("\n"),
    col3: col3Lines.map((l) => l.text).join("\n"),
  });

  // Totals sit in their own mid-page band (between the descriptor rows and
  // the table headings). Labels are in col2, values in col3, but some labels
  // wrap across two lines. Parse them from the raw header items directly.
  const totals = extractTotals(headerItems);

  // 4. Data rows — only terpenes. The Cannabinoïdes heading is still
  //    located above so `midX` can cleanly separate the two columns, but
  //    we don't extract cannabinoid rows anymore (POC scope trimmed to
  //    terpenes only).
  const terpRows = extractColumn(items, {
    midX,
    side: "right",
    headingY: terpHeading.y,
  });

  if (terpRows.length === 0) {
    throw new Error("No terpene rows extracted — layout may have changed");
  }

  const computedTerpeneSum = terpRows.reduce(
    (acc, r) => acc + (r.percentage ?? 0),
    0,
  );

  return {
    metadata,
    totals,
    terpenes: terpRows,
    computedTerpeneSum: round2(computedTerpeneSum),
  };
}

/* -------------------------------------------------------------------------- */
/* Line grouping & column extraction                                          */
/* -------------------------------------------------------------------------- */

type Line = { y: number; items: TextItem[]; text: string };

const Y_TOLERANCE = 2; // same-line tolerance in PDF units

/** Group items into lines by Y coordinate. Lines are returned top-to-bottom. */
function groupIntoLines(items: TextItem[]): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y); // top first (Y descending)
  const lines: Line[] = [];

  for (const item of sorted) {
    const existing = lines.find((l) => Math.abs(l.y - item.y) <= Y_TOLERANCE);
    if (existing) {
      existing.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item], text: "" });
    }
  }

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
    line.text = line.items
      .map((i) => i.str.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return lines;
}

function extractColumn(
  allItems: TextItem[],
  opts: { midX: number; side: "left" | "right"; headingY: number },
): CompoundRow[] {
  const columnItems = allItems.filter((it) => {
    if (it.y >= opts.headingY) return false; // above/at heading: skip
    if (opts.side === "left") return it.x < opts.midX;
    return it.x >= opts.midX;
  });

  const lines = groupIntoLines(columnItems);

  const rows: CompoundRow[] = [];
  for (const line of lines) {
    const text = line.text;
    // Stop at disclaimer / footer
    if (text.startsWith("Méthode d'analyse") || text.startsWith("Ce certificat")) {
      break;
    }
    // Skip column header row "Abr. Nom du composé Teneur% U.M."
    if (text.startsWith("Abr.") || text.startsWith("Abr ")) continue;
    const row = parseCompoundLine(text);
    if (row) rows.push(row);
  }

  return rows;
}

/**
 * Parse a compound data row:  "<ABR> <NAME...> <VALUE> <UM>"
 *   VALUE ∈ { "ND", "<LOQ", number }
 *   UM    ∈ { "ND", number }
 *
 * Examples:
 *   "CBDV Cannabidivarin 0.03 0.01"
 *   "Δ9-THCV Δ9-tetrahydrocannabivarin ND ND"
 *   "BORN Borneol <LOQ ND"
 */
function parseCompoundLine(line: string): CompoundRow | null {
  const tokens = line.split(/\s+/);
  if (tokens.length < 4) return null;

  // Last two tokens are VALUE + UM (but <LOQ may have been split)
  let tail = tokens.slice(-2);
  let rest = tokens.slice(0, -2);

  // Guard: pdfjs sometimes splits "<LOQ" into "<" and "LOQ"
  if (tail[0] === "LOQ" && rest[rest.length - 1] === "<") {
    tail = ["<LOQ", tail[1]!];
    rest = rest.slice(0, -1);
  }

  if (rest.length < 2) return null;

  const valueToken = tail[0]!;
  const umToken = tail[1]!;

  const percentage = parseNumeric(valueToken);
  const flag =
    valueToken === "ND"
      ? "ND"
      : valueToken === "<LOQ" || valueToken.startsWith("<LOQ")
        ? "LOQ"
        : percentage === null
          ? // couldn't parse — not a data row
            null
          : "value";
  if (flag === null) return null;

  const uncertainty = parseNumeric(umToken);

  const abbreviation = rest[0]!;
  const name = rest.slice(1).join(" ");

  // Sanity: abbreviation should look like an abbreviation (no spaces, reasonable length)
  if (!abbreviation || abbreviation.length > 15) return null;
  if (!name) return null;

  return {
    abbreviation,
    name,
    percentage: flag === "value" ? percentage : null,
    flag,
    uncertainty,
  };
}

function parseNumeric(token: string): number | null {
  if (token === "ND" || token === "<LOQ") return null;
  const n = Number.parseFloat(token.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/* -------------------------------------------------------------------------- */
/* Metadata + totals                                                          */
/* -------------------------------------------------------------------------- */

function extractMetadata(h: {
  col1: string;
  col2: string;
  col3: string;
}): LabAnalysisMetadata {
  // Column 1 (left) holds the sample/product descriptors.
  const productDescription = matchFirst(
    h.col1,
    /Description\s+du\s+produit\s*:\s*(.+?)(?:\n|$)/i,
  );
  const serial = matchFirst(
    h.col1,
    /Num[ée]ro\s+de\s+s[ée]rie\s*:\s*(.+?)(?:\n|$)/i,
  );
  const sampleType = matchFirst(
    h.col1,
    /Type\s+d'[ée]chantillon\s*:\s*(.+?)(?:\n|$)/i,
  );
  const sfpCode = matchFirst(h.col1, /Code\s*SFP\s*:\s*([A-Z0-9-]+)/i);
  const receivedAt = matchFirst(
    h.col1,
    /Date\s+de\s+r[ée]ception\s+de\s+l'[ée]chantillon\s*:\s*(\d{4}-\d{2}-\d{2})/i,
  );

  // Column 2 (middle) holds the analysis metadata.
  const analysisNumber = matchFirst(
    h.col2,
    /No\.\s*d'analyse\s+([A-Z0-9-]+)/i,
  );
  const methodName = matchFirst(
    h.col2,
    /Nom\s+de\s+la\s+m[ée]thode\s*:\s*(.+?)(?:\n|$)/i,
  );
  const approvedAt = matchFirst(
    h.col2,
    /Date\s+d'approbation\s*:\s*(\d{4}-\d{2}-\d{2})/i,
  );

  return {
    analysisNumber,
    sfpCode,
    serial,
    productDescription,
    sampleType,
    receivedAt,
    approvedAt,
    methodName,
    labName: LAB_NAME,
  };
}

/**
 * Terpene total. The SFP header contains several totals (THC/CBD/CBG/
 * cannabinoids) but the POC scope now only keeps the "Total des terpènes%"
 * value. It's a single-line label so extraction is straightforward.
 */
function extractTotals(headerItems: TextItem[]): LabAnalysisTotals {
  const lines = groupIntoLines(headerItems);
  for (const line of lines) {
    if (!/Total\s+des\s+terp[eè]nes\s*%/i.test(line.text)) continue;
    const num = lastNumber(line.text);
    if (num !== null) return { terpenesTotal: num };
  }
  return { terpenesTotal: null };
}

/* -------------------------------------------------------------------------- */
/* Small utils                                                                */
/* -------------------------------------------------------------------------- */

function matchFirst(text: string, re: RegExp): string | null {
  const m = re.exec(text);
  return m?.[1]?.trim() ?? null;
}

function lastNumber(s: string): number | null {
  const matches = s.match(/-?\d+(?:[.,]\d+)?/g);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1]!;
  const n = Number.parseFloat(last.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
