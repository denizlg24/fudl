import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@repo/db";
import { haveIBeenPwned, organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { authEnv } from "@repo/env/auth";

const prismaClient = prisma;

export const auth = betterAuth({
  appName: "Fudl",
  basePath: "/v1/auth",
  baseURL: authEnv.BETTER_AUTH_URL,
  advanced: {
    cookiePrefix: "fudl_auth",
    useSecureCookies: authEnv.NODE_ENV === "production",
  },

  trustedOrigins:
    authEnv.NODE_ENV === "production"
      ? [authEnv.WEB_APP_URL, authEnv.API_URL].filter((url): url is string =>
          Boolean(url)
        )
      : ["http://localhost:3000", "http://localhost:3002"],

  database: prismaAdapter(prismaClient, {
    provider: "postgresql",
  }),

  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
  },

  experimental: { joins: true },
  plugins: [haveIBeenPwned(), organization(), nextCookies()],
});
