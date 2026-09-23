import { createAuthClient } from "better-auth/react";

// Use empty baseURL to make requests relative to current origin
export const authClient = createAuthClient({
  baseURL: "",
});

export const { signIn, signOut, signUp, useSession } = authClient;

// Password functions
export const forgetPassword = authClient.requestPasswordReset;
export const resetPassword = authClient.resetPassword;
export const changePassword = authClient.changePassword;
