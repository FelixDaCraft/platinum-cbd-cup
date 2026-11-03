import { describe, expect, it } from "vitest";
import { translateValidation, validationKey } from "./validation";
import { catalog } from "../../messages";

describe("translateValidation", () => {
  const t = (key: string) => `[${key}]`;

  it("traduit un message Zod connu", () => {
    expect(translateValidation("Format d'email invalide", t)).toBe("[emailInvalid]");
  });

  it("laisse un message inconnu tel quel", () => {
    expect(translateValidation("Autre chose", t)).toBe("Autre chose");
    expect(translateValidation(undefined, t)).toBe("");
  });

  it("chaque clé de la table existe dans l'espace de messages validation", () => {
    const fr = (catalog as unknown as Record<string, Record<string, Record<string, unknown>>>)
      .validation!.fr!;
    for (const message of [
      "L'email est requis",
      "Format d'email invalide",
      "Le mot de passe est requis",
      "Le mot de passe doit contenir au moins 12 caractères",
      "Les mots de passe ne correspondent pas",
      "Confirmez votre mot de passe",
    ]) {
      expect(fr[validationKey(message)!], message).toBeTypeOf("string");
    }
  });
});
