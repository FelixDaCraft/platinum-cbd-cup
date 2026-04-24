import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

// Use empty baseURL to make requests relative to current origin
// This allows auth to work on both main domain and portal subdomains
export const authClient = createAuthClient({
  baseURL: "",
  plugins: [organizationClient()],
});

export const { signIn, signOut, signUp, useSession } = authClient;

// Password functions
export const forgetPassword = authClient.requestPasswordReset;
export const resetPassword = authClient.resetPassword;
export const changePassword = authClient.changePassword;

// Organization functions
export const {
  organization,
  useActiveOrganization,
  useListOrganizations,
} = authClient;
