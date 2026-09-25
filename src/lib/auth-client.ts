import { createAuthClient } from "better-auth/react";

// Use empty baseURL to make requests relative to current origin
export const authClient = createAuthClient({
  baseURL: "",
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
