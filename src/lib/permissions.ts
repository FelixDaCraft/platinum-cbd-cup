/**
 * Permission helpers for role-based access control
 * Story 11.14: Add writer role with limited permissions
 */

/**
 * Organization member roles
 * - owner: Full access, can manage organization settings
 * - admin: Full access to organization features
 * - member: Standard member access
 * - writer: Limited access to article management only
 */
export type OrganizationRole = "owner" | "admin" | "member" | "writer";

/**
 * Role display configuration
 */
export const roleConfig: Record<
  OrganizationRole,
  { label: string; description: string; color: string }
> = {
  owner: {
    label: "Propriétaire",
    description: "Accès complet, peut gérer l'organisation",
    color: "text-yellow-500",
  },
  admin: {
    label: "Administrateur",
    description: "Accès complet aux fonctionnalités",
    color: "text-blue-500",
  },
  member: {
    label: "Membre",
    description: "Accès standard",
    color: "text-green-500",
  },
  writer: {
    label: "Rédacteur",
    description: "Accès limité à la gestion des articles",
    color: "text-purple-500",
  },
};

/**
 * Permission categories
 */
type PermissionCategory =
  | "cups"
  | "sponsors"
  | "articles"
  | "team"
  | "settings"
  | "portal";

/**
 * Permission matrix by role
 * true = has access, false = no access
 */
const permissionMatrix: Record<OrganizationRole, Record<PermissionCategory, boolean>> = {
  owner: {
    cups: true,
    sponsors: true,
    articles: true,
    team: true,
    settings: true,
    portal: true,
  },
  admin: {
    cups: true,
    sponsors: true,
    articles: true,
    team: true,
    settings: true,
    portal: true,
  },
  member: {
    cups: true,
    sponsors: true,
    articles: true,
    team: false,
    settings: false,
    portal: true,
  },
  writer: {
    cups: false,
    sponsors: false,
    articles: true,
    team: false,
    settings: false,
    portal: false,
  },
};

/**
 * Check if a role has permission for a category
 */
export function hasPermission(
  role: OrganizationRole | string,
  category: PermissionCategory
): boolean {
  const permissions = permissionMatrix[role as OrganizationRole];
  if (!permissions) return false;
  return permissions[category] ?? false;
}

/**
 * Check if role is a full organization member (not writer-only)
 */
export function isFullMember(role: OrganizationRole | string): boolean {
  return role !== "writer";
}

/**
 * Check if role can manage team members
 */
export function canManageTeam(role: OrganizationRole | string): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Check if role can invite new members
 */
export function canInviteMembers(role: OrganizationRole | string): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Get roles that a user can assign when inviting
 * Owners can invite all roles, admins cannot invite owners
 */
export function getAssignableRoles(currentRole: OrganizationRole | string): OrganizationRole[] {
  if (currentRole === "owner") {
    return ["admin", "member", "writer"];
  }
  if (currentRole === "admin") {
    return ["member", "writer"];
  }
  return [];
}

/**
 * Navigation items filtered by role
 */
export interface NavItem {
  label: string;
  href: string;
  category: PermissionCategory;
  icon?: string;
}

export const dashboardNavItems: NavItem[] = [
  { label: "Cups", href: "/cups", category: "cups" },
  { label: "Sponsors", href: "/settings/sponsors", category: "sponsors" },
  { label: "Articles", href: "/articles", category: "articles" },
  { label: "Portail", href: "/settings/portal", category: "portal" },
  { label: "Équipe", href: "/settings/team", category: "team" },
  { label: "Paramètres", href: "/settings", category: "settings" },
];

/**
 * Get navigation items filtered by role
 */
export function getNavItemsForRole(role: OrganizationRole | string): NavItem[] {
  return dashboardNavItems.filter((item) => hasPermission(role, item.category));
}
