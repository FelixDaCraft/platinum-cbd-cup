import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { unlink } from "fs/promises";
import path from "path";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  generateProductQRCode,
  generateBatchQRCodes,
  type QRCodeType,
} from "~/server/services/qrcode.service";
import { products, labAnalyses } from "~/server/db/schema";
import type { StoredCompoundRow } from "~/server/db/schema/lab-analyses";

type ProtectedContext = {
  db: typeof db;
  userId: string;
};

const requireCup = async (ctx: ProtectedContext, cupId: string) => {
  const cup = await ctx.db.query.cups.findFirst({
    where: (cups, { eq }) => eq(cups.id, cupId),
    columns: {
      id: true,
      name: true,
    },
  });

  if (!cup) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Cup non trouvee",
    });
  }

  return cup;
};

/**
 * Product router
 * Handles product-related operations for organizers
 */
export const productRouter = createTRPCRouter({
  /**
   * Get all products for a cup grouped by category
   * Only accessible by organization members who own the cup
   */
  listByCupGroupedByCategory: protectedProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
      })
    )
    .query(async ({ ctx, input }) => {
      const cup = await requireCup(ctx, input.cupId);
      //4. Get all registrations with products for this cup
      const registrations = await ctx.db.query.registrations.findMany({
        where: (reg, { eq }) => eq(reg.cupId, input.cupId),
        with: {
          producer: {
            columns: {
              id: true,
              companyName: true,
            },
            with: {
              user: {
                columns: {
                  name: true,
                },
              },
            },
          },
          products: {
            with: {
              category: {
                columns: {
                  id: true,
                  name: true,
                  description: true,
                },
              },
            },
          },
        },
      });

      // 5. Flatten products with producer info and group by category
      type ProductWithProducer = {
        id: string;
        name: string;
        description: string | null;
        status: string;
        anonymousCode: string | null;
        excludedFromResults: boolean;
        categoryId: string;
        category: {
          id: string;
          name: string;
          description: string | null;
        };
        producer: {
          id: string;
          companyName: string;
          userName: string | null;
        };
      };

      const allProducts: ProductWithProducer[] = [];

      for (const reg of registrations) {
        for (const product of reg.products) {
          allProducts.push({
            id: product.id,
            name: product.name,
            description: product.description,
            status: product.status,
            anonymousCode: product.anonymousCode,
            excludedFromResults: product.excludedFromResults,
            categoryId: product.categoryId,
            category: product.category,
            producer: {
              id: reg.producer.id,
              companyName: reg.producer.companyName,
              userName: reg.producer.user.name,
            },
          });
        }
      }

      // 6. Group by category
      const categoriesMap = new Map<
        string,
        {
          category: {
            id: string;
            name: string;
            description: string | null;
          };
          products: ProductWithProducer[];
          count: number;
        }
      >();

      for (const product of allProducts) {
        const catId = product.categoryId;
        if (!categoriesMap.has(catId)) {
          categoriesMap.set(catId, {
            category: product.category,
            products: [],
            count: 0,
          });
        }
        const group = categoriesMap.get(catId)!;
        group.products.push(product);
        group.count++;
      }

      // 7. Sort products within each category by name
      for (const group of categoriesMap.values()) {
        group.products.sort((a, b) => a.name.localeCompare(b.name));
      }

      // 8. Convert to array and sort categories by name
      const categories = Array.from(categoriesMap.values()).sort((a, b) =>
        a.category.name.localeCompare(b.category.name)
      );

      return {
        cupId: cup.id,
        cupName: cup.name,
        totalProducts: allProducts.length,
        totalCategories: categories.length,
        categories,
      };
    }),

  /**
   * Get QR code for a single product
   * Returns both reception and notation QR codes
   */
  getQRCode: protectedProcedure
    .input(
      z.object({
        productId: z.string().min(1, "Product ID requis"),
        type: z.enum(["reception", "notation"]).default("reception"),
      })
    )
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.query.products.findFirst({
        where: (p, { eq: eqFn }) => eqFn(p.id, input.productId),
        with: {
          registration: {
            with: {
              cup: {
                columns: {
                  id: true,
                },
              },
            },
          },
        },
      });

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Produit non trouve",
        });
      }

      // 3. Verify access: organizer (isAdmin or role) OR the product's producer
      const user = await ctx.db.query.users.findFirst({
        where: (users, { eq: eqFn }) => eqFn(users.id, ctx.userId),
        columns: { isAdmin: true, role: true },
      });
      const isOrganizer = user?.isAdmin === true || user?.role === "organizer";

      const producer = await ctx.db.query.producers.findFirst({
        where: (producers, { eq: eqFn }) =>
          eqFn(producers.userId, ctx.userId),
      });

      const isProducerOwner = producer?.id === product.registration.producerId;

      if (!isOrganizer && !isProducerOwner) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Acces non autorise a ce produit",
        });
      }

      // 4. Generate QR code
      const { dataUrl, url } = await generateProductQRCode(
        product.id,
        product.registration.cupId,
        input.type as QRCodeType
      );

      return {
        productId: product.id,
        productName: product.name,
        anonymousCode: product.anonymousCode,
        qrCodeDataUrl: dataUrl,
        qrCodeUrl: url,
        type: input.type,
      };
    }),

  /**
   * Generate QR codes for all products in a cup (batch)
   * Only accessible by organization members
   */
  generateBatchQRCodes: protectedProcedure
    .input(
      z.object({
        cupId: z.string().min(1, "Cup ID requis"),
        type: z.enum(["reception", "notation"]).default("reception"),
      })
    )
    .query(async ({ ctx, input }) => {
      const cup = await requireCup(ctx, input.cupId);
      //4. Get all products for this cup
      const registrations = await ctx.db.query.registrations.findMany({
        where: (reg, { eq: eqFn }) => eqFn(reg.cupId, input.cupId),
        with: {
          products: {
            columns: {
              id: true,
              name: true,
              anonymousCode: true,
            },
            with: {
              category: {
                columns: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      // 5. Flatten products
      const allProducts = registrations.flatMap((reg) =>
        reg.products.map((p) => ({
          id: p.id,
          name: p.name,
          anonymousCode: p.anonymousCode,
          cupId: input.cupId,
          categoryId: p.category.id,
          categoryName: p.category.name,
        }))
      );

      if (allProducts.length === 0) {
        return {
          cupId: cup.id,
          cupName: cup.name,
          type: input.type,
          qrCodes: [],
          totalProducts: 0,
        };
      }

      // 6. Generate all QR codes
      const qrCodes = await generateBatchQRCodes(
        allProducts.map((p) => ({
          id: p.id,
          cupId: p.cupId,
          anonymousCode: p.anonymousCode,
        })),
        input.type as QRCodeType
      );

      // 7. Merge with product info
      const qrCodesWithInfo = qrCodes.map((qr, index) => ({
        ...qr,
        productName: allProducts[index]!.name,
        categoryId: allProducts[index]!.categoryId,
        categoryName: allProducts[index]!.categoryName,
      }));

      return {
        cupId: cup.id,
        cupName: cup.name,
        type: input.type,
        qrCodes: qrCodesWithInfo,
        totalProducts: allProducts.length,
      };
    }),

  /**
   * Get product details for receipt page
   * Returns product info with category and producer names
   */
  getProductForReceipt: protectedProcedure
    .input(
      z.object({
        productId: z.string().min(1, "Product ID requis"),
        cupId: z.string().min(1, "Cup ID requis"),
      })
    )
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.query.products.findFirst({
        where: (p, { eq: eqFn }) => eqFn(p.id, input.productId),
        with: {
          category: {
            columns: {
              id: true,
              name: true,
            },
          },
          registration: {
            with: {
              cup: {
                columns: {
                  id: true,
                },
              },
              producer: {
                columns: {
                  id: true,
                  companyName: true,
                },
              },
            },
          },
        },
      });

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Produit non trouve",
        });
      }

      // 3. Verify this product belongs to the specified cup
      if (product.registration.cupId !== input.cupId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Ce produit n'appartient pas a cette cup",
        });
      }

      // 4. Verify organization membership
      return {
        id: product.id,
        name: product.name,
        anonymousCode: product.anonymousCode,
        status: product.status,
        categoryId: product.category.id,
        categoryName: product.category.name,
        producerId: product.registration.producer.id,
        producerName: product.registration.producer.companyName,
        cupId: product.registration.cupId,
      };
    }),

  /**
   * Update product status (for marking as received, etc.)
   * Only accessible by organization members
   */
  updateStatus: protectedProcedure
    .input(
      z.object({
        productId: z.string().min(1, "Product ID requis"),
        status: z.enum(["pending", "received", "rating", "rated"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.db.query.products.findFirst({
        where: (p, { eq: eqFn }) => eqFn(p.id, input.productId),
        with: {
          registration: {
            with: {
              cup: {
                columns: {
                  id: true,
                },
              },
            },
          },
        },
      });

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Produit non trouve",
        });
      }

      // 3. Verify organization membership
      // 4. Update product status
      const updateData: {
        status: typeof input.status;
        updatedAt: Date;
        receivedAt?: Date;
      } = {
        status: input.status,
        updatedAt: new Date(),
      };

      // Set receivedAt timestamp when marking as received
      if (input.status === "received") {
        updateData.receivedAt = new Date();
      }

      const [updated] = await ctx.db
        .update(products)
        .set(updateData)
        .where(eq(products.id, input.productId))
        .returning();

      return {
        success: true,
        product: updated,
      };
    }),

  /**
   * Update a product's name
   * Only accessible by organization members
   */
  updateName: protectedProcedure
    .input(
      z.object({
        productId: z.string().min(1, "Product ID requis"),
        name: z.string().min(1, "Le nom ne peut pas etre vide").max(200),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.db.query.products.findFirst({
        where: (p, { eq: eqFn }) => eqFn(p.id, input.productId),
        with: {
          registration: {
            with: {
              cup: {
                columns: {
                  id: true,
                },
              },
            },
          },
        },
      });

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Produit non trouve",
        });
      }

      const [updated] = await ctx.db
        .update(products)
        .set({ name: input.name, updatedAt: new Date() })
        .where(eq(products.id, input.productId))
        .returning();

      return { success: true, product: updated };
    }),

  /**
   * Update a product's anonymous code
   * Only accessible by organization members
   */
  updateAnonymousCode: protectedProcedure
    .input(
      z.object({
        productId: z.string().min(1, "Product ID requis"),
        anonymousCode: z
          .string()
          .min(1, "Le code ne peut pas etre vide")
          .nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.db.query.products.findFirst({
        where: (p, { eq: eqFn }) => eqFn(p.id, input.productId),
        with: {
          registration: {
            with: {
              cup: {
                columns: {
                  id: true,
                },
              },
            },
          },
        },
      });

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Produit non trouve",
        });
      }

      // 3. Verify organization membership
      // 4. Check uniqueness within category (if code is not null)
      if (input.anonymousCode) {
        const existing = await ctx.db.query.products.findFirst({
          where: (p, { eq: eqFn, and: andFn }) =>
            andFn(
              eqFn(p.categoryId, product.categoryId),
              eqFn(p.anonymousCode, input.anonymousCode!)
            ),
        });

        if (existing && existing.id !== input.productId) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `Le code ${input.anonymousCode} est deja utilise dans cette categorie`,
          });
        }
      }

      // 5. Update anonymous code
      const [updated] = await ctx.db
        .update(products)
        .set({
          anonymousCode: input.anonymousCode,
          updatedAt: new Date(),
        })
        .where(eq(products.id, input.productId))
        .returning();

      return {
        success: true,
        product: updated,
      };
    }),

  /* -----------------------------------------------------------------------
   * Lab analysis (SpectralFingerprints GC-FID) — POC
   *
   * Upload flow:
   *   1. Client POSTs PDF to /api/upload/lab-analysis → returns parsed preview
   *   2. Organizer reviews the parsed values in the UI
   *   3. Organizer confirms → confirmLabAnalysis (upsert)
   * --------------------------------------------------------------------- */

  getLabAnalysis: protectedProcedure
    .input(z.object({ productId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const product = await ctx.db.query.products.findFirst({
        where: (p, { eq: eqFn }) => eqFn(p.id, input.productId),
        with: {
          registration: {
            with: { cup: { columns: { id: true } } },
          },
        },
      });
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Produit non trouvé" });
      }

      const analysis = await ctx.db.query.labAnalyses.findFirst({
        where: (la, { eq: eqFn }) => eqFn(la.productId, input.productId),
      });
      return { analysis: analysis ?? null };
    }),

  confirmLabAnalysis: protectedProcedure
    .input(
      z.object({
        productId: z.string().min(1),
        pdfUrl: z.string().min(1),
        pdfFilename: z.string().min(1),
        parsed: z.object({
          metadata: z.object({
            labName: z.string(),
            analysisNumber: z.string().nullable(),
            sfpCode: z.string().nullable(),
            serial: z.string().nullable(),
            productDescription: z.string().nullable(),
            sampleType: z.string().nullable(),
            methodName: z.string().nullable(),
            receivedAt: z.string().nullable(),
            approvedAt: z.string().nullable(),
          }),
          totals: z.object({
            terpenesTotal: z.number().nullable(),
          }),
          terpenes: z.array(
            z.object({
              abbreviation: z.string(),
              name: z.string(),
              percentage: z.number().nullable(),
              flag: z.enum(["ND", "LOQ", "value"]),
              uncertainty: z.number().nullable(),
            }),
          ),
          computedTerpeneSum: z.number(),
        }),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Authz: the caller must be a member of the cup's organization.
      const product = await ctx.db.query.products.findFirst({
        where: (p, { eq: eqFn }) => eqFn(p.id, input.productId),
        with: {
          registration: {
            with: { cup: { columns: { id: true } } },
          },
        },
      });
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Produit non trouvé" });
      }

      // If there's already an analysis for this product, we overwrite it
      // (per POC requirements: one analysis per product, latest wins). We
      // also unlink the old PDF from disk.
      const existing = await ctx.db.query.labAnalyses.findFirst({
        where: (la, { eq: eqFn }) => eqFn(la.productId, input.productId),
      });
      if (existing) {
        const oldPath = path.join(process.cwd(), "public", existing.pdfUrl);
        await unlink(oldPath).catch(() => {});
      }

      // numeric columns are stored as strings in Drizzle (pg numeric → text to
      // preserve precision). Stringify totals here; nullables stay null.
      const num = (n: number | null) => (n === null ? null : String(n));

      const row = {
        id: existing?.id ?? nanoid(),
        productId: input.productId,
        pdfUrl: input.pdfUrl,
        pdfFilename: input.pdfFilename,

        labName: input.parsed.metadata.labName,
        analysisNumber: input.parsed.metadata.analysisNumber,
        sfpCode: input.parsed.metadata.sfpCode,
        serial: input.parsed.metadata.serial,
        productDescription: input.parsed.metadata.productDescription,
        sampleType: input.parsed.metadata.sampleType,
        methodName: input.parsed.metadata.methodName,
        receivedAt: input.parsed.metadata.receivedAt,
        approvedAt: input.parsed.metadata.approvedAt,

        terpenesTotal: num(input.parsed.totals.terpenesTotal),
        computedTerpeneSum: num(input.parsed.computedTerpeneSum),

        terpenes: input.parsed.terpenes as StoredCompoundRow[],

        uploadedBy: ctx.userId,
        updatedAt: new Date(),
      } as const;

      if (existing) {
        const [updated] = await ctx.db
          .update(labAnalyses)
          .set(row)
          .where(eq(labAnalyses.productId, input.productId))
          .returning();
        return { success: true, analysis: updated, replaced: true };
      }

      const [inserted] = await ctx.db
        .insert(labAnalyses)
        .values({ ...row, uploadedAt: new Date() })
        .returning();
      return { success: true, analysis: inserted, replaced: false };
    }),

  /**
   * Terpene ranking for a given cup, grouped by category.
   * Returns every product that has a lab analysis, ordered within each
   * category by terpenesTotal DESC (fallback: computedTerpeneSum). Products
   * without a lab analysis are returned in a separate "without" bucket so
   * the UI can nudge the organizer to upload missing reports.
   */
  rankByTerpenes: protectedProcedure
    .input(z.object({ cupId: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const cup = await requireCup(ctx, input.cupId);

      // Pull all registrations + products + (optional) lab analyses for the
      // cup, then group by category in JS. Simpler than a hand-rolled SQL
      // window query and fine for POC data volumes.
      const registrations = await ctx.db.query.registrations.findMany({
        where: (r, { eq: eqFn }) => eqFn(r.cupId, input.cupId),
        with: {
          producer: {
            columns: { id: true, companyName: true },
          },
          products: {
            with: {
              category: { columns: { id: true, name: true } },
              labAnalysis: true,
            },
          },
        },
      });

      type RankedEntry = {
        productId: string;
        productName: string;
        anonymousCode: string | null;
        producerName: string;
        terpenesTotal: number | null;
        computedTerpeneSum: number | null;
        topTerpenes: Array<{ abbreviation: string; name: string; percentage: number }>;
        uploadedAt: Date | null;
      };

      type CategoryBucket = {
        categoryId: string;
        categoryName: string;
        ranked: RankedEntry[];
        withoutAnalysis: Array<{
          productId: string;
          productName: string;
          anonymousCode: string | null;
          producerName: string;
        }>;
      };

      const byCategory = new Map<string, CategoryBucket>();

      for (const reg of registrations) {
        for (const product of reg.products) {
          const catId = product.category.id;
          let bucket = byCategory.get(catId);
          if (!bucket) {
            bucket = {
              categoryId: catId,
              categoryName: product.category.name,
              ranked: [],
              withoutAnalysis: [],
            };
            byCategory.set(catId, bucket);
          }

          if (!product.labAnalysis) {
            bucket.withoutAnalysis.push({
              productId: product.id,
              productName: product.name,
              anonymousCode: product.anonymousCode,
              producerName: reg.producer.companyName,
            });
            continue;
          }

          // Drizzle numeric -> string. Parse for sorting.
          const terp = product.labAnalysis.terpenesTotal
            ? parseFloat(product.labAnalysis.terpenesTotal)
            : null;
          const computed = product.labAnalysis.computedTerpeneSum
            ? parseFloat(product.labAnalysis.computedTerpeneSum)
            : null;

          // Top 3 individual terpenes to show as a mini-profile in the row.
          const terpenesList = product.labAnalysis.terpenes ?? [];
          const topTerpenes = [...terpenesList]
            .filter((t) => t.flag === "value" && typeof t.percentage === "number")
            .sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0))
            .slice(0, 3)
            .map((t) => ({
              abbreviation: t.abbreviation,
              name: t.name,
              percentage: t.percentage ?? 0,
            }));

          bucket.ranked.push({
            productId: product.id,
            productName: product.name,
            anonymousCode: product.anonymousCode,
            producerName: reg.producer.companyName,
            terpenesTotal: terp,
            computedTerpeneSum: computed,
            topTerpenes,
            uploadedAt: product.labAnalysis.uploadedAt,
          });
        }
      }

      // Sort each bucket: highest terpenes first. Null/absent values fall last.
      const categories = Array.from(byCategory.values())
        .map((bucket) => {
          bucket.ranked.sort((a, b) => {
            const av = a.terpenesTotal ?? a.computedTerpeneSum ?? -1;
            const bv = b.terpenesTotal ?? b.computedTerpeneSum ?? -1;
            return bv - av;
          });
          return bucket;
        })
        .sort((a, b) => a.categoryName.localeCompare(b.categoryName));

      return {
        cupName: cup.name,
        categories,
      };
    }),

  deleteLabAnalysis: protectedProcedure
    .input(z.object({ productId: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const product = await ctx.db.query.products.findFirst({
        where: (p, { eq: eqFn }) => eqFn(p.id, input.productId),
        with: {
          registration: {
            with: { cup: { columns: { id: true } } },
          },
        },
      });
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Produit non trouvé" });
      }

      const existing = await ctx.db.query.labAnalyses.findFirst({
        where: (la, { eq: eqFn }) => eqFn(la.productId, input.productId),
      });
      if (!existing) {
        return { success: true, deleted: false };
      }

      await ctx.db
        .delete(labAnalyses)
        .where(eq(labAnalyses.productId, input.productId));

      const oldPath = path.join(process.cwd(), "public", existing.pdfUrl);
      await unlink(oldPath).catch(() => {});

      return { success: true, deleted: true };
    }),

  /**
   * Toggle product exclusion from public results (disqualification, rule violation, etc.)
   */
  toggleExcludeFromResults: protectedProcedure
    .input(
      z.object({
        productId: z.string().min(1),
        excluded: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the product exists and user has access
      const product = await ctx.db.query.products.findFirst({
        where: (p, { eq: eqFn }) => eqFn(p.id, input.productId),
        with: {
          registration: {
            with: {
              cup: true,
            },
          },
        },
      });

      if (!product) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Produit non trouvé",
        });
      }

      // Verify user is organizer / admin
      const user = await ctx.db.query.users.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, ctx.userId),
        columns: { isAdmin: true, role: true },
      });

      if (!user || (user.isAdmin !== true && user.role !== "organizer")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Accès réservé aux administrateurs",
        });
      }

      await ctx.db
        .update(products)
        .set({
          excludedFromResults: input.excluded,
          updatedAt: new Date(),
        })
        .where(eq(products.id, input.productId));

      return {
        success: true,
        productId: input.productId,
        excluded: input.excluded,
      };
    }),
});
