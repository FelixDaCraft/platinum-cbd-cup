/**
 * Cup Import Router
 * Handles CSV import for producers, products, and jurys
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, inArray, max } from "drizzle-orm";
import { nanoid } from "nanoid";
import { createTRPCRouter, organizerProcedure } from "~/server/api/trpc";
import { auth } from "~/lib/auth";
import type { db as Database } from "~/server/db";
import * as schema from "~/server/db/schema";
import { generateId } from "~/server/db/schema/id";
import { sendBulkInvitations } from "~/server/services/jury-invitation.service";
import { generateAnonymousCode as generateAnonymousCodeFromService } from "~/server/services/anonymization.service";

/** Ligne d'import rejetée, renvoyée au client pour reprise manuelle. */
interface ImportFailure {
  row: number;
  identifier: string;
  reason: string;
}

/** Page d'atterrissage du lien de définition de mot de passe. */
const PASSWORD_SETUP_REDIRECT = "/reset-password";

/**
 * Envoie à un producteur importé le lien qui lui permet de définir son mot de
 * passe, seul moyen d'activer un compte créé par CSV : celui-ci n'a ni ligne
 * `accounts` ni adresse vérifiée. `onPasswordReset` (lib/auth.ts) marque
 * l'adresse vérifiée à l'ouverture du lien, ce qui évite au producteur
 * d'enchaîner « mot de passe oublié » puis « vérifier mon email » sans que
 * rien ne le lui ait expliqué.
 *
 * On passe par Better Auth plutôt que par un email maison : lui seul sait
 * émettre un jeton de réinitialisation valide.
 */
async function sendAccountSetupEmail(email: string): Promise<void> {
  await auth.api.requestPasswordReset({
    body: { email, redirectTo: PASSWORD_SETUP_REDIRECT },
  });
}

/**
 * Producteurs inscrits à une cup dont le compte ne possède aucun moyen de
 * connexion : pas de ligne `accounts`, donc ni mot de passe ni fournisseur
 * externe. C'est la signature exacte d'un compte créé par import CSV.
 */
async function findProducersWithoutCredentials(
  db: typeof Database,
  cupId: string
): Promise<{ userId: string; email: string }[]> {
  const rows = await db
    .select({ userId: schema.users.id, email: schema.users.email })
    .from(schema.registrations)
    .innerJoin(
      schema.producers,
      eq(schema.registrations.producerId, schema.producers.id)
    )
    .innerJoin(schema.users, eq(schema.producers.userId, schema.users.id))
    .where(eq(schema.registrations.cupId, cupId));

  if (rows.length === 0) return [];

  const activated = await db
    .select({ userId: schema.accounts.userId })
    .from(schema.accounts)
    .where(
      inArray(
        schema.accounts.userId,
        rows.map((r) => r.userId)
      )
    );

  const activatedIds = new Set(activated.map((a) => a.userId));

  // Un même producteur peut avoir plusieurs inscriptions sur la cup : on ne
  // veut lui envoyer qu'un seul email.
  const seen = new Set<string>();
  const pending: { userId: string; email: string }[] = [];

  for (const row of rows) {
    if (activatedIds.has(row.userId) || seen.has(row.userId)) continue;
    seen.add(row.userId);
    pending.push(row);
  }

  return pending;
}

// Types for preview rows
interface PreviewRow {
  index: number;
  data: Record<string, string>;
  status: "valid" | "invalid" | "warning";
  error?: string;
}

/**
 * Parse CSV content into rows
 */
function parseCSVContent(csvContent: string): { headers: string[]; rows: string[][] } {
  const lines = csvContent.trim().split(/\r?\n/);
  if (lines.length < 1) {
    throw new Error("Le fichier CSV est vide");
  }

  const firstLine = lines[0] ?? "";
  const separator = firstLine.includes(";") ? ";" : ",";
  const headers = firstLine.split(separator).map((h) => h.trim().toLowerCase());

  const rows: string[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;

    const values: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === separator && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    rows.push(values);
  }

  return { headers, rows };
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export const cupImportRouter = createTRPCRouter({
  /**
   * Get categories for a cup (for import validation display)
   */
  getCategoriesForCup: organizerProcedure
    .input(z.object({ cupId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const categories = await ctx.db.query.categories.findMany({
        where: eq(schema.categories.cupId, input.cupId),
        orderBy: (cat, { asc }) => [asc(cat.sortOrder)],
      });

      return categories;
    }),

  /**
   * Get producers for a cup (for import validation display)
   *
   * Ne renvoie aucune donnée de contact : l'appariement des lignes du CSV avec
   * les producteurs se fait côté serveur dans `parseProductsCSV`, et l'écran
   * d'import ne consomme que le nombre de producteurs. Exposer ici les emails
   * (et, via un `with` non filtré, le SIRET, le téléphone et l'adresse) serait
   * la même fuite que celle fermée côté inscriptions.
   */
  getProducersForCup: organizerProcedure
    .input(z.object({ cupId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const registrations = await ctx.db.query.registrations.findMany({
        where: eq(schema.registrations.cupId, input.cupId),
        columns: { id: true },
        with: {
          producer: {
            columns: {
              id: true,
              companyName: true,
              brandName: true,
            },
          },
        },
      });

      return registrations.map((r) => ({
        id: r.producer.id,
        companyName: r.producer.companyName,
        brandName: r.producer.brandName,
      }));
    }),

  /**
   * Parse and validate producers CSV
   */
  parseProducersCSV: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        csvContent: z.string().min(1, "Contenu CSV requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cup non trouvee" });
      }

      const { headers, rows } = parseCSVContent(input.csvContent);

      const requiredHeaders = ["nom", "email"];
      const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
      if (missingHeaders.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Colonnes manquantes: ${missingHeaders.join(", ")}`,
        });
      }

      // All producers with their user email
      const existingProducers = await ctx.db.query.producers.findMany({
        with: {
          user: {
            columns: { email: true },
          },
        },
      });
      const existingEmails = new Set(existingProducers.map((p) => p.user.email.toLowerCase()));

      const headerIndices = {
        nom: headers.indexOf("nom"),
        email: headers.indexOf("email"),
        entreprise: headers.indexOf("entreprise"),
        telephone: headers.indexOf("telephone"),
        adresse: headers.indexOf("adresse"),
      };

      const previewRows: PreviewRow[] = [];
      const seenEmails = new Set<string>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const data: Record<string, string> = {};

        if (headerIndices.nom >= 0) data.nom = row[headerIndices.nom] ?? "";
        if (headerIndices.email >= 0) data.email = row[headerIndices.email] ?? "";
        if (headerIndices.entreprise >= 0) data.entreprise = row[headerIndices.entreprise] ?? "";
        if (headerIndices.telephone >= 0) data.telephone = row[headerIndices.telephone] ?? "";
        if (headerIndices.adresse >= 0) data.adresse = row[headerIndices.adresse] ?? "";

        let status: PreviewRow["status"] = "valid";
        let error: string | undefined;

        if (!data.nom?.trim()) {
          status = "invalid";
          error = "Nom requis";
        } else if (!data.email?.trim()) {
          status = "invalid";
          error = "Email requis";
        } else if (!isValidEmail(data.email)) {
          status = "invalid";
          error = "Email invalide";
        } else if (seenEmails.has(data.email.toLowerCase())) {
          status = "invalid";
          error = "Email duplique dans le fichier";
        } else if (existingEmails.has(data.email.toLowerCase())) {
          status = "warning";
          error = "Producteur existant — sera inscrit a la cup";
        }

        if (data.email) {
          seenEmails.add(data.email.toLowerCase());
        }

        previewRows.push({ index: i, data, status, error });
      }

      return { rows: previewRows };
    }),

  /**
   * Import producers from validated data
   */
  importProducers: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        producers: z.array(
          z.object({
            nom: z.string().min(1),
            email: z.string().email(),
            entreprise: z.string().nullable(),
            telephone: z.string().nullable(),
            adresse: z.string().nullable(),
          })
        ),
        /**
         * Envoie à chaque compte créé le lien de définition de mot de passe.
         * Sans lui, le producteur importé n'a aucun moyen documenté de se
         * connecter à son espace (inscriptions, factures, résultats).
         */
        sendInvites: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cup non trouvee" });
      }

      let imported = 0;
      let invitesSent = 0;
      const failures: ImportFailure[] = [];

      for (const [index, producer] of input.producers.entries()) {
        try {
          // Une transaction par ligne : une ligne en échec ne doit pas laisser
          // un user sans producteur ni un producteur sans inscription.
          const outcome = await ctx.db.transaction(async (tx) => {
            let user = await tx.query.users.findFirst({
              where: eq(schema.users.email, producer.email.toLowerCase()),
            });

            const userCreated = !user;

            if (!user) {
              // `generateId` plutôt que `nanoid` : la table `users` appartient
              // à Better Auth, qui pose lui-même les identifiants des comptes
              // créés par le formulaire d'inscription. L'import CSV écrit la
              // ligne directement ; il doit produire le format garanti par le
              // schéma, pas celui d'un paquet tiers susceptible d'évoluer.
              const userId = generateId();
              const [inserted] = await tx
                .insert(schema.users)
                .values({
                  id: userId,
                  email: producer.email.toLowerCase(),
                  name: producer.nom,
                  emailVerified: false,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                })
                .returning();
              user = inserted;
            }

            if (!user) {
              throw new Error("Impossible de créer le compte utilisateur");
            }

            // Check if producer profile already exists for this user
            const existingProducer = await tx.query.producers.findFirst({
              where: eq(schema.producers.userId, user.id),
            });

            let producerId: string;

            if (existingProducer) {
              producerId = existingProducer.id;
            } else {
              producerId = nanoid();
              await tx.insert(schema.producers).values({
                id: producerId,
                userId: user.id,
                companyName: producer.entreprise ?? producer.nom,
                brandName: producer.nom,
                phone: producer.telephone,
                address: producer.adresse,
              });
            }

            // Check if already registered for this cup
            const existingRegistration = await tx.query.registrations.findFirst({
              where: and(
                eq(schema.registrations.cupId, input.cupId),
                eq(schema.registrations.producerId, producerId)
              ),
            });

            if (existingRegistration) {
              return { registered: false, userCreated, email: user.email };
            }

            await tx.insert(schema.registrations).values({
              id: nanoid(),
              cupId: input.cupId,
              producerId,
              status: "confirmed",
              totalAmount: 0,
            });

            return { registered: true, userCreated, email: user.email };
          });

          if (outcome.registered) imported++;

          // Hors transaction : un envoi Resend en échec ne doit pas annuler
          // l'import de la ligne, il est simplement signalé à l'organisateur.
          if (input.sendInvites && outcome.userCreated) {
            try {
              await sendAccountSetupEmail(outcome.email);
              invitesSent++;
            } catch (e) {
              // Le numéro de ligne suffit à l'organisateur pour retrouver le
              // producteur dans son CSV. L'adresse elle-même reste hors du
              // journal : les logs Docker ne sont ni chiffrés ni purgés, y
              // écrire une donnée personnelle la rend indéracinable (RGPD).
              console.error(`[Import] Envoi du lien d'activation en echec (ligne ${index + 1}):`, e);
              failures.push({
                row: index + 1,
                identifier: producer.email,
                reason: `Compte créé, mais email d'activation non envoyé : ${
                  e instanceof Error ? e.message : "erreur inconnue"
                }`,
              });
            }
          }
        } catch (e) {
          // Même raison : la ligne fautive est identifiée par son rang, pas
          // par l'adresse du producteur. Celle-ci repart à l'organisateur
          // dans `failures`, où elle lui est utile et reste éphémère.
          console.error(`[Import] Ligne ${index + 1} non importee:`, e);
          failures.push({
            row: index + 1,
            identifier: producer.email,
            reason: e instanceof Error ? e.message : "Erreur inconnue",
          });
        }
      }

      return { imported, errors: failures.length, failures, invitesSent };
    }),

  /**
   * Compte les producteurs inscrits à une cup dont le compte n'a jamais été
   * activé (aucune ligne `accounts`), c'est-à-dire ceux qui ne peuvent pas se
   * connecter. Alimente le bouton de relance ci-dessous.
   */
  countPendingProducerAccounts: organizerProcedure
    .input(z.object({ cupId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const pending = await findProducersWithoutCredentials(ctx.db, input.cupId);
      return { pending: pending.length };
    }),

  /**
   * (Re)envoie le lien d'activation aux producteurs importés qui n'ont pas
   * encore de moyen de connexion.
   *
   * Les 68 producteurs déjà en base ont été créés avant l'envoi automatique :
   * cette mutation est leur rattrapage. Elle est idempotente — un producteur
   * qui a défini son mot de passe n'est plus dans la liste.
   */
  sendProducerAccountSetup: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1),
        // Resend limite le débit : on envoie par paquets plutôt que de laisser
        // une requête de plusieurs minutes se faire couper en cours de route.
        batchSize: z.number().int().min(1).max(50).default(25),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const pending = await findProducersWithoutCredentials(ctx.db, input.cupId);
      const batch = pending.slice(0, input.batchSize);

      let sent = 0;
      const failures: { email: string; reason: string }[] = [];

      for (const producer of batch) {
        try {
          await sendAccountSetupEmail(producer.email);
          sent++;
        } catch (e) {
          // `userId` plutôt que l'adresse : identifiant technique suffisant
          // pour enquêter, et qui ne fait pas du journal un fichier de
          // données personnelles.
          console.error(`[Import] Relance d'activation en echec (user ${producer.userId}):`, e);
          failures.push({
            email: producer.email,
            reason: e instanceof Error ? e.message : "Erreur inconnue",
          });
        }
      }

      return {
        sent,
        errors: failures.length,
        failures,
        remaining: Math.max(0, pending.length - batch.length),
      };
    }),

  /**
   * Parse and validate products CSV
   */
  parseProductsCSV: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        csvContent: z.string().min(1, "Contenu CSV requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cup non trouvee" });
      }

      const { headers, rows } = parseCSVContent(input.csvContent);

      const requiredHeaders = ["nom", "producteur_email", "categorie"];
      const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
      if (missingHeaders.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Colonnes manquantes: ${missingHeaders.join(", ")}`,
        });
      }

      const categories = await ctx.db.query.categories.findMany({
        where: eq(schema.categories.cupId, input.cupId),
      });
      const categoryNames = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

      const registrations = await ctx.db.query.registrations.findMany({
        where: eq(schema.registrations.cupId, input.cupId),
        with: {
          producer: {
            with: {
              user: { columns: { email: true } },
            },
          },
        },
      });
      const producerByEmail = new Map(
        registrations.map((r) => [r.producer.user.email.toLowerCase(), r])
      );

      const headerIndices = {
        nom: headers.indexOf("nom"),
        producteur_email: headers.indexOf("producteur_email"),
        categorie: headers.indexOf("categorie"),
        description: headers.indexOf("description"),
        thc: headers.indexOf("thc"),
        cbd: headers.indexOf("cbd"),
      };

      const previewRows: PreviewRow[] = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const data: Record<string, string> = {};

        if (headerIndices.nom >= 0) data.nom = row[headerIndices.nom] ?? "";
        if (headerIndices.producteur_email >= 0)
          data.producteur_email = row[headerIndices.producteur_email] ?? "";
        if (headerIndices.categorie >= 0) data.categorie = row[headerIndices.categorie] ?? "";
        if (headerIndices.description >= 0) data.description = row[headerIndices.description] ?? "";
        if (headerIndices.thc >= 0) data.thc = row[headerIndices.thc] ?? "";
        if (headerIndices.cbd >= 0) data.cbd = row[headerIndices.cbd] ?? "";

        let status: PreviewRow["status"] = "valid";
        let error: string | undefined;

        if (!data.nom?.trim()) {
          status = "invalid";
          error = "Nom requis";
        } else if (!data.producteur_email?.trim()) {
          status = "invalid";
          error = "Email producteur requis";
        } else if (!isValidEmail(data.producteur_email)) {
          status = "invalid";
          error = "Email producteur invalide";
        } else if (!producerByEmail.has(data.producteur_email.toLowerCase())) {
          status = "invalid";
          error = "Producteur non trouve";
        } else if (!data.categorie?.trim()) {
          status = "invalid";
          error = "Categorie requise";
        } else if (!categoryNames.has(data.categorie.toLowerCase())) {
          status = "warning";
          error = "Nouvelle categorie — sera creee a l'import";
        }

        previewRows.push({ index: i, data, status, error });
      }

      return { rows: previewRows };
    }),

  /**
   * Import products from validated data
   */
  importProducts: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        products: z.array(
          z.object({
            nom: z.string().min(1),
            producteur_email: z.string().email(),
            categorie: z.string().min(1),
            description: z.string().nullable(),
            thc: z.string().nullable(),
            cbd: z.string().nullable(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cup non trouvee" });
      }

      const categories = await ctx.db.query.categories.findMany({
        where: eq(schema.categories.cupId, input.cupId),
      });
      const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c]));

      const registrations = await ctx.db.query.registrations.findMany({
        where: eq(schema.registrations.cupId, input.cupId),
        with: {
          producer: {
            with: {
              user: { columns: { email: true } },
            },
          },
        },
      });
      const registrationByEmail = new Map(
        registrations.map((r) => [r.producer.user.email.toLowerCase(), r])
      );

      const createdCategories = new Map<string, typeof categories[0]>();

      const maxOrderResult = await ctx.db
        .select({ maxOrder: max(schema.categories.sortOrder) })
        .from(schema.categories)
        .where(eq(schema.categories.cupId, input.cupId));
      let nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

      let imported = 0;
      const failures: ImportFailure[] = [];

      for (const [index, product] of input.products.entries()) {
        const fail = (reason: string) =>
          failures.push({ row: index + 1, identifier: product.nom, reason });

        try {
          const registration = registrationByEmail.get(product.producteur_email.toLowerCase());

          if (!registration) {
            fail(`Aucune inscription pour ${product.producteur_email}`);
            continue;
          }

          const catKey = product.categorie.toLowerCase();
          const knownCategory = categoryByName.get(catKey) ?? createdCategories.get(catKey);

          let description = product.description ?? "";
          if (product.thc || product.cbd) {
            const thcCbd = [];
            if (product.thc) thcCbd.push(`THC: ${product.thc}%`);
            if (product.cbd) thcCbd.push(`CBD: ${product.cbd}%`);
            description = description
              ? `${description}\n${thcCbd.join(" - ")}`
              : thcCbd.join(" - ");
          }

          // Une transaction par ligne. Deux raisons : une ligne en échec ne
          // doit pas laisser une catégorie créée sans son produit, et le
          // verrou consultatif qui sérialise l'attribution des codes anonymes
          // (anonymization.service) n'existe que pour la durée d'une
          // transaction — hors transaction il était relâché aussitôt pris.
          const createdCategory = await ctx.db.transaction(async (tx) => {
            let category = knownCategory;

            if (!category) {
              const [newCat] = await tx
                .insert(schema.categories)
                .values({
                  id: nanoid(),
                  cupId: input.cupId,
                  name: product.categorie.trim(),
                  description: null,
                  sortOrder: nextOrder++,
                })
                .returning();

              if (!newCat) {
                throw new Error(
                  `Impossible de créer la catégorie ${product.categorie}`
                );
              }
              category = newCat;
            }

            const anonymousCode = await generateAnonymousCodeFromService(
              tx as unknown as typeof ctx.db,
              cup.id,
              category.id
            );

            await tx.insert(schema.products).values({
              id: nanoid(),
              registrationId: registration.id,
              categoryId: category.id,
              name: product.nom,
              description: description || null,
              // 0 volontairement : l'import crée des inscriptions `confirmed` à
              // `total_amount = 0` (engagement réglé hors plateforme). Facturer
              // le tarif de la cup ici produirait une facture réclamant un
              // montant que le producteur a déjà payé ailleurs.
              priceAtRegistration: 0,
              status: "pending",
              anonymousCode,
            });

            return knownCategory ? null : category;
          });

          // Mémorisée seulement après commit : une catégorie dont la
          // transaction a été annulée ne doit pas être réutilisée par les
          // lignes suivantes, qui référenceraient un identifiant inexistant.
          if (createdCategory) {
            createdCategories.set(catKey, createdCategory);
          }

          imported++;
        } catch (e) {
          console.error("Error importing product:", product.nom, e);
          fail(e instanceof Error ? e.message : "Erreur inconnue");
        }
      }

      return { imported, errors: failures.length, failures };
    }),

  /**
   * Parse and validate jurys CSV
   */
  parseJurysCSV: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        csvContent: z.string().min(1, "Contenu CSV requis"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cup non trouvee" });
      }

      const { headers, rows } = parseCSVContent(input.csvContent);

      const requiredHeaders = ["nom", "email"];
      const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
      if (missingHeaders.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Colonnes manquantes: ${missingHeaders.join(", ")}`,
        });
      }

      const existingInvitations = await ctx.db.query.juryInvitations.findMany({
        where: eq(schema.juryInvitations.cupId, input.cupId),
      });
      const existingEmails = new Set(existingInvitations.map((i) => i.email.toLowerCase()));

      const headerIndices = {
        nom: headers.indexOf("nom"),
        email: headers.indexOf("email"),
        specialite: headers.indexOf("specialite"),
        bio: headers.indexOf("bio"),
      };

      const previewRows: PreviewRow[] = [];
      const seenEmails = new Set<string>();

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]!;
        const data: Record<string, string> = {};

        if (headerIndices.nom >= 0) data.nom = row[headerIndices.nom] ?? "";
        if (headerIndices.email >= 0) data.email = row[headerIndices.email] ?? "";
        if (headerIndices.specialite >= 0) data.specialite = row[headerIndices.specialite] ?? "";
        if (headerIndices.bio >= 0) data.bio = row[headerIndices.bio] ?? "";

        let status: PreviewRow["status"] = "valid";
        let error: string | undefined;

        if (!data.nom?.trim()) {
          status = "invalid";
          error = "Nom requis";
        } else if (!data.email?.trim()) {
          status = "invalid";
          error = "Email requis";
        } else if (!isValidEmail(data.email)) {
          status = "invalid";
          error = "Email invalide";
        } else if (seenEmails.has(data.email.toLowerCase())) {
          status = "invalid";
          error = "Email duplique dans le fichier";
        } else if (existingEmails.has(data.email.toLowerCase())) {
          status = "warning";
          error = "Jury deja invite";
        }

        if (data.email) {
          seenEmails.add(data.email.toLowerCase());
        }

        previewRows.push({ index: i, data, status, error });
      }

      return { rows: previewRows };
    }),

  /**
   * Import jurys and send invitations
   */
  importJurys: organizerProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        jurys: z.array(
          z.object({
            nom: z.string().min(1),
            email: z.string().email(),
            specialite: z.string().nullable(),
            bio: z.string().nullable(),
          })
        ),
        sendInvites: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const cup = await ctx.db.query.cups.findFirst({
        where: eq(schema.cups.id, input.cupId),
      });

      if (!cup) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Cup non trouvee" });
      }

      // L'import de jurés passe entièrement par l'invitation : c'est elle qui
      // crée la ligne `jury_invitations`. Sans envoi, rien n'est écrit — la
      // version précédente annonçait pourtant `imported = jurys.length`, un
      // compte-rendu de succès pour une opération sans effet.
      if (!input.sendInvites) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "L'import de jurés passe par l'envoi des invitations : sans envoi, aucun juré n'est enregistré",
        });
      }

      const juriesToInvite = input.jurys.map((j) => {
        const nameParts = j.nom.trim().split(/\s+/);
        const firstName = nameParts[0] ?? j.nom;
        const lastName = nameParts.slice(1).join(" ") || undefined;

        return {
          email: j.email,
          firstName,
          lastName,
        };
      });

      const result = await sendBulkInvitations(
        input.cupId,
        juriesToInvite,
        ctx.userId
      );

      // Même contrat que les deux autres imports : l'organisateur doit savoir
      // quelles lignes ont échoué et pourquoi, sans lire les logs Docker.
      const failures: ImportFailure[] = result.results
        .map((r, index) => ({ r, index }))
        .filter(({ r }) => !r.success)
        .map(({ r, index }) => ({
          row: index + 1,
          identifier: r.email,
          reason: r.error ?? "Invitation non envoyée",
        }));

      return {
        imported: result.success,
        errors: result.failed,
        invitesSent: result.success,
        alreadyInvited: result.alreadyInvited,
        failures,
      };
    }),
});
