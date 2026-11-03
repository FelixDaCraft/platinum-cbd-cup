import { describe, expect, it } from "vitest";
import { emailLocale } from "./locale";

describe("emailLocale", () => {
  const verify = (cb: string) =>
    `https://platinumcbdcup.eu/api/auth/verify-email?token=x&callbackURL=${encodeURIComponent(cb)}`;

  it("suit la langue de la page d'où part la demande", () => {
    expect(emailLocale({ url: verify("/de/login"), cookieHeader: "NEXT_LOCALE=it" })).toBe("de");
    expect(emailLocale({ url: verify("https://platinumcbdcup.eu/cs/producer") })).toBe("cs");
  });

  it("une URL de retour française sans préfixe donne le français", () => {
    expect(emailLocale({ url: verify("/login"), stored: "es" })).toBe("fr");
  });

  it("lit redirectTo pour la réinitialisation du mot de passe", () => {
    const url = "https://x/api/auth/reset-password/tok?redirectTo=%2Fnl%2Freset-password";
    expect(emailLocale({ url })).toBe("nl");
  });

  it("sans URL de retour : cookie, puis compte, puis navigateur", () => {
    const url = "https://x/api/auth/verify-email?token=x";
    expect(emailLocale({ url, cookieHeader: "a=1; NEXT_LOCALE=es; b=2" })).toBe("es");
    expect(emailLocale({ url, cookieHeader: "NEXT_LOCALE=zz", stored: "it" })).toBe("it");
    expect(emailLocale({ url, acceptLanguage: "de-AT,de;q=0.9" })).toBe("de");
    expect(emailLocale({ url })).toBe("fr");
  });
});
