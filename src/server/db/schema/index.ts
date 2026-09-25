/**
 * Schéma Drizzle — point d'entrée unique (lu par drizzle.config.ts).
 *
 * Le déploiement applique les migrations versionnées du dossier `drizzle/`
 * (`drizzle-kit migrate`). Toute modification ici doit donc s'accompagner d'un
 * fichier de migration généré par `pnpm db:generate` PUIS relu à la main :
 * drizzle-kit n'écrit pas les clauses `USING` des changements de type, et voit
 * un renommage comme un DROP + CREATE.
 */

// Auth schema (Better Auth)
export * from "./auth";

// Cup management
export * from "./cups";
export * from "./categories";
export * from "./cup-labels";
export * from "./rating-criteria";

// Producers & products
export * from "./producers";
export * from "./registrations";
export * from "./products";

// Juries
export * from "./juries";

// Ratings
export * from "./ratings";

// Audit trail
export * from "./activity-logs";

// About / portal content (single-tenant)
export * from "./organization-about";
export * from "./portal-about-settings";

// Sponsors
export * from "./sponsors";

// Articles / blog
export * from "./articles";

// Newsletter
export * from "./newsletter";

// RS Templates (social media post templates)
export * from "./rs-templates";

// Contact messages
export * from "./contact-messages";

// Jury invitation codes
export * from "./jury-invitation-codes";

// Press
export * from "./press";

// Historical imports (past editions)
export * from "./historical-imports";

// Lab analyses
export * from "./lab-analyses";
