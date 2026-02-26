# Project Architecture

A high-level overview of the **Ask Linda** AI Chatbot project structure, technology stack, and data flow.

---

## Technology Stack

| Layer            | Technology                                          |
| ---------------- | --------------------------------------------------- |
| **Framework**    | Next.js (App Router) + React 19                     |
| **Language**     | TypeScript                                          |
| **Styling**      | Tailwind CSS v4 + shadcn/ui (radix-maia style)     |
| **Auth**         | Better Auth (email/password, 2FA, admin roles)      |
| **State**        | Redux Toolkit + RTK Query, Zustand                  |
| **Database**     | PostgreSQL via Drizzle ORM                          |
| **AI / LLM**     | Vercel AI SDK + OpenAI                              |
| **Embeddings**   | Cohere `embed-v4.0`                                 |
| **Vector DB**    | Pinecone (2 indexes: chatbot + library)             |
| **Doc Processing**| LlamaIndex readers (PDF, DOCX, TXT, XLSX)          |
| **File Storage** | AWS S3 via `next-s3-upload`                         |
| **Linting**      | ESLint + Ultracite (Biome-based)                    |
| **Email**        | Nodemailer (SMTP)                                   |

---

## Directory Structure

```
AskLinda/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout (fonts, providers, theme)
│   ├── globals.css         # Global Tailwind styles
│   ├── (chat)/             # Chat route group
│   │   ├── layout.tsx      # Chat layout with sidebar
│   │   ├── page.tsx        # New chat page with suggestions
│   │   └── c/              # Individual chat pages (/c/[chatId])
│   ├── admin/              # Admin panel
│   │   ├── layout.tsx      # Admin layout with role check
│   │   ├── page.tsx        # Dashboard (stats, activity)
│   │   ├── users/          # User management
│   │   ├── library/        # Library management (upload/docs)
│   │   ├── chats/          # Chat management
│   │   ├── documents/      # Document management
│   │   └── settings/       # System settings
│   ├── auth/               # Authentication pages
│   │   ├── login/          # Login page
│   │   ├── signup/         # Registration page
│   │   ├── forgot-password/# Password reset request
│   │   ├── reset-password/ # Password reset form
│   │   ├── admin-login/    # Admin login
│   │   └── two-factor/     # 2FA setup & verification
│   ├── api/                # API routes (see API Routes below)
│   └── maintenance/        # Maintenance mode page
├── components/             # React components
│   ├── ui/                 # shadcn/ui primitives
│   ├── ai-elements/        # AI chat UI components
│   ├── chat/               # Chat-specific components
│   ├── admin/              # Admin panel components
│   ├── sidebar/            # Sidebar navigation
│   ├── library/            # Library components
│   ├── providers/          # Context providers
│   └── fallbacks/          # Loading/error fallbacks
├── db/                     # Database layer
│   ├── index.ts            # Drizzle client initialization
│   ├── schema.ts           # All table definitions
│   └── queries.ts          # Reusable DB queries
├── lib/                    # Shared utilities
│   ├── auth.ts             # Better Auth server config
│   ├── auth-client.ts      # Better Auth client config
│   ├── email.ts            # Nodemailer email sender
│   ├── s3-presign.ts       # S3 presigned URL generation
│   ├── store.ts            # Redux store configuration
│   ├── utils.ts            # General utility functions
│   ├── hooks.ts            # Typed Redux hooks
│   └── rag/                # RAG processing module
│       ├── pinecone.ts     # Pinecone client init
│       ├── process-document.ts      # User doc processing
│       ├── process-library-document.ts # Library doc processing
│       └── search.ts       # Vector search functions
├── hooks/                  # Custom React hooks
│   ├── use-mobile.ts       # Mobile detection
│   ├── useS3FileUpload.ts  # Single file S3 upload
│   └── useS3MultiFileUpload.ts # Multi-file S3 upload
├── services/               # RTK Query API services
│   ├── api.ts              # Base API configuration
│   └── user.ts             # User-related endpoints
├── utils/                  # Standalone utilities
│   └── deleteFileFromS3.js # S3 file deletion
├── drizzle/                # Generated migration files
├── proxy.ts                # Next.js middleware
└── docs/                   # Documentation (you are here)
```

---

## API Routes

### Authentication

| Route                        | Method   | Description                              |
| ---------------------------- | -------- | ---------------------------------------- |
| `/api/auth/[...all]`         | GET/POST | Better Auth catch-all handler            |
| `/api/auth-settings`         | GET      | Get registration/maintenance settings    |

### Chat

| Route                        | Method   | Description                              |
| ---------------------------- | -------- | ---------------------------------------- |
| `/api/chat`                  | POST     | Main chat completion (streaming AI)      |
| `/api/chats`                 | GET      | List user's chats                        |
| `/api/chats/[id]`            | GET/DELETE | Get or delete a specific chat           |

### RAG (Documents)

| Route                        | Method     | Description                              |
| ---------------------------- | ---------- | ---------------------------------------- |
| `/api/rag/process`           | POST       | Process uploaded document for RAG        |
| `/api/rag/documents`         | GET        | List user's RAG documents                |
| `/api/rag/documents/[id]`    | GET/DELETE | Get or delete a RAG document             |

### File Storage

| Route                        | Method   | Description                              |
| ---------------------------- | -------- | ---------------------------------------- |
| `/api/s3-presign`            | POST     | Generate presigned GET URLs              |
| `/api/s3-upload`             | POST     | Generate presigned upload URLs           |

### Search

| Route                        | Method   | Description                              |
| ---------------------------- | -------- | ---------------------------------------- |
| `/api/search`                | POST     | Search across chat documents             |

### Images

| Route                        | Method   | Description                              |
| ---------------------------- | -------- | ---------------------------------------- |
| `/api/images`                | GET      | List image analyses                      |
| `/api/images/[id]`           | GET      | Get specific image analysis              |

### Library (User-facing)

| Route                        | Method   | Description                              |
| ---------------------------- | -------- | ---------------------------------------- |
| `/api/library`               | GET      | List library documents                   |
| `/api/library/[documentId]`  | GET      | Get specific library document            |

### Admin

| Route                                     | Method     | Description                          |
| ----------------------------------------- | ---------- | ------------------------------------ |
| `/api/admin/stats`                        | GET        | Dashboard statistics                 |
| `/api/admin/activity`                     | GET        | Recent activity feed                 |
| `/api/admin/recent-chats`                 | GET        | Recent chat list                     |
| `/api/admin/library`                      | POST       | Upload library documents             |
| `/api/admin/chats`                        | GET        | List all chats (admin)               |
| `/api/admin/chats/[chatId]`               | GET/DELETE | Manage specific chat                 |
| `/api/admin/chats/[chatId]/messages`      | GET        | View chat messages                   |
| `/api/admin/documents`                    | GET        | List all documents                   |
| `/api/admin/documents/[documentId]`       | GET/DELETE | Manage specific document             |
| `/api/admin/documents/[documentId]/download` | GET     | Download document                    |
| `/api/admin/users/[userId]/activity`      | GET        | User-specific activity               |

---

## Data Flow

### Chat Message Flow

```
User types message
  → Client sends POST /api/chat (with message + file attachments)
    → Server validates session (Better Auth)
    → Auto-creates chat in DB if new
    → Processes uploaded files:
        - Images → GPT vision analysis → stored in imageAnalysis table
        - Documents → RAG processing (chunk → embed → Pinecone)
    → Builds system prompt with context
    → Calls OpenAI via Vercel AI SDK (streamText)
    → AI can use tools: rag_search, library_search, list_documents, etc.
    → Streams response back to client
    → Saves messages to DB on completion
```

### RAG Document Processing Flow

```
User uploads file
  → File uploaded to S3 via presigned URL
  → POST /api/rag/process with file metadata
    → Download file from S3
    → Parse with LlamaIndex (PDF/DOCX/TXT/XLSX)
    → Split into chunks (600 tokens, 100 overlap)
    → Generate embeddings (Cohere embed-v4.0)
    → Upsert vectors to Pinecone (chatbot index)
    → Save chunk metadata to ragChunk table
    → Update ragDocument status to "ready"
```

### Library Document Flow

Same as RAG but:
- Uploaded by admins via `/admin/library`
- Stored in `libraryDocument` / `libraryChunk` tables
- Vectors go to separate Pinecone `library` index
- Searchable by all users (organization-wide knowledge base)
- Supports images (via GPT vision text extraction)

---

## Middleware (proxy.ts)

The middleware at `proxy.ts` handles:

1. **Maintenance mode** — Checks auth settings; non-admins see `/maintenance`
2. **Authentication** — Redirects unauthenticated users to `/auth/login`
3. **2FA enforcement** — Redirects users without 2FA to `/auth/two-factor/setup`

**Public routes** (no auth required):
- `/auth/login`, `/auth/signup`, `/auth/forgot-password`, `/auth/reset-password`

---

## State Management

| Tool          | Purpose                                    |
| ------------- | ------------------------------------------ |
| **RTK Query** | Server state — API calls with caching      |
| **Redux**     | Global client state (minimal usage)        |
| **Zustand**   | Lightweight state for specific features    |
| **nuqs**      | URL query string state management          |

---

**Previous:** [← Database Setup](./03-database.md) | **Next:** [S3 Storage Setup →](./05-s3-storage.md)
