import { nanoid } from "nanoid";
import { db } from "~/server/db";
import { activityLogs, type ActivityAction } from "~/server/db/schema";

interface LogActivityParams {
  userId?: string | null;
  action: ActivityAction;
  description: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an activity for audit trail
 * This function is safe to call without await - it won't block the main operation
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    await db.insert(activityLogs).values({
      id: nanoid(),
      userId: params.userId ?? null,
      action: params.action,
      description: params.description,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    });
  } catch (error) {
    // Log to console but don't throw - activity logging should not break main operations
    console.error("[ActivityLogger] Failed to log activity:", error);
  }
}

/**
 * Get human-readable label for an action
 */
export function getActionLabel(action: ActivityAction): string {
  // `Record` et non `Partial` : les huit valeurs héritées de CupMetrics ont
  // été retirées de l'enum (migration 0005), donc le dictionnaire couvre à
  // nouveau exactement le type. L'exhaustivité est ce qui compte ici : elle
  // fait échouer le typecheck le jour où une action est ajoutée à l'enum sans
  // son libellé, au lieu de laisser le repli `?? action` afficher une clé
  // technique à l'organisateur.
  const labels: Record<ActivityAction, string> = {
    // Auth
    user_login: "Connexion utilisateur",
    user_logout: "Déconnexion utilisateur",
    user_signup: "Inscription utilisateur",
    password_reset: "Réinitialisation mot de passe",
    email_change: "Changement d'email",
    // Admin actions
    admin_create_organizer: "Création compte organisateur (admin)",
    admin_toggle_admin: "Modification droits admin",
    // Cup actions
    cup_created: "Cup créée",
    cup_updated: "Cup mise à jour",
    cup_published: "Cup publiée",
    cup_completed: "Cup terminée",
    cup_deleted: "Cup supprimée",
    // Registration actions
    registration_created: "Inscription créée",
    registration_confirmed: "Inscription confirmée",
    registration_cancelled: "Inscription annulée",
    // Product actions
    product_created: "Produit créé",
    product_updated: "Produit mis à jour",
    product_received: "Produit marqué reçu",
    // Rating actions
    rating_submitted: "Notation soumise",
    results_published: "Résultats publiés",
    results_sent: "Résultats envoyés",
    // Jury actions
    jury_invited: "Jury invité",
    jury_joined: "Jury a rejoint",
    jury_removed: "Jury retiré",
    // Other
    other: "Autre action",
  };
  return labels[action] ?? action;
}

/**
 * Get action category for grouping
 */
export function getActionCategory(action: ActivityAction): string {
  if (action.startsWith("user_") || action.startsWith("password_") || action.startsWith("email_")) {
    return "Authentification";
  }
  if (action.startsWith("admin_")) {
    return "Administration";
  }
  // Les regroupements « Organisation » et « Abonnement » sont tombés avec les
  // valeurs d'enum correspondantes : les garder laissait croire au lecteur que
  // le journal pouvait encore classer des événements multi-tenant.
  if (action.startsWith("cup_")) {
    return "Cup";
  }
  if (action.startsWith("registration_")) {
    return "Inscription";
  }
  if (action.startsWith("product_")) {
    return "Produit";
  }
  if (action.startsWith("rating_") || action.startsWith("results_")) {
    return "Notation";
  }
  if (action.startsWith("jury_")) {
    return "Jury";
  }
  return "Autre";
}
