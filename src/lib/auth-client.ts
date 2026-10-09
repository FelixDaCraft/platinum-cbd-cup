import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./auth";

// Use empty baseURL to make requests relative to current origin
export const authClient = createAuthClient({
  baseURL: "",
  // Types des champs utilisateur ajoutés côté serveur (role, champs
  // d'inscription producteur…), pour signUp.email et useSession.
  plugins: [inferAdditionalFields<typeof auth>()],
});

export const { signIn, signOut, signUp, useSession } = authClient;

// Renvoi du lien de confirmation : appelable sans session (l'endpoint reste
// neutre pour une adresse inconnue), utilisé par /login quand la connexion
// est refusée avec EMAIL_NOT_VERIFIED.
export const sendVerificationEmail = authClient.sendVerificationEmail;

// Password functions
export const forgetPassword = authClient.requestPasswordReset;
export const resetPassword = authClient.resetPassword;
export const changePassword = authClient.changePassword;
