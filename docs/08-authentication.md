# Authentication

The project uses **Better Auth** — a TypeScript authentication framework — for user registration, login, sessions, 2FA, and admin roles.

---

## Features

| Feature                 | Status  | Description                                          |
| ----------------------- | ------- | ---------------------------------------------------- |
| Email/Password signup   | Enabled | Users register with email + password                 |
| Email verification      | Enabled | Verification email sent on signup                    |
| Password reset          | Enabled | "Forgot password" flow via email                     |
| Two-Factor Auth (TOTP)  | Enabled | Authenticator app (Google Auth, Authy, etc.)         |
| Admin roles             | Enabled | `user` and `admin` roles                             |
| Session management      | Enabled | 7-day sessions with daily refresh                    |
| User impersonation      | Enabled | Admins can impersonate users                         |
| Registration toggle     | Enabled | Admins can disable new registrations                 |
| Maintenance mode        | Enabled | Admins can put the app in maintenance mode           |
| User ban/unban          | Enabled | Admins can ban users with reason and expiry          |
| Account deletion        | Enabled | Users can delete their own accounts                  |

---

## Architecture

### Server Configuration (`lib/auth.ts`)

The auth server is configured with:

```typescript
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  emailVerification: { sendOnSignUp: true },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,      // 1 day
    cookieCache: { enabled: true, maxAge: 60 * 5 }, // 5 min cache
  },
  plugins: [
    nextCookies(),
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    twoFactor({ issuer: "Ask Linda" }),
  ],
});
```

### Client Configuration (`lib/auth-client.ts`)

```typescript
export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/auth/two-factor";
      },
    }),
  ],
});
```

### API Route (`app/api/auth/[...all]/route.ts`)

All auth endpoints are handled by a single catch-all route using Better Auth's `toNextJsHandler`.

---

## Auth Pages

| Page                      | Route                      | Purpose                        |
| ------------------------- | -------------------------- | ------------------------------ |
| Login                     | `/auth/login`              | Email/password login           |
| Signup                    | `/auth/signup`             | New user registration          |
| Forgot Password           | `/auth/forgot-password`    | Request password reset email   |
| Reset Password            | `/auth/reset-password`     | Set new password (from email)  |
| Admin Login               | `/auth/admin-login`        | Admin-specific login           |
| Two-Factor Setup/Verify   | `/auth/two-factor`         | 2FA configuration and entry    |

---

## Middleware (`proxy.ts`)

The middleware enforces authentication on all routes except public ones:

### Public Routes (no auth required)

- `/auth/login`
- `/auth/signup`
- `/auth/forgot-password`
- `/auth/reset-password`
- `/auth/admin-login`
- `/maintenance`

### Protected Routes

All other routes require authentication. Unauthenticated users are redirected to `/auth/login?callbackUrl=<original-url>`.

### 2FA Enforcement

If a user is authenticated but hasn't enabled 2FA, they are redirected to `/auth/two-factor/setup`.

### Maintenance Mode

When maintenance mode is enabled (via admin settings):
- Only admins can access the app
- All other users see the `/maintenance` page
- The `/auth/admin-login` page remains accessible

---

## User Roles

| Role    | Permissions                                              |
| ------- | -------------------------------------------------------- |
| `user`  | Chat, upload documents, manage own account               |
| `admin` | Everything above + admin panel, user management, library uploads, system settings |

### Creating the First Admin

After initial setup, promote a user to admin via SQL:

```sql
UPDATE "user" SET role = 'admin' WHERE email = 'admin@example.com';
```

After that, admins can manage roles from the **Admin Panel** → **Users**.

---

## Session Configuration

| Setting          | Value       | Description                              |
| ---------------- | ----------- | ---------------------------------------- |
| `expiresIn`      | 7 days      | Session lifetime                         |
| `updateAge`      | 1 day       | How often session is refreshed           |
| `cookieCache`    | 5 minutes   | Client-side session cache duration       |

---

## Registration Control

Admins can toggle user registration on/off:

1. Go to **Admin Panel** → **Settings**
2. Toggle **Registration Enabled**

When disabled:
- Public signup at `/auth/signup` is blocked
- Admins can still create users from the admin panel
- The setting is stored in the `auth_settings` table

---

## Database Hooks

The auth system uses a database hook to enforce registration control:

```typescript
databaseHooks: {
  user: {
    create: {
      before: async (_user, context) => {
        const enabled = await isRegistrationEnabled();
        if (enabled) return;
        // Allow admin-initiated user creation
        const isAdminEndpoint = context?.path?.startsWith("/admin/");
        const isAdminSession = ADMIN_ROLES.includes(
          context?.context?.session?.user?.role ?? ""
        );
        if (isAdminEndpoint || isAdminSession) return;
        throw new Error("Registration is currently disabled");
      },
    },
  },
},
```

---

## Using Auth in Components

### Check Session (Client Component)

```typescript
"use client";
import { useSession } from "@/lib/auth-client";

export function MyComponent() {
  const { data: session, isPending } = useSession();

  if (isPending) return <div>Loading...</div>;
  if (!session) return <div>Not authenticated</div>;

  return <div>Hello, {session.user.name}</div>;
}
```

### Check Session (Server Side)

```typescript
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

const session = await auth.api.getSession({
  headers: await headers(),
});
```

### Sign Out

```typescript
import { signOut } from "@/lib/auth-client";

await signOut();
```

---

## Troubleshooting

| Problem                          | Solution                                                    |
| -------------------------------- | ----------------------------------------------------------- |
| Can't login after signup         | Check if email verification is required                     |
| 2FA redirect loop                | Ensure the 2FA page is accessible and handling state properly |
| `Registration is disabled` error | Check admin settings — registration may be turned off       |
| Session expires too quickly      | Check `session.expiresIn` in auth config                    |
| Admin panel shows "Unauthorized" | Ensure user has `role = 'admin'` in the database            |

---

**Previous:** [← Email / SMTP Setup](./07-email-smtp.md) | **Next:** [Deployment →](./09-deployment.md)
