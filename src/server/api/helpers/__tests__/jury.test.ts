import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

import { assertProducerMayJudge } from "../jury";

/**
 * Règle métier : c'est le fait de CONCOURIR qui empêche de juger, et la portée
 * dépend du type d'édition.
 *
 *   - édition `public` : le jury est composé de consommateurs, un producteur
 *     inscrit n'y a pas sa place ;
 *   - édition `pro` : l'organisation compose le panel à la main et veille
 *     elle-même à ce que personne ne juge une catégorie où il concourt — le
 *     code ne doit surtout pas l'en empêcher.
 *
 * Le contrôle portait auparavant sur l'édition entière, sans regarder le type :
 * un producteur invité à un jury pro voyait son invitation refusée.
 */

type Ligne = { id: string } | undefined;

function faireDb(options: {
  typeEdition?: "pro" | "public";
  profilProducteur?: Ligne;
  inscription?: Ligne;
}) {
  return {
    query: {
      cups: {
        findFirst: vi.fn().mockResolvedValue(
          options.typeEdition ? { type: options.typeEdition } : undefined
        ),
      },
      producers: {
        findFirst: vi.fn().mockResolvedValue(options.profilProducteur),
      },
      registrations: {
        findFirst: vi.fn().mockResolvedValue(options.inscription),
      },
    },
  } as unknown as Parameters<typeof assertProducerMayJudge>[0];
}

const PRODUCTEUR = { id: "prod-1" };
const INSCRIPTION = { id: "insc-1" };

describe("assertProducerMayJudge", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("édition à jury professionnel", () => {
    it("laisse passer un producteur qui concourt à cette édition", async () => {
      const db = faireDb({
        typeEdition: "pro",
        profilProducteur: PRODUCTEUR,
        inscription: INSCRIPTION,
      });

      await expect(
        assertProducerMayJudge(db, "user-1", "cup-pro")
      ).resolves.toBeUndefined();
    });

    it("n'interroge même pas les inscriptions : le type suffit à conclure", async () => {
      const db = faireDb({ typeEdition: "pro", profilProducteur: PRODUCTEUR });

      await assertProducerMayJudge(db, "user-1", "cup-pro");

      // Sans cette sortie anticipée, on paierait deux requêtes pour rien sur
      // un chemin d'activation déjà bavard.
      expect(db.query.producers.findFirst).not.toHaveBeenCalled();
      expect(db.query.registrations.findFirst).not.toHaveBeenCalled();
    });
  });

  describe("édition à jury public", () => {
    it("refuse un producteur qui concourt à cette édition", async () => {
      const db = faireDb({
        typeEdition: "public",
        profilProducteur: PRODUCTEUR,
        inscription: INSCRIPTION,
      });

      await expect(
        assertProducerMayJudge(db, "user-1", "cup-public")
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("laisse passer un profil producteur vide, sans aucune inscription", async () => {
      // Une inscription publique crée une ligne `producers` avant tout dépôt
      // de produit : six comptes de ce genre sont déjà jurés publics en
      // production. Les exclure sur la seule existence de la ligne les
      // écarterait à tort.
      const db = faireDb({
        typeEdition: "public",
        profilProducteur: PRODUCTEUR,
        inscription: undefined,
      });

      await expect(
        assertProducerMayJudge(db, "user-1", "cup-public")
      ).resolves.toBeUndefined();
    });

    it("laisse passer un compte sans profil producteur", async () => {
      const db = faireDb({ typeEdition: "public", profilProducteur: undefined });

      await expect(
        assertProducerMayJudge(db, "user-1", "cup-public")
      ).resolves.toBeUndefined();
      expect(db.query.registrations.findFirst).not.toHaveBeenCalled();
    });

    it("porte un message qui dit au juré pourquoi il est refusé", async () => {
      const db = faireDb({
        typeEdition: "public",
        profilProducteur: PRODUCTEUR,
        inscription: INSCRIPTION,
      });

      const erreur = await assertProducerMayJudge(db, "user-1", "cup-public").catch(
        (e: unknown) => e
      );

      expect(erreur).toBeInstanceOf(TRPCError);
      expect((erreur as TRPCError).message).toMatch(/jury public/i);
    });
  });

  it("ne bloque pas quand l'édition est introuvable : le refus vient d'ailleurs", async () => {
    // Les appelants ont déjà vérifié l'existence de l'édition et du jeton ;
    // ce garde-fou n'a pas à produire un second message pour le même défaut.
    const db = faireDb({ profilProducteur: PRODUCTEUR, inscription: INSCRIPTION });

    await expect(
      assertProducerMayJudge(db, "user-1", "cup-inconnue")
    ).resolves.toBeUndefined();
  });
});
