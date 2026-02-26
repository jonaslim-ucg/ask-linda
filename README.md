# Ask Linda — AI Chatbot

An AI-powered document assistant built with Next.js, OpenAI, and RAG (Retrieval-Augmented Generation). Users can upload documents and chat with an AI that searches and references their content.

## Key Features

- **AI Chat** — Conversational AI powered by OpenAI with streaming responses
- **Document RAG** — Upload PDF, DOCX, TXT, XLSX files and ask questions about them
- **Admin Library** — Organization-wide knowledge base managed by admins
- **Image Analysis** — Upload images for GPT vision analysis
- **Authentication** — Email/password with 2FA, admin roles, user management
- **Admin Panel** — Dashboard with stats, user management, document management

## Tech Stack

| Layer         | Technology                              |
| ------------- | --------------------------------------- |
| Framework     | Next.js (App Router) + React 19        |
| AI            | Vercel AI SDK + OpenAI                  |
| Embeddings    | Cohere embed-v4.0                       |
| Vector DB     | Pinecone                                |
| Database      | PostgreSQL + Drizzle ORM                |
| Auth          | Better Auth                             |
| Storage       | AWS S3                                  |
| Styling       | Tailwind CSS v4 + shadcn/ui            |

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your values

# Run database migrations
npx drizzle-kit generate
npx drizzle-kit migrate

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Documentation

Full documentation is available in the [`docs/`](./docs/) folder:

| #  | Document                                                   | Description                              |
| -- | ---------------------------------------------------------- | ---------------------------------------- |
| 00 | [Simple Install](./docs/00-simple-install.md)              | Quick 5-minute setup guide               |
| 01 | [Getting Started](./docs/01-getting-started.md)            | Installation and initial setup           |
| 02 | [Environment Variables](./docs/02-environment-variables.md) | All env vars explained                   |
| 03 | [Database Setup](./docs/03-database.md)                    | PostgreSQL + Drizzle ORM setup           |
| 04 | [Project Architecture](./docs/04-architecture.md)          | Folder structure, API routes, data flow  |
| 05 | [S3 Storage Setup](./docs/05-s3-storage.md)                | AWS S3 bucket and IAM configuration      |
| 06 | [AI & RAG Setup](./docs/06-ai-and-rag.md)                  | OpenAI, Cohere, Pinecone configuration   |
| 07 | [Email / SMTP Setup](./docs/07-email-smtp.md)              | SMTP configuration for emails            |
| 08 | [Authentication](./docs/08-authentication.md)              | Better Auth, 2FA, roles, middleware      |
| 09 | [Deployment](./docs/09-deployment.md)                      | Vercel, Railway, Docker deployment       |

## Scripts

| Command                   | Description                     |
| ------------------------- | ------------------------------- |
| `npm run dev`             | Start dev server                |
| `npm run build`           | Production build                |
| `npm run start`           | Start production server         |
| `npm run lint`            | Run ESLint                      |
| `npx drizzle-kit generate` | Generate DB migrations        |
| `npx drizzle-kit migrate`  | Apply DB migrations           |
| `npx drizzle-kit studio`   | Open Drizzle Studio           |

## License

Private — All rights reserved.

