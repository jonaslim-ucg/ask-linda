import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { twoFactor } from "better-auth/plugins";
import { db } from "@/db";
import { authSettings } from "@/db/schema";
import { sendEmail } from "./email";
import { eq } from "drizzle-orm";

const ADMIN_ROLES = ["admin"] as const;

async function isRegistrationEnabled(): Promise<boolean> {
  try {
    const settings = await db.query.authSettings.findFirst({
      where: eq(authSettings.id, "default"),
    });
    return settings?.registrationEnabled ?? true;
  } catch {
    return true; // Default to enabled if error
  }
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your password",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Reset Your Password</h2>
            <p>Hi ${user.name || "there"},</p>
            <p>You requested to reset your password. Click the button below to proceed:</p>
            <a href="${url}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Reset Password
            </a>
            <p>If you didn't request this, you can safely ignore this email.</p>
            <p>This link will expire in 1 hour.</p>
          </div>
        `,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your email address",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Verify Your Email</h2>
            <p>Hi ${user.name || "there"},</p>
            <p>Thank you for signing up! Please verify your email address by clicking the button below:</p>
            <a href="${url}" style="display: inline-block; background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
              Verify Email
            </a>
            <p>If you didn't create an account, you can safely ignore this email.</p>
          </div>
        `,
      });
    },
    autoSignInAfterVerification: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  appName: "Ask Linda",
  plugins: [
    nextCookies(),
    admin({
      defaultRole: "user",
      adminRoles: [...ADMIN_ROLES],
    }),
    twoFactor({
      issuer: "Ask Linda",
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        before: async (_user, context) => {
          const enabled = await isRegistrationEnabled();
          if (enabled) return;

          const isAdminEndpoint = context?.path?.startsWith("/admin/") ?? false;
          const isAdminSession = ADMIN_ROLES.includes(
            context?.context?.session?.user?.role ?? "",
          );

          if (isAdminEndpoint || isAdminSession) return;

          throw new Error("Registration is currently disabled");
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
