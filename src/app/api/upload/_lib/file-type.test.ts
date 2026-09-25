import { describe, expect, it } from "vitest";

import { sniffType } from "./file-type";

const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
]);
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const webp = Buffer.concat([
  Buffer.from("RIFF", "ascii"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from("WEBPVP8 ", "ascii"),
]);

describe("sniffType", () => {
  it("identifies the formats the upload routes accept", () => {
    expect(sniffType(png)).toBe("png");
    expect(sniffType(jpeg)).toBe("jpeg");
    expect(sniffType(webp)).toBe("webp");
    expect(sniffType(Buffer.from("GIF89a....", "ascii"))).toBe("gif");
    expect(sniffType(Buffer.from("%PDF-1.7\n...", "ascii"))).toBe("pdf");
    expect(sniffType(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14]))).toBe("zip");
    expect(sniffType(Buffer.from("Rar!\x1a\x07\x00", "binary"))).toBe("rar");
    expect(
      sniffType(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]))
    ).toBe("7z");
  });

  it("accepts SVG only when the document really starts with an SVG root", () => {
    expect(sniffType(Buffer.from('<svg xmlns="x"></svg>'))).toBe("svg");
    expect(sniffType(Buffer.from('﻿\n  <?xml version="1.0"?><svg/>'))).toBe(
      "svg"
    );
    expect(sniffType(Buffer.from("<html><body>hi</body></html>"))).toBeNull();
  });

  it("rejects content that only pretends to be an accepted type", () => {
    // A PHP/HTML payload named logo.png with Content-Type: image/png
    expect(sniffType(Buffer.from("<?php system($_GET[0]); ?>"))).toBeNull();
    expect(sniffType(Buffer.from("not a pdf at all"))).toBeNull();
    expect(sniffType(Buffer.alloc(0))).toBeNull();
    // Truncated PNG signature must not pass
    expect(sniffType(Buffer.from([0x89, 0x50, 0x4e]))).toBeNull();
  });
});
