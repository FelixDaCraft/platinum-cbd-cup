import { describe, expect, it } from "vitest";
import { publicCommentsForDisplay } from "./public-comments";

describe("publicCommentsForDisplay", () => {
  it("nettoie, retire les vides et les doublons, et trie", () => {
    expect(
      publicCommentsForDisplay(["  Zeste net ", null, "   ", "Arôme puissant", "Zeste net", undefined])
    ).toEqual(["Arôme puissant", "Zeste net"]);
  });

  it("renvoie une liste vide sans commentaire", () => {
    expect(publicCommentsForDisplay([])).toEqual([]);
  });
});
