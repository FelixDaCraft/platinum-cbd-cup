/**
 * Validation du contenu riche TipTap reçu du client.
 *
 * Les documents de l'éditeur arrivaient en `z.record(z.unknown())`, c'est-à-dire
 * « n'importe quel objet JSON ». Trois conséquences concrètes :
 *
 * - un document imbriqué à l'infini (quelques lignes de script suffisent à en
 *   fabriquer un) était accepté puis stocké ; le rendu serveur de la page
 *   article le parcourt récursivement et tombait en dépassement de pile — un
 *   500 sur une page publique, et l'article devenu impossible à rouvrir pour
 *   le corriger ;
 * - un `href` ou un `src` en `javascript:` déposé dans le JSON ressortait tel
 *   quel dans le `<a href>` / `<img src>` du portail ;
 * - la table `articles` accumulait des clés arbitraires que rien ne relisait.
 *
 * Le schéma ci-dessous borne la forme (types de nœuds, attributs primitifs),
 * la profondeur et la taille, et filtre les URL. Il est volontairement
 * permissif sur les noms de nœuds et de marques inconnus du rendu : ceux-ci
 * sont déjà ignorés à l'affichage, alors qu'un refus casserait la
 * réenregistrement d'un article existant.
 */

import { z } from "zod";

/**
 * Profondeur maximale d'imbrication. L'éditeur du dashboard (StarterKit +
 * lien, souligné, alignement) produit au plus 4 niveaux
 * (doc > liste > élément > paragraphe > texte) ; 12 laisse une marge
 * confortable tout en gardant le rendu récursif dans la pile.
 */
const MAX_DEPTH = 12;

/** Nombre total de nœuds. Un article long en compte quelques centaines. */
const MAX_NODES = 10_000;

/** Enfants directs d'un nœud, garde-fou local avant le plafond global. */
const MAX_CHILDREN = 2_000;

/** Taille d'un fragment de texte. */
const MAX_TEXT_LENGTH = 50_000;

/** Marques portées par un même fragment (gras + italique + lien + …). */
const MAX_MARKS = 16;

/**
 * Valeurs d'attributs admises : primitives uniquement. TipTap n'en produit
 * pas d'autres (niveau de titre, alignement, href, dimensions d'image), et
 * les interdire empêche d'utiliser `attrs` comme soute à JSON arbitraire.
 */
const attrValueSchema = z.union([
  z.string().max(2_000),
  z.number(),
  z.boolean(),
  z.null(),
]);

const attrsSchema = z.record(attrValueSchema);

const markSchema = z.object({
  type: z.string().min(1).max(64),
  attrs: attrsSchema.optional(),
});

/** Nœud TipTap tel qu'il ressort de `editor.getJSON()`. */
export interface TipTapNode {
  type: string;
  attrs?: Record<string, string | number | boolean | null>;
  text?: string;
  marks?: { type: string; attrs?: Record<string, string | number | boolean | null> }[];
  content?: TipTapNode[];
}

const baseNodeSchema = z.object({
  type: z.string().min(1).max(64),
  attrs: attrsSchema.optional(),
  text: z.string().max(MAX_TEXT_LENGTH).optional(),
  marks: z.array(markSchema).max(MAX_MARKS).optional(),
});

/**
 * Construit le schéma d'un nœud pour une profondeur restante donnée.
 *
 * La récursion est déroulée à la construction plutôt que confiée à `z.lazy` :
 * `z.lazy` accepterait une imbrication illimitée, ce qui est précisément le
 * défaut qu'on ferme ici. Au dernier niveau, `content` ne peut plus être que
 * vide — le document est refusé avec un message lisible, pas tronqué en
 * silence.
 */
function buildNodeSchema(remainingDepth: number): z.ZodType<TipTapNode> {
  if (remainingDepth <= 0) {
    return baseNodeSchema.extend({
      content: z
        .array(z.unknown())
        .max(0, `Contenu trop imbriqué (maximum ${MAX_DEPTH} niveaux)`)
        .optional(),
    }) as unknown as z.ZodType<TipTapNode>;
  }

  return baseNodeSchema.extend({
    content: z
      .array(buildNodeSchema(remainingDepth - 1))
      .max(MAX_CHILDREN, "Trop d'éléments dans un même bloc")
      .optional(),
  }) as unknown as z.ZodType<TipTapNode>;
}

const nodeSchema = buildNodeSchema(MAX_DEPTH);

/**
 * Attributs qui finissent dans un `href` ou un `src` du portail, par type de
 * nœud ou de marque.
 */
const URL_ATTRS_BY_TYPE: Record<string, string[]> = {
  link: ["href"],
  image: ["src"],
};

/**
 * Une URL n'est acceptée que si le navigateur la traitera comme une
 * navigation ou un chargement d'image. `javascript:` et `data:` sont refusés :
 * l'article est rendu côté serveur dans un `<a href>` / `<img src>` bruts, une
 * de ces URL y devient du code exécuté chez le lecteur.
 */
const SAFE_URL = /^(?:https?:\/\/|mailto:|tel:|\/|#)/i;

/**
 * Parcours itératif (pile explicite, pas de récursion : on refuse justement
 * des documents trop profonds pour la pile) qui applique les bornes globales.
 */
function checkDocument(doc: TipTapNode, ctx: z.RefinementCtx): void {
  const stack: TipTapNode[] = [doc];
  let nodeCount = 0;

  while (stack.length > 0) {
    const node = stack.pop()!;
    nodeCount++;

    if (nodeCount > MAX_NODES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Contenu trop volumineux (maximum ${MAX_NODES} blocs)`,
      });
      return;
    }

    for (const [type, attrs] of [
      [node.type, node.attrs] as const,
      ...(node.marks ?? []).map((m) => [m.type, m.attrs] as const),
    ]) {
      for (const attrName of URL_ATTRS_BY_TYPE[type] ?? []) {
        const value = attrs?.[attrName];
        if (typeof value === "string" && value !== "" && !SAFE_URL.test(value)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Lien non autorisé dans le contenu : ${attrName} doit être une adresse http(s), mailto, tel ou relative`,
          });
          return;
        }
      }
    }

    if (node.content) {
      for (const child of node.content) stack.push(child);
    }
  }
}

/**
 * Document TipTap complet, tel que l'éditeur du dashboard le sérialise.
 *
 * Partagé par toutes les mutations qui acceptent du contenu riche, pour que
 * les bornes soient les mêmes partout et ne se perdent pas à la prochaine
 * page d'édition ajoutée.
 */
export const tiptapDocumentSchema = z
  .object({
    type: z.literal("doc"),
    attrs: attrsSchema.optional(),
    content: z
      .array(nodeSchema)
      .max(MAX_CHILDREN, "Trop de blocs dans le document")
      .optional(),
  })
  .superRefine((doc, ctx) => {
    checkDocument(doc as TipTapNode, ctx);
  });

export type TipTapDocument = z.infer<typeof tiptapDocumentSchema>;

/**
 * Version à brancher sur `.input()` d'une mutation tRPC.
 *
 * Le type d'entrée reste `Record<string, unknown>`, celui que les formulaires
 * du dashboard produisent aujourd'hui (`JSON.parse` du contenu de l'éditeur,
 * sans typage plus fin). Seule la sortie est le document validé : le contrôle
 * est bien fait à l'exécution, sans exiger que chaque appelant soit retypé
 * d'abord — ce qui aurait rendu la validation impossible à poser sans toucher
 * simultanément à tous les formulaires.
 */
export const tiptapDocumentInput = z
  .record(z.unknown())
  .pipe(tiptapDocumentSchema);
