# Database Setup

The project uses **PostgreSQL** with **Drizzle ORM** for database management.

---

## Database Provider

We recommend using [Neon](https://neon.tech/) for a serverless PostgreSQL database. Other supported options:

| Provider      | Type             | Free Tier | Link                                      |
| ------------- | ---------------- | --------- | ----------------------------------------- |
| **Neon**      | Serverless PG    | Yes       | [neon.tech](https://neon.tech/)           |
| **Supabase**  | Managed PG       | Yes       | [supabase.com](https://supabase.com/)     |
| **Railway**   | Managed PG       | Yes       | [railway.app](https://railway.app/)       |
| **Local PG**  | Self-hosted      | Free      | [postgresql.org](https://www.postgresql.org/) |

---

## Setting Up with Neon (Recommended)

1. Create a free account at [neon.tech](https://neon.tech/)
2. Create a new project
3. Copy the connection string from the dashboard
4. Add it to your `.env` file:

```env
DATABASE_URL=postgresql://user:password@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require
```

> **Note:** The Drizzle config reads from `.env`. Make sure `DATABASE_URL` is set before running any migration commands.

---

## Database Schema

The schema is defined in `db/schema.ts`. Here are all the tables:

### Authentication Tables (Better Auth)

| Table          | Purpose                                      |
| -------------- | -------------------------------------------- |
| `user`         | User accounts with roles (`user` / `admin`), ban status, 2FA flag |
| `session`      | Active sessions with tokens, IP, user agent, impersonation support |
| `account`      | OAuth/password accounts linked to users      |
| `verification` | Email verification and password reset tokens |
| `twoFactor`    | TOTP secrets and backup codes for 2FA        |

### Chat Tables

| Table     | Purpose                                             |
| --------- | --------------------------------------------------- |
| `chat`    | Chat conversations linked to users                  |
| `message` | Messages within chats (`user` / `assistant` roles)  |

### RAG (Per-Chat Documents) Tables

| Table         | Purpose                                                  |
| ------------- | -------------------------------------------------------- |
| `ragDocument` | User-uploaded documents with processing status           |
| `ragChunk`    | Individual text chunks from processed documents          |

### Admin Library Tables

| Table             | Purpose                                                   |
| ----------------- | --------------------------------------------------------- |
| `libraryDocument` | Admin-uploaded organization-wide documents                |
| `libraryChunk`    | Individual text chunks from library documents             |

### Other Tables

| Table            | Purpose                                          |
| ---------------- | ------------------------------------------------ |
| `imageAnalysis`  | Records of GPT vision analysis for uploaded images |
| `authSettings`   | Global settings: registration toggle, maintenance mode |

---

## Running Migrations

### Generate Migrations

After modifying `db/schema.ts`, generate a new migration file:

```bash
npx drizzle-kit generate
```

This creates a SQL migration file in the `drizzle/` directory.

### Apply Migrations

Push the migrations to your database:

```bash
npx drizzle-kit migrate
```

### Quick Push (Development Only)

For rapid development, you can push schema changes directly without generating migration files:

```bash
npx drizzle-kit push
```

> **Warning:** `push` is for development only. Always use `generate` + `migrate` for production.

---

## Drizzle Studio

Drizzle Studio provides a visual database browser. Launch it with:

```bash
npx drizzle-kit studio
```

This opens a web UI where you can browse tables, view data, and run queries.

---

## Drizzle Configuration

The `drizzle.config.ts` file configures Drizzle Kit:

```typescript
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

> **Note:** The config loads from `.env.local`. If your `DATABASE_URL` is in `.env`, either copy it to `.env.local` or update the config path.

---

## Database Connection

The database client is initialized in `db/index.ts`:

```typescript
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
});

export const db = drizzle(pool, { schema });
```

Import `db` anywhere in server-side code:

```typescript
import { db } from "@/db";
```

---

## Common Database Operations

### Query Examples

```typescript
import { db } from "@/db";
import { user, chat } from "@/db/schema";
import { eq } from "drizzle-orm";

// Find a user by email
const foundUser = await db.query.user.findFirst({
  where: eq(user.email, "user@example.com"),
});

// Get all chats for a user
const userChats = await db.query.chat.findMany({
  where: eq(chat.userId, "user-id"),
  orderBy: (chat, { desc }) => [desc(chat.createdAt)],
});
```

---

## Resetting the Database

To completely reset and recreate the database:

```bash
npx drizzle-kit drop    # Drop all migrations
npx drizzle-kit generate # Re-generate from schema
npx drizzle-kit migrate  # Apply fresh migrations
```

> **Caution:** This deletes all data. Only do this in development.

---

**Previous:** [← Environment Variables](./02-environment-variables.md) | **Next:** [Project Architecture →](./04-architecture.md)
