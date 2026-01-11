import { createAuthClient } from "better-auth/react";
import {
  inferAdditionalFields,
  inferOrgAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";
import { auth } from "./server";
import { clientEnv } from "@repo/env/web";

export const authClient = createAuthClient({
  baseURL: clientEnv.NEXT_PUBLIC_API_URL + "/auth",
  plugins: [
    inferAdditionalFields<typeof auth>(),
    organizationClient({
      schema: inferOrgAdditionalFields<typeof auth>(),
    }),
  ],
});

export const {
  useSession,
  signIn,
  signUp,
  signOut,
} = authClient;
