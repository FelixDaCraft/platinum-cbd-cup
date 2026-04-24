/**
 * Cup Import Router
 * Handles CSV import for producers, products, and jurys
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and, max } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  createTRPCRouter,
  organizerProcedure,
  protectedProcedure,
} from "~/server/api/trpc";
import * as schema from "~/server/db/schema";
import { sendBulkInvitations } from "~/server/services/jury-invitation.service";
import { generateAnonymousCode as generateAnonymousCodeFromService } from "~/server/services/anonymization.service";

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
  getCategoriesForCup: protectedProcedure
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
   */
  getProducersForCup: protectedProcedure
    .input(z.object({ cupId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const registrations = await ctx.db.query.registrations.findMany({
        where: eq(schema.registrations.cupId, input.cupId),
        with: {
          producer: {
            columns: {
              id: true,
              companyName: true,
              brandName: true,
            },
            with: {
              user: {
                columns: { email: true, name: true },
              },
            },
          },
        },
      });

      return registrations.map((r) => ({
        id: r.producer.id,
        companyName: r.producer.companyName,
        brandName: r.producer.brandName,
        email: r.producer.user.email,
        name: r.producer.user.name,
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
      let errors = 0;

      for (const producer of input.producers) {
        try {
          let user = await ctx.db.query.users.findFirst({
            where: eq(schema.users.email, producer.email.toLowerCase()),
          });

          if (!user) {
            const userId = nanoid();
            await ctx.db.insert(schema.users).values({
              id: userId,
              email: producer.email.toLowerCase(),
              name: producer.nom,
              emailVerified: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            user = await ctx.db.query.users.findFirst({
              where: eq(schema.users.id, userId),
            });
          }

          if (!user) {
            errors++;
            continue;
          }

          // Check if producer profile already exists for this user
          const existingProducer = await ctx.db.query.producers.findFirst({
            where: eq(schema.producers.userId, user.id),
          });

          let producerId: string;

          if (existingProducer) {
            producerId = existingProducer.id;
          } else {
            producerId = nanoid();
            await ctx.db.insert(schema.producers).values({
              id: producerId,
              userId: user.id,
              companyName: producer.entreprise ?? producer.nom,
              brandName: producer.nom,
              phone: producer.telephone,
              address: producer.adresse,
            });
          }

          // Check if already registered for this cup
          const existingRegistration = await ctx.db.query.registrations.findFirst({
            where: and(
              eq(schema.registrations.cupId, input.cupId),
              eq(schema.registrations.producerId, producerId)
            ),
          });

          if (existingRegistration) continue;

          const registrationId = nanoid();
          await ctx.db.insert(schema.registrations).values({
            id: registrationId,
            cupId: input.cupId,
            producerId,
            status: "confirmed",
            totalAmount: 0,
          });

          imported++;
        } catch (e) {
          console.error("Error importing producer:", producer.email, e);
          errors++;
        }
      }

      return { imported, errors };
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
      let errors = 0;

      for (const product of input.products) {
        try {
          const registration = registrationByEmail.get(product.producteur_email.toLowerCase());

          if (!registration) {
            errors++;
            continue;
          }

          const catKey = product.categorie.toLowerCase();
          let category = categoryByName.get(catKey) ?? createdCategories.get(catKey);

          if (!category) {
            const categoryId = nanoid();
            const [newCat] = await ctx.db
              .insert(schema.categories)
              .values({
                id: categoryId,
                cupId: input.cupId,
                name: product.categorie.trim(),
                description: null,
                sortOrder: nextOrder++,
              })
              .returning();
            if (!newCat) {
              errors++;
              continue;
            }
            category = newCat;
            createdCategories.set(catKey, newCat);
          }

          const anonymousCode = await generateAnonymousCodeFromService(ctx.db, cup.id, category.id);

          let description = product.description ?? "";
          if (product.thc || product.cbd) {
            const thcCbd = [];
            if (product.thc) thcCbd.push(`THC: ${product.thc}%`);
            if (product.cbd) thcCbd.push(`CBD: ${product.cbd}%`);
            description = description
              ? `${description}\n${thcCbd.join(" - ")}`
              : thcCbd.join(" - ");
          }

          const productId = nanoid();
          await ctx.db.insert(schema.products).values({
            id: productId,
            registrationId: registration.id,
            categoryId: category.id,
            name: product.nom,
            description: description || null,
            priceAtRegistration: 0,
            status: "pending",
            anonymousCode,
          });

          imported++;
        } catch (e) {
          console.error("Error importing product:", product.nom, e);
          errors++;
        }
      }

      return { imported, errors };
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

      let imported = 0;
      let errors = 0;
      let invitesSent = 0;

      if (input.sendInvites) {
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

        imported = result.success;
        invitesSent = result.success;
        errors = result.failed;
      } else {
        imported = input.jurys.length;
      }

      return { imported, errors, invitesSent };
    }),
});
