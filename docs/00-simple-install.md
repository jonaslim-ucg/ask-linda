# Simple Installation Guide

Get **Ask Linda** running locally in 5 minutes.

---

## Prerequisites

- **Node.js** 20.9.0 or higher — [download](https://nodejs.org/)
- **PostgreSQL** database — [Neon](https://neon.tech/) (free) recommended
- **API keys** for: OpenAI, Pinecone, Cohere, AWS S3, SMTP

---

## Step 1: Clone & Install

```bash
git clone <repository-url>
cd AskLinda
npm install
```

---

## Step 2: Environment Variables

```bash
cp .env.example .env
```

Open `.env` and fill in all values:

```env
# Database (PostgreSQL connection string)
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# OpenAI (https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-your-key

# AWS S3 (for file uploads)
NEXT_S3_UPLOAD_BUCKET=your-bucket-name
NEXT_S3_UPLOAD_REGION=eu-west-2
NEXT_S3_UPLOAD_ACCESS_KEY_ID=your-access-key
NEXT_S3_UPLOAD_SECRET_ACCESS_KEY=your-secret-key

# Pinecone (https://app.pinecone.io — create 2 indexes with 1536 dimensions)
PINECONE_API_KEY=your-pinecone-key
CHATBOT_PINECONE_INDEX_NAME=chatbot
LIBRARY_PINECONE_INDEX_NAME=library

# Cohere (https://dashboard.cohere.com/api-keys)
COHERE_API_KEY=your-cohere-key

# Better Auth (generate secret: openssl rand -base64 32)
BETTER_AUTH_SECRET=your-random-secret-key
BETTER_AUTH_URL=http://localhost:3000

# SMTP (for password reset & email verification)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_MAIL=your-email@gmail.com
SMTP_PASSWORD=your-app-password
```

---

## Step 3: Set Up Database

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

---

## Step 4: Create Pinecone Indexes

Go to [app.pinecone.io](https://app.pinecone.io/) and create two indexes:

| Index Name | Dimensions | Metric |
| ---------- | ---------- | ------ |
| `chatbot`  | 1536       | cosine |
| `library`  | 1536       | cosine |

---

## Step 5: Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — done!

---

## Step 6: Create Admin User

1. Sign up at `/auth/signup`
2. Run this SQL on your database:

```sql
UPDATE "user" SET role = 'admin' WHERE email = 'your-email@example.com';
```

3. Access the admin panel at `/admin`

---

## Need More Details?

See the full documentation:

| Doc | Topic |
| --- | ----- |
| [01 — Getting Started](./01-getting-started.md) | Detailed setup with troubleshooting |
| [02 — Environment Variables](./02-environment-variables.md) | Every env var explained |
| [03 — Database](./03-database.md) | PostgreSQL & Drizzle ORM |
| [04 — Architecture](./04-architecture.md) | Project structure & API routes |
| [05 — S3 Storage](./05-s3-storage.md) | AWS S3 bucket setup |
| [06 — AI & RAG](./06-ai-and-rag.md) | OpenAI, Cohere, Pinecone |
| [07 — Email / SMTP](./07-email-smtp.md) | SMTP provider setup |
| [08 — Authentication](./08-authentication.md) | Better Auth, 2FA, roles |
| [09 — Deployment](./09-deployment.md) | Vercel, Railway, Docker |

