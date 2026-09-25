/**
 * Générateur d'identifiants des tables métier.
 *
 * Même format que `nanoid()` (21 caractères, alphabet URL-safe) pour rester
 * compatible avec les ids déjà en base et ceux que les routers génèrent
 * eux-mêmes. On ne dépend volontairement PAS du paquet `nanoid` ici : les
 * fichiers de schéma sont chargés par drizzle-kit (`generate` en local,
 * `migrate` en CI, tous deux en Node 20), qui les transpile en CJS — or
 * nanoid v5 est ESM-only et un `require` échouerait pendant le déploiement.
 * `crypto` global suffit et n'a aucune dépendance.
 */

// Alphabet de nanoid : 64 caractères, donc `octet & 63` est équiprobable
// (pas de biais modulo).
const ALPHABET =
  "useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict";

const ID_LENGTH = 21;

export const generateId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  let id = "";
  for (const byte of bytes) {
    // `byte & 63` reste dans [0, 63] : l'index existe toujours.
    id += ALPHABET.charAt(byte & 63);
  }
  return id;
};
