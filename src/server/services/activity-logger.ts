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
  const labels: Record<ActivityAction, string> = {
    // Auth
    user_login: "Connexion utilisateur",
    user_logout: "Déconnexion utilisateur",
    user_signup: "Inscription utilisateur",
    password_reset: "Réinitialisation mot de passe",
    email_change: "Changement d'email",
    // Admin actions
    admin_create_organizer: "Création compte organisateur (admin)",
    admin_suspend_organization: "Suspension organisation (admin)",
    admin_reactivate_organization: "Réactivation organisation (admin)",
    admin_toggle_admin: "Modification droits admin",
    admin_update_plan_config: "Modification config plans",
    // Organization actions
    organization_created: "Organisation créée",
    organization_updated: "Organisation mise à jour",
    // Subscription actions
    subscription_created: "Abonnement créé",
    subscription_updated: "Abonnement mis à jour",
    subscription_cancelled: "Abonnement annulé",
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
  if (action.startsWith("organization_")) {
    return "Organisation";
  }
  if (action.startsWith("subscription_")) {
    return "Abonnement";
  }
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
