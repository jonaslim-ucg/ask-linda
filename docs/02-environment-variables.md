# Environment Variables

All environment variables are stored in the `.env` file at the project root. Copy `.env.example` to `.env` and fill in the values.

```bash
cp .env.example .env
```

> **Important:** Never commit `.env` to version control. Only `.env.example` (with placeholder values) should be committed.

---

## Complete Reference

### Database

| Variable       | Required | Description                                                        | Example                                                    |
| -------------- | -------- | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| `DATABASE_URL` | Yes      | PostgreSQL connection string. Supports Neon, Supabase, or self-hosted. | `postgresql://user:password@host:5432/dbname?sslmode=require` |

---

### OpenAI

| Variable        | Required | Description                              | Example                  |
| --------------- | -------- | ---------------------------------------- | ------------------------ |
| `OPENAI_API_KEY` | Yes     | API key from [OpenAI Platform](https://platform.openai.com/api-keys). Used for chat completions, image analysis, and title generation. | `sk-proj-...` |

---

### AWS S3 (File Storage)

| Variable                        | Required | Description                                      | Example              |
| ------------------------------- | -------- | ------------------------------------------------ | -------------------- |
| `NEXT_S3_UPLOAD_BUCKET`         | Yes      | S3 bucket name for file uploads                  | `my-chatbot-bucket`  |
| `NEXT_S3_UPLOAD_REGION`         | Yes      | AWS region where the bucket is located            | `eu-west-2`          |
| `NEXT_S3_UPLOAD_ACCESS_KEY_ID`  | Yes      | AWS IAM access key ID with S3 permissions         | `AKIA...`            |
| `NEXT_S3_UPLOAD_SECRET_ACCESS_KEY` | Yes   | AWS IAM secret access key                         | `dv9k...`            |

See [S3 Storage Setup](./05-s3-storage.md) for bucket creation and IAM configuration.

---

### Pinecone (Vector Database)

| Variable                        | Required | Description                                                      | Example          |
| ------------------------------- | -------- | ---------------------------------------------------------------- | ---------------- |
| `PINECONE_API_KEY`              | Yes      | API key from [Pinecone Console](https://app.pinecone.io/)       | `pcsk_...`       |
| `CHATBOT_PINECONE_INDEX_NAME`   | Yes      | Index name for per-chat user document vectors                    | `chatbot`        |
| `LIBRARY_PINECONE_INDEX_NAME`   | Yes      | Index name for admin-uploaded library document vectors            | `library`        |

See [AI & RAG Setup](./06-ai-and-rag.md) for index configuration.

---

### Cohere (Embeddings)

| Variable        | Required | Description                                                       | Example          |
| --------------- | -------- | ----------------------------------------------------------------- | ---------------- |
| `COHERE_API_KEY` | Yes     | API key from [Cohere Dashboard](https://dashboard.cohere.com/api-keys). Used for `embed-v4.0` embeddings. | `olAd...` |

---

### Better Auth

| Variable             | Required | Description                                                                 | Example                            |
| -------------------- | -------- | --------------------------------------------------------------------------- | ---------------------------------- |
| `BETTER_AUTH_SECRET` | Yes      | Random secret used to sign sessions and tokens. Generate with `openssl rand -base64 32`. | `a1b2c3d4...` (32+ chars)         |
| `BETTER_AUTH_URL`    | Yes      | Base URL of your application. Used for callbacks and email links.            | `http://localhost:3000`            |

---

### SMTP (Email)

| Variable        | Required | Description                                                   | Example              |
| --------------- | -------- | ------------------------------------------------------------- | -------------------- |
| `SMTP_HOST`     | Yes      | SMTP server hostname                                          | `smtp.gmail.com`     |
| `SMTP_PORT`     | No       | SMTP port (defaults to `587`)                                 | `587`                |
| `SMTP_MAIL`     | Yes      | Sender email address (also used in the "from" field)          | `noreply@company.com` |
| `SMTP_PASSWORD` | Yes      | SMTP password or app-specific password                        | `xxxx xxxx xxxx xxxx` |

See [Email / SMTP Setup](./07-email-smtp.md) for provider-specific instructions.

---

## Example `.env` File

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# OpenAI
OPENAI_API_KEY=sk-your-openai-api-key

# AWS S3
NEXT_S3_UPLOAD_BUCKET=your-bucket-name
NEXT_S3_UPLOAD_REGION=your-region
NEXT_S3_UPLOAD_ACCESS_KEY_ID=your-access-key-id
NEXT_S3_UPLOAD_SECRET_ACCESS_KEY=your-secret-access-key

# Pinecone
PINECONE_API_KEY=your-pinecone-api-key
CHATBOT_PINECONE_INDEX_NAME=chatbot
LIBRARY_PINECONE_INDEX_NAME=library

# Cohere
COHERE_API_KEY=your-cohere-api-key

# Better Auth
BETTER_AUTH_SECRET=your-random-secret-key
BETTER_AUTH_URL=http://localhost:3000

# SMTP
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_MAIL=your-email@example.com
SMTP_PASSWORD=your-smtp-password
```

---

## Security Notes

- **Rotate keys immediately** if `.env` is accidentally committed to git
- Use **app-specific passwords** for SMTP (Gmail, Outlook) rather than your account password
- Use IAM roles with **least-privilege** S3 permissions
- Store production secrets in your hosting provider's environment variable management (Vercel, Railway, etc.)

---

**Previous:** [← Getting Started](./01-getting-started.md) | **Next:** [Database Setup →](./03-database.md)
