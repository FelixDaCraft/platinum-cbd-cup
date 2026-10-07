import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

import { assertMayJoinPanel, assertProducerMayJudge, assertSamePanel } from "../jury";

/**
 * Règle métier : c'est le fait de CONCOURIR qui empêche de juger, et la portée
 * dépend du panel rejoint. Une cup réunit un jury pro et un jury public ; la
 * porte d'entrée fixe le panel (invitation -> pro, code ou QR -> public).
 *
 *   - panel `public` : le jury est composé de consommateurs, un producteur
 *     inscrit n'y a pas sa place ;
 *   - panel `pro` : l'organisation compose le panel à la main et veille
 *     elle-même à ce que personne ne juge une catégorie où il concourt — le
 *     code ne doit surtout pas l'en empêcher.
 *
 * Un utilisateur n'a qu'un panel par cup : rejoindre l'autre est refusé.
 */

type Ligne = { id: string } | undefined;

function faireDb(options: {
  profilProducteur?: Ligne;
  inscription?: Ligne;
  panelActuel?: "pro" | "public";
}) {
  return {
    query: {
      producers: {
        findFirst: vi.fn().mockResolvedValue(options.profilProducteur),
      },
      registrations: {
        findFirst: vi.fn().mockResolvedValue(options.inscription),
      },
      cupJuries: {
        findFirst: vi.fn().mockResolvedValue(
          options.panelActuel ? { panel: options.panelActuel } : undefined
        ),
      },
    },
  } as unknown as Parameters<typeof assertProducerMayJudge>[0];
}

const PRODUCTEUR = { id: "prod-1" };
const INSCRIPTION = { id: "insc-1" };

describe("assertProducerMayJudge", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("panel pro", () => {
    it("laisse passer un producteur qui concourt à cette édition", async () => {
      const db = faireDb({ profilProducteur: PRODUCTEUR, inscription: INSCRIPTION });

      await expect(
        assertProducerMayJudge(db, "user-1", "cup-1", "pro")
      ).resolves.toBeUndefined();
    });

    it("n'interroge même pas les inscriptions : le panel suffit à conclure", async () => {
      const db = faireDb({ profilProducteur: PRODUCTEUR });

      await assertProducerMayJudge(db, "user-1", "cup-1", "pro");

      // Sans cette sortie anticipée, on paierait deux requêtes pour rien sur
      // un chemin d'activation déjà bavard.
      expect(db.query.producers.findFirst).not.toHaveBeenCalled();
      expect(db.query.registrations.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("panel public", () => {
    it("refuse un producteur qui concourt à cette édition", async () => {
      const db = faireDb({ profilProducteur: PRODUCTEUR, inscription: INSCRIPTION });

      await expect(
        assertProducerMayJudge(db, "user-1", "cup-1", "public")
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("laisse passer un profil producteur vide, sans aucune inscription", async () => {
      // Une inscription publique crée une ligne `producers` avant tout dépôt
      // de produit : six comptes de ce genre sont déjà jurés publics en
      // production. Les exclure sur la seule existence de la ligne les
      // écarterait à tort.
      const db = faireDb({ profilProducteur: PRODUCTEUR, inscription: undefined });

      await expect(
        assertProducerMayJudge(db, "user-1", "cup-1", "public")
      ).resolves.toBeUndefined();
    });

    it("laisse passer un compte sans profil producteur", async () => {
      const db = faireDb({ profilProducteur: undefined });

      await expect(
        assertProducerMayJudge(db, "user-1", "cup-1", "public")
      ).resolves.toBeUndefined();
      expect(db.query.registrations.findFirst).not.toHaveBeenCalled();
    });

    it("porte un message qui dit au juré pourquoi il est refusé", async () => {
      const db = faireDb({ profilProducteur: PRODUCTEUR, inscription: INSCRIPTION });

      const erreur = await assertProducerMayJudge(db, "user-1", "cup-1", "public").catch(
        (e: unknown) => e
      );

      expect(erreur).toBeInstanceOf(TRPCError);
      expect((erreur as TRPCError).message).toMatch(/jury public/i);
    });
  });
});

describe("assertSamePanel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("laisse entrer un utilisateur qui n'est pas encore juré de la cup", async () => {
    const db = faireDb({});
    await expect(assertSamePanel(db, "user-1", "cup-1", "public")).resolves.toBeUndefined();
  });

  it("laisse un juré public reprendre un code public (catégories supplémentaires)", async () => {
    const db = faireDb({ panelActuel: "public" });
    await expect(assertSamePanel(db, "user-1", "cup-1", "public")).resolves.toBeUndefined();
  });

  it("refuse à un juré pro d'entrer aussi dans le jury public", async () => {
    const db = faireDb({ panelActuel: "pro" });
    await expect(assertSamePanel(db, "user-1", "cup-1", "public")).rejects.toMatchObject({
      code: "CONFLICT",
      message: expect.stringMatching(/déjà juré professionnel/),
    });
  });

  it("refuse à un juré public d'accepter une invitation au jury pro", async () => {
    const db = faireDb({ panelActuel: "public" });
    await expect(assertSamePanel(db, "user-1", "cup-1", "pro")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});

describe("assertMayJoinPanel", () => {
  it("applique le panel unique avant le conflit d'intérêts", async () => {
    const db = faireDb({
      panelActuel: "pro",
      profilProducteur: PRODUCTEUR,
      inscription: INSCRIPTION,
    });

    await expect(assertMayJoinPanel(db, "user-1", "cup-1", "public")).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });
});
