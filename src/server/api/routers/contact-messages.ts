import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { eq, and, count, desc, or } from "drizzle-orm";

import {
  createTRPCRouter,
  organizerProcedure,
  strictRateLimitedPublicProcedure,
} from "~/server/api/trpc";
import { env } from "~/env";
import { db } from "~/server/db";
import {
  escapeHtml,
  getResendClient,
  renderButton,
  renderCallout,
  renderEmailLayout,
} from "~/server/services/email";
import { getPortalBaseUrl } from "~/server/services/app-url";
import * as schema from "~/server/db/schema";
import {
  contactSubjectEnum,
  type ContactSubject,
} from "~/server/db/schema/contact-messages";

/**
 * Destinataire de repli quand aucun compte organisateur n'existe encore en
 * base : l'adresse publiée sur la page /contact.
 */
const FALLBACK_ORGANIZER_EMAIL = "contact@platinumcbdcup.eu";

/** Libellés FR des catégories de sujet, pour l'email de notification. */
const CONTACT_SUBJECT_LABELS: Record<ContactSubject, string> = {
  general: "Question générale",
  registration: "Inscription",
  results: "Résultats",
  sponsorship: "Partenariat",
  press: "Presse",
  technical: "Support technique",
  other: "Autre",
};

/**
 * Prévient l'organisateur qu'un message vient d'arriver dans la boîte de
 * réception du dashboard. Ne lève jamais : le message est déjà enregistré,
 * une panne Resend ne doit pas faire échouer l'envoi côté visiteur.
 */
async function notifyOrganizersOfContactMessage(params: {
  messageId: string;
  senderName: string;
  senderEmail: string;
  subject: ContactSubject;
  message: string;
}): Promise<void> {
  const { messageId, senderName, senderEmail, subject, message } = params;

  try {
    const organizers = await db.query.users.findMany({
      where: or(eq(schema.users.role, "organizer"), eq(schema.users.isAdmin, true)),
      columns: { email: true },
    });
    const recipients = organizers.length
      ? organizers.map((o) => o.email)
      : [FALLBACK_ORGANIZER_EMAIL];
    const portalBaseUrl = getPortalBaseUrl();
    const subjectLabel = CONTACT_SUBJECT_LABELS[subject];

    if (env.NODE_ENV === "development") {
      console.log("\n" + "=".repeat(60));
      console.log("✉️  NOUVEAU MESSAGE DE CONTACT (DEV MODE)");
      console.log("=".repeat(60));
      console.log("To:", recipients.join(", "));
      console.log("Subject:", subjectLabel);
      console.log("Message id:", messageId);
      console.log("=".repeat(60) + "\n");
    }

    const header = renderCallout({
      // `block` : l'encadré porte trois paragraphes, le `<p>` par défaut du
      // helper produirait un HTML mal imbriqué.
      block: true,
      background: "#f9fafb",
      textColor: "#4b5563",
      borderColor: "#d4af37",
      content: `
            <p style="color: #4b5563; font-size: 15px; margin: 0 0 8px 0;"><strong>Expéditeur :</strong> ${escapeHtml(senderName)}</p>
            <p style="color: #4b5563; font-size: 15px; margin: 0 0 8px 0;"><strong>Email :</strong> ${escapeHtml(senderEmail)}</p>
            <p style="color: #4b5563; font-size: 15px; margin: 0;"><strong>Sujet :</strong> ${escapeHtml(subjectLabel)}</p>`,
    });

    // Le corps du message garde son `white-space: pre-wrap` propre : le
    // visiteur écrit du texte libre, et `renderParagraph` écraserait ses
    // retours à la ligne en un seul bloc illisible.
    const body = `${header}
      <p style="color: #4b5563; font-size: 16px; line-height: 1.6; white-space: pre-wrap; margin-bottom: 24px;">${escapeHtml(message)}</p>
${renderButton(`${portalBaseUrl}/dashboard/settings/portal/messages`, "Ouvrir la boîte de réception")}`;

    // Envoi direct plutôt que via `sendEmail` : cette notification part vers
    // plusieurs organisateurs et pose un `replyTo` sur l'adresse du visiteur
    // (l'organisateur répond depuis son client mail), deux options que le
    // helper partagé n'expose pas encore.
    const result = await getResendClient().emails.send({
      from: env.EMAIL_FROM,
      to: recipients,
      replyTo: senderEmail,
      subject: `Nouveau message de contact - ${subjectLabel}`,
      html: renderEmailLayout({ title: "Nouveau message de contact", body }),
    });

    if (result.error) {
      console.error("[Contact] Resend error:", result.error);
    } else {
      console.log(`[Contact] Notification sent for message ${messageId}`);
    }
  } catch (error) {
    console.error("[Contact] Failed to notify organizers:", error);
  }
}

/**
 * Contact Messages Router - single-tenant
 * CRUD operations for contact form submissions
 */
export const contactMessagesRouter = createTRPCRouter({
  /**
   * List messages
   */
  list: organizerProcedure
    .input(
      z.object({
        filter: z.enum(["all", "unread", "starred", "archived"]).default("all"),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.filter === "unread") {
        conditions.push(eq(schema.contactMessages.status, "unread"));
      } else if (input.filter === "starred") {
        conditions.push(eq(schema.contactMessages.isStarred, true));
      } else if (input.filter === "archived") {
        conditions.push(eq(schema.contactMessages.status, "archived"));
      } else {
        // "all" - exclude archived
        conditions.push(
          or(
            eq(schema.contactMessages.status, "unread"),
            eq(schema.contactMessages.status, "read"),
            eq(schema.contactMessages.status, "replied")
          )!
        );
      }

      let messages = await ctx.db.query.contactMessages.findMany({
        where: conditions.length ? and(...conditions) : undefined,
        orderBy: [desc(schema.contactMessages.createdAt)],
        limit: input.limit,
      });

      if (input.search) {
        const searchLower = input.search.toLowerCase();
        messages = messages.filter(
          (m) =>
            m.senderName.toLowerCase().includes(searchLower) ||
            m.senderEmail.toLowerCase().includes(searchLower) ||
            m.message.toLowerCase().includes(searchLower)
        );
      }

      return messages;
    }),

  /**
   * Get a single message by ID
   */
  getById: organizerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const message = await ctx.db.query.contactMessages.findFirst({
        where: eq(schema.contactMessages.id, input.id),
      });

      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message non trouvé",
        });
      }

      return message;
    }),

  /**
   * Mark a message as read
   */
  markAsRead: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.contactMessages)
        .set({
          status: "read",
          updatedAt: new Date(),
        })
        .where(eq(schema.contactMessages.id, input.id));

      return { success: true };
    }),

  /**
   * Toggle star status
   */
  toggleStar: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.query.contactMessages.findFirst({
        where: eq(schema.contactMessages.id, input.id),
      });

      if (!message) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Message non trouvé",
        });
      }

      await ctx.db
        .update(schema.contactMessages)
        .set({
          isStarred: !message.isStarred,
          updatedAt: new Date(),
        })
        .where(eq(schema.contactMessages.id, input.id));

      return { success: true, isStarred: !message.isStarred };
    }),

  /**
   * Archive a message
   */
  archive: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(schema.contactMessages)
        .set({
          status: "archived",
          updatedAt: new Date(),
        })
        .where(eq(schema.contactMessages.id, input.id));

      return { success: true };
    }),

  /**
   * Delete a message (organizer only)
   */
  delete: organizerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(schema.contactMessages)
        .where(eq(schema.contactMessages.id, input.id));

      return { success: true };
    }),

  /**
   * Submit a new contact message (public - from portal)
   * Limité en débit par IP : le formulaire est ouvert à tous et déclenche un email.
   */
  submit: strictRateLimitedPublicProcedure
    .input(
      z.object({
        senderName: z.string().min(2).max(100),
        senderEmail: z.string().email(),
        subject: z.enum(contactSubjectEnum),
        message: z.string().min(10).max(5000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = nanoid();

      await ctx.db.insert(schema.contactMessages).values({
        id,
        senderName: input.senderName,
        senderEmail: input.senderEmail,
        subject: input.subject,
        message: input.message,
        status: "unread",
        isStarred: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await notifyOrganizersOfContactMessage({ messageId: id, ...input });

      return { success: true, message: "Message envoyé avec succès" };
    }),

  /**
   * Nombre de messages non lus, pour la pastille du tableau de bord.
   *
   * Réservé à l'organisateur : tout compte connecté (producteur, juré) lisait
   * jusqu'ici le volume de courrier reçu. Le décompte se fait en SQL, sans
   * charger les messages — donc sans faire transiter les coordonnées des
   * expéditeurs.
   */
  getUnreadCount: organizerProcedure.query(async ({ ctx }) => {
    const [result] = await ctx.db
      .select({ value: count() })
      .from(schema.contactMessages)
      .where(eq(schema.contactMessages.status, "unread"));

    return { count: result?.value ?? 0 };
  }),
});
