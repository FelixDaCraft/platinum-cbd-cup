/**
 * Énumérations métier partagées client ↔ serveur.
 *
 * Ces valeurs vivaient dans `~/server/db/schema/cups`. Les importer depuis un
 * module de validation utilisé par les formulaires tirait tout le schéma
 * Drizzle — et donc `drizzle-orm/pg-core` — dans le bundle navigateur (~36 Ko
 * de `ColumnBuilder` sur quatre routes du dashboard), avec le risque qu'un
 * futur export du schéma élargisse la fuite.
 *
 * Elles sont donc définies ici, sans dépendance serveur. Les colonnes Drizzle
 * continuent de les typer via leurs propres constantes ; les assertions de
 * type en fin de fichier (purement statiques, effacées à la compilation)
 * échouent au typecheck si les deux listes divergent.
 */

/**
 * Panel de jury d'une cup : chaque cup réunit un jury pro et un jury public,
 * qui produisent chacun leur classement.
 */
export const juryPanelEnum = ["pro", "public"] as const;
export type JuryPanel = (typeof juryPanelEnum)[number];

/** Libellés d'affichage des panels. */
export const JURY_PANEL_LABELS: Record<JuryPanel, string> = {
  pro: "Jury pro",
  public: "Jury public",
};

/**
 * Cycle de vie d'une cup.
 */
export const cupStatusEnum = [
  "draft",
  "published",
  "registration_closed",
  "rating",
  "completed",
] as const;
export type CupStatus = (typeof cupStatusEnum)[number];

/**
 * Échelle de notation appliquée à tous les critères d'une cup.
 */
export const ratingScaleEnum = ["0-5", "0-10", "0-20", "0-100"] as const;
export type RatingScale = (typeof ratingScaleEnum)[number];

// ---------------------------------------------------------------------------
// Garde-fous statiques contre une divergence avec le schéma Drizzle.
// `import type` n'émet aucun code : rien de ceci n'atteint le bundle.
// ---------------------------------------------------------------------------

import type {
  CupStatus as SchemaCupStatus,
  RatingScale as SchemaRatingScale,
} from "~/server/db/schema/cups";
import type { JuryPanel as SchemaJuryPanel } from "~/server/db/schema/juries";

/** `true` seulement si A et B décrivent exactement le même union. */
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

/** Échoue à la compilation dès que l'argument n'est pas `true`. */
type AssertTrue<T extends true> = T;

type _JuryPanelMatchesSchema = AssertTrue<Equal<JuryPanel, SchemaJuryPanel>>;
type _CupStatusMatchesSchema = AssertTrue<Equal<CupStatus, SchemaCupStatus>>;
type _RatingScaleMatchesSchema = AssertTrue<Equal<RatingScale, SchemaRatingScale>>;
