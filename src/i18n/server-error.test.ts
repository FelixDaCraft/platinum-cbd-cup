import { describe, expect, it, vi } from "vitest";

vi.mock("next-intl", () => ({ useLocale: () => "fr", useTranslations: () => (k: string) => k }));

const { matchServerMessage, translateServerError } = await import("./server-error");

const t = (key: string, values?: Record<string, string | number>) =>
  values ? `${key}(${JSON.stringify(values)})` : key;

describe("matchServerMessage", () => {
  it("reconnaît un message avec ou sans accents", () => {
    expect(matchServerMessage("Cup non trouvee")?.key).toBe("cupNotFound");
    expect(matchServerMessage("Cup non trouvée")?.key).toBe("cupNotFound");
  });

  it("extrait les variables d'un message paramétré en gardant les accents", () => {
    expect(matchServerMessage("La catégorie « Fleurs Indoor » est complète.")).toEqual({
      key: "quotaFull",
      values: { category: "Fleurs Indoor" },
    });
    expect(
      matchServerMessage("Il ne reste que 2 place(s) dans la catégorie « Dry Hash ».")
    ).toEqual({ key: "quotaRemaining", values: { remaining: 2, category: "Dry Hash" } });
  });
});

describe("translateServerError", () => {
  const err = (message: string, code = "BAD_REQUEST") => ({ message, data: { code } });

  it("traduit un message répertorié", () => {
    expect(translateServerError(err("Ce code a expiré"), { t, locale: "en" })).toBe("codeExpired");
  });

  it("en français, garde un message métier non répertorié", () => {
    expect(translateServerError(err("Message métier inédit"), { t, locale: "fr" })).toBe(
      "Message métier inédit"
    );
  });

  it("dans une autre langue, remplace un message français inconnu par le générique du code", () => {
    expect(translateServerError(err("Message métier inédit", "CONFLICT"), { t, locale: "de" })).toBe(
      "codes.CONFLICT"
    );
  });

  it("n'affiche jamais une panne interne ni une erreur zod", () => {
    expect(
      translateServerError(err("relation x does not exist", "INTERNAL_SERVER_ERROR"), { t, locale: "fr" })
    ).toBe("codes.INTERNAL_SERVER_ERROR");
    expect(
      translateServerError({ message: "x", data: { code: "BAD_REQUEST", zodError: {} } }, { t, locale: "fr" })
    ).toBe("codes.BAD_REQUEST");
  });
});
