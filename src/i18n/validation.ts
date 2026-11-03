/**
 * Messages de validation dans la langue de l'interface.
 *
 * Les schémas Zod sont partagés entre client et serveur et rédigés en
 * français ; plutôt que de les dupliquer par langue, l'interface traduit
 * leurs messages connus au moment de les afficher (espace `validation`).
 * Un message absent de la table s'affiche tel quel.
 */
const KNOWN: Record<string, string> = {
  "L'email est requis": "emailRequired",
  "Format d'email invalide": "emailInvalid",
  "Adresse email invalide": "emailInvalid",
  "Email invalide": "emailInvalid",
  "Le mot de passe est requis": "passwordRequired",
  "Le mot de passe doit contenir au moins 12 caractères": "passwordMin",
  "Le mot de passe doit contenir au moins une majuscule": "passwordUpper",
  "Le mot de passe doit contenir au moins un chiffre": "passwordDigit",
  "Le mot de passe doit contenir au moins un caractère spécial": "passwordSpecial",
  "Confirmez votre mot de passe": "confirmRequired",
  "Les mots de passe ne correspondent pas": "passwordMismatch",
  "Le nom est requis": "nameRequired",
  "Le nom de l'entreprise est requis": "companyRequired",
  "Le nom de l'entreprise ne peut pas dépasser 100 caractères": "companyMax",
  "Le nom de la marque est requis": "brandRequired",
  "Le nom de la marque ne peut pas dépasser 100 caractères": "brandMax",
  "Le numéro de téléphone est requis": "phoneRequired",
  "Numéro invalide : 06 12 34 56 78 ou +33 6 12 34 56 78": "phoneInvalid",
  "Le SIRET doit contenir exactement 14 chiffres": "siret",
  "Format d'URL invalide": "urlInvalid",
  "Compte Instagram invalide : @compte ou lien vers le profil": "instagramInvalid",
  "Nom du produit requis": "productNameRequired",
  "Nom trop long": "nameTooLong",
  "Description trop longue": "descriptionTooLong",
};

export function validationKey(message: string | undefined | null): string | null {
  if (!message) return null;
  return KNOWN[message.trim()] ?? null;
}

/** Message traduit, ou le message d'origine s'il n'est pas répertorié. */
export function translateValidation(
  message: string | undefined | null,
  t: (key: string) => string
): string {
  if (!message) return "";
  const key = validationKey(message);
  return key ? t(key) : message;
}

/** Pour enrichir la table depuis d'autres modules (messages des formulaires). */
export function registerValidationMessages(entries: Record<string, string>): void {
  Object.assign(KNOWN, entries);
}
