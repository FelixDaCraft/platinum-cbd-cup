/**
 * Standalone validation script for the lab analysis parser.
 * Run with: pnpm tsx scripts/test-lab-parser.ts
 *
 * Checks each sample PDF in tmp/lab-samples against the expected values
 * observed in the source documents. Terpenes only — cannabinoids were
 * intentionally dropped from the POC scope.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseLabAnalysisPdf } from "../src/server/services/lab-analysis/parser";

type Expected = {
  file: string;
  analysisNumber: string;
  sfpCode: string;
  serial: string;
  terpenesTotal: number;
  terpeneRows: number;
  topTerpene: { abbreviation: string; percentage: number };
};

const EXPECTED: Expected[] = [
  {
    file: "sample1.pdf",
    analysisNumber: "A17072-2",
    sfpCode: "V15760",
    serial: "GREENHOUSE #17",
    terpenesTotal: 1.77,
    terpeneRows: 19,
    topTerpene: { abbreviation: "BCARY", percentage: 0.55 },
  },
  {
    file: "sample2.pdf",
    analysisNumber: "A17073-2",
    sfpCode: "V15761",
    serial: "GREENHOUSE #18",
    terpenesTotal: 2.2,
    terpeneRows: 19,
    topTerpene: { abbreviation: "TERPI", percentage: 0.56 },
  },
];

const SAMPLES_DIR = path.resolve(process.cwd(), "tmp", "lab-samples");

let failures = 0;

function check(label: string, ok: boolean, detail?: string) {
  const mark = ok ? "  ✓" : "  ✗";
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function run() {
  for (const exp of EXPECTED) {
    console.log(`\n▶  ${exp.file}`);
    const buf = await readFile(path.join(SAMPLES_DIR, exp.file));
    const parsed = await parseLabAnalysisPdf(buf);

    check(
      `analysisNumber = ${exp.analysisNumber}`,
      parsed.metadata.analysisNumber === exp.analysisNumber,
      `got ${parsed.metadata.analysisNumber}`,
    );
    check(
      `sfpCode = ${exp.sfpCode}`,
      parsed.metadata.sfpCode === exp.sfpCode,
      `got ${parsed.metadata.sfpCode}`,
    );
    check(
      `serial = ${exp.serial}`,
      parsed.metadata.serial === exp.serial,
      `got ${parsed.metadata.serial}`,
    );
    check(
      `terpenesTotal = ${exp.terpenesTotal}`,
      parsed.totals.terpenesTotal === exp.terpenesTotal,
      `got ${parsed.totals.terpenesTotal}`,
    );
    check(
      `terpene row count = ${exp.terpeneRows}`,
      parsed.terpenes.length === exp.terpeneRows,
      `got ${parsed.terpenes.length}`,
    );

    const top = parsed.terpenes[0];
    check(
      `top terpene = ${exp.topTerpene.abbreviation} (${exp.topTerpene.percentage}%)`,
      top?.abbreviation === exp.topTerpene.abbreviation &&
        top?.percentage === exp.topTerpene.percentage,
      `got ${top?.abbreviation} (${top?.percentage}%)`,
    );

    const computed = parsed.computedTerpeneSum;
    const reported = parsed.totals.terpenesTotal ?? 0;
    const delta = Math.abs(computed - reported);
    check(
      `sum(terpenes) ≈ terpenesTotal (±0.15)`,
      delta <= 0.15,
      `computed ${computed}, reported ${reported}, delta ${delta.toFixed(3)}`,
    );

    console.log(`\n  metadata:`);
    console.dir(parsed.metadata, { depth: null });
    console.log(`  totals:`, parsed.totals);
    console.log(`  top 3 terpenes:`);
    parsed.terpenes.slice(0, 3).forEach((t) => {
      console.log(
        `    - ${t.abbreviation.padEnd(8)} ${t.name.padEnd(25)} ${t.percentage}%`,
      );
    });
  }

  console.log(
    `\n${failures === 0 ? "✅ ALL CHECKS PASSED" : `❌ ${failures} CHECK(S) FAILED`}`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

run().catch((err) => {
  console.error("\n❌ Parser threw:", err);
  process.exit(1);
});
