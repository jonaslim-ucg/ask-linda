# Getting Started

Complete guide to set up the **Ask Linda** AI Chatbot project locally.

---

## Prerequisites

Make sure you have the following installed before proceeding:

| Tool       | Minimum Version | Check Command        |
| ---------- | --------------- | -------------------- |
| **Node.js** | 20.9.0+        | `node -v`            |
| **npm**     | 10+            | `npm -v`             |
| **Git**     | Any recent     | `git --version`      |

> **Tip:** Use [nvm](https://github.com/nvm-sh/nvm) (Linux/macOS) or [nvm-windows](https://github.com/coreybutler/nvm-windows) to manage Node.js versions.

---

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd AskLinda
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Open `.env` and update all placeholder values. See [Environment Variables](./02-environment-variables.md) for detailed explanations of each variable.

### 4. Set Up the Database

The project uses **PostgreSQL** with **Drizzle ORM**. You need a PostgreSQL database (we recommend [Neon](https://neon.tech/) for serverless Postgres).

Generate and run database migrations:

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

See [Database Setup](./03-database.md) for detailed instructions.

### 5. Set Up External Services

This project depends on several external services that must be configured:

| Service      | Purpose                        | Documentation                           |
| ------------ | ------------------------------ | --------------------------------------- |
| **OpenAI**   | LLM for chat & image analysis  | [AI & RAG Setup](./06-ai-and-rag.md)   |
| **Pinecone** | Vector database for RAG        | [AI & RAG Setup](./06-ai-and-rag.md)   |
| **Cohere**   | Embedding model                | [AI & RAG Setup](./06-ai-and-rag.md)   |
| **AWS S3**   | File storage                   | [S3 Storage](./05-s3-storage.md)       |
| **SMTP**     | Email (password reset, verify) | [Email / SMTP](./07-email-smtp.md)     |

### 6. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Command           | Description                                |
| ----------------- | ------------------------------------------ |
| `npm run dev`     | Start development server (hot reload)      |
| `npm run build`   | Build for production                       |
| `npm run start`   | Start production server                    |
| `npm run lint`    | Run ESLint                                 |
| `npx drizzle-kit generate` | Generate database migrations      |
| `npx drizzle-kit migrate`  | Apply database migrations         |
| `npx drizzle-kit studio`   | Open Drizzle Studio (DB browser)  |

---

## First Admin User

After setting up the application, the first user to sign up will be a regular `user`. To create an admin:

1. Sign up a new user at `/auth/signup`
2. Access your database directly (via Drizzle Studio or SQL client)
3. Update the user's `role` column in the `user` table to `"admin"`

```sql
UPDATE "user" SET role = 'admin' WHERE email = 'your-email@example.com';
```

Once you have an admin user, you can manage other users from the **Admin Panel** at `/admin`.

---

## Troubleshooting

### Common Issues

| Problem                          | Solution                                                            |
| -------------------------------- | ------------------------------------------------------------------- |
| `Module not found` errors        | Run `npm install` again                                             |
| Database connection fails        | Check `DATABASE_URL` in `.env` — ensure the DB is accessible       |
| S3 upload fails                  | Verify AWS credentials and bucket CORS configuration                |
| Emails not sending               | Check SMTP credentials — see [Email / SMTP](./07-email-smtp.md)   |
| 2FA redirect loop                | Ensure `/auth/two-factor` route exists and is public                |
| Build fails with type errors     | Run `npx tsc --noEmit` to see all type issues                      |

### Getting Help

If you encounter issues not covered in this documentation:

1. Check the terminal output for error messages
2. Review the relevant doc section for configuration details
3. Ensure all environment variables are correctly set
4. Try deleting `node_modules` and `.next`, then reinstalling

```bash
rm -rf node_modules .next
npm install
npm run dev
```

---

**Next:** [Environment Variables →](./02-environment-variables.md)
