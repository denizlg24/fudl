import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@repo/db";
import { haveIBeenPwned, organization } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { authEnv } from "@repo/env/auth";
import { Resend } from "resend";
import {
  verificationEmail,
  resetPasswordEmail,
  invitationEmail,
} from "@repo/email";

const prismaClient = prisma;
const resend = new Resend(authEnv.RESEND_API_KEY);

const webAppUrl =
  authEnv.NODE_ENV === "production"
    ? (authEnv.WEB_APP_URL ?? "http://localhost:3000")
    : "http://localhost:3000";

/** Send an email via Resend and log failures. */
async function sendEmail(
  to: string,
  template: { subject: string; html: string },
) {
  const { error } = await resend.emails.send({
    from: authEnv.EMAIL_FROM,
    to,
    subject: template.subject,
    html: template.html,
  });
  if (error) {
    console.error(
      `[FUDL] Failed to send "${template.subject}" to ${to}:`,
      error,
    );
  }
}

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
          Boolean(url),
        )
      : ["http://localhost:3000", "http://localhost:3002"],

  database: prismaAdapter(prismaClient, {
    provider: "postgresql",
  }),

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: false,
    async sendVerificationEmail({ user, url }) {
      await sendEmail(
        user.email,
        verificationEmail({ userName: user.name, url }),
      );
    },
  },

  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
    async sendResetPassword({ user, url }) {
      await sendEmail(
        user.email,
        resetPasswordEmail({ userName: user.name, url }),
      );
    },
  },

  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          // Auto-set active organization on login
          const member = await prismaClient.member.findFirst({
            where: { userId: session.userId },
            orderBy: { createdAt: "desc" },
          });
          if (member) {
            return {
              data: {
                ...session,
                activeOrganizationId: member.organizationId,
              },
            };
          }
          return { data: session };
        },
      },
    },
  },

  experimental: { joins: true },
  plugins: [
    haveIBeenPwned(),
    organization({
      async sendInvitationEmail(data) {
        const inviteLink = `${webAppUrl}/invite?id=${data.id}`;
        await sendEmail(
          data.email,
          invitationEmail({
            inviterName: data.inviter.user.name ?? data.inviter.user.email,
            organizationName: data.organization.name,
            role: data.role,
            inviteLink,
          }),
        );
      },
    }),
    nextCookies(),
  ],
});
