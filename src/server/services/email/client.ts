import { Resend } from "resend";

import { env } from "~/env";

/**
 * Instance Resend unique du serveur.
 *
 * Six modules instanciaient leur propre client : autant de connexions et,
 * surtout, autant d'endroits à reprendre pour changer de fournisseur ou
 * ajouter un en-tête. L'instanciation est différée pour que le simple import
 * d'un template n'exige pas de clé API.
 */
let client: Resend | null = null;

export function getResendClient(): Resend {
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}
