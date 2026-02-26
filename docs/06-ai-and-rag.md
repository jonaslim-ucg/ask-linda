# AI & RAG Setup

This project uses AI for chat completions, document processing (RAG), and image analysis. Here's how to set up each service.

---

## Services Overview

| Service      | Purpose                                    | Model Used               |
| ------------ | ------------------------------------------ | ------------------------ |
| **OpenAI**   | Chat completions, title generation, vision | GPT-4.1-mini, GPT-5-mini |
| **Cohere**   | Text embeddings for vector search          | embed-v4.0               |
| **Pinecone** | Vector database for document search        | —                        |

---

## OpenAI Setup

### 1. Get an API Key

1. Go to [platform.openai.com](https://platform.openai.com/)
2. Navigate to **API Keys**
3. Click **Create new secret key**
4. Copy the key and add it to `.env`:

```env
OPENAI_API_KEY=sk-proj-...
```

### 2. Models Used

The application uses the following OpenAI models:

| Model            | Used For                             |
| ---------------- | ------------------------------------ |
| **GPT-4.1-mini** | Chat title generation (background)   |
| **GPT-5-mini**   | Image analysis (vision), chat completions |

### 3. Billing

Make sure your OpenAI account has:
- A valid payment method
- Sufficient credits or billing enabled
- The required models available on your plan

---

## Cohere Setup

Cohere provides the embedding model used for converting text into vectors.

### 1. Get an API Key

1. Go to [dashboard.cohere.com](https://dashboard.cohere.com/)
2. Navigate to **API Keys**
3. Copy your production key and add it to `.env`:

```env
COHERE_API_KEY=your-cohere-api-key
```

### 2. Embedding Details

| Parameter     | Value         |
| ------------- | ------------- |
| Model         | `embed-v4.0`  |
| Batch Size    | 96            |
| Input Types   | `search_document` (indexing), `search_query` (querying) |

---

## Pinecone Setup

Pinecone stores the vector embeddings for semantic search.

### 1. Create an Account

1. Go to [app.pinecone.io](https://app.pinecone.io/)
2. Sign up and create a project

### 2. Create Indexes

You need **two separate indexes** — one for per-chat user documents and one for the admin library.

#### Chatbot Index (Per-Chat Documents)

1. Click **Create Index**
2. Configure:
   - **Name:** `chatbot` (must match `CHATBOT_PINECONE_INDEX_NAME`)
   - **Dimensions:** `1536` (Cohere embed-v4.0 output dimension)
   - **Metric:** `cosine`
   - **Cloud/Region:** Choose based on your location
3. Click **Create Index**

#### Library Index (Organization-Wide)

1. Click **Create Index**
2. Configure:
   - **Name:** `library` (must match `LIBRARY_PINECONE_INDEX_NAME`)
   - **Dimensions:** `1536`
   - **Metric:** `cosine`
   - **Cloud/Region:** Same as chatbot index
3. Click **Create Index**

### 3. Get Your API Key

1. Go to **API Keys** in the Pinecone console
2. Copy the key and add it to `.env`:

```env
PINECONE_API_KEY=pcsk_...
CHATBOT_PINECONE_INDEX_NAME=chatbot
LIBRARY_PINECONE_INDEX_NAME=library
```

---

## How RAG Works

### Document Processing Pipeline

When a user uploads a document:

```
Upload file to S3
  → Download file from S3 via presigned URL
  → Parse document content:
      - PDF → LlamaIndex PDFReader
      - DOCX → LlamaIndex DocxReader
      - TXT → LlamaIndex TextFileReader
      - XLSX → xlsx.js parser
  → Split text into chunks:
      - Chunk size: 600 tokens
      - Overlap: 100 tokens
      - Splitter: SentenceSplitter (LlamaIndex)
  → Generate embeddings:
      - Model: Cohere embed-v4.0
      - Batch size: 96
      - Input type: "search_document"
  → Upsert vectors to Pinecone:
      - chatbot index (user docs) or library index (admin docs)
      - Metadata: userId, chatId, fileName, pageNumber, etc.
  → Save chunk records to database
  → Update document status to "ready"
```

### Search Pipeline

When the AI needs to search documents:

```
Query text from AI tool call
  → Generate query embedding:
      - Model: Cohere embed-v4.0
      - Input type: "search_query"
  → Query Pinecone:
      - chatbot index: filtered by chatId + userId
      - library index: no filter (org-wide)
      - Top K results returned
  → Return matched chunks with metadata
  → AI uses chunks as context for response
```

### Two Search Scopes

| Scope       | Index       | Filter              | Who can search |
| ----------- | ----------- | -------------------- | -------------- |
| **Per-Chat** | `chatbot`  | `chatId` + `userId` | Document owner |
| **Library**  | `library`  | None                 | All users      |

---

## AI Tools Available to the Chat

The chat AI has access to these tools for document retrieval:

| Tool                      | Description                                        |
| ------------------------- | -------------------------------------------------- |
| `rag_search`              | Search per-chat user documents                     |
| `library_search`          | Search organization-wide library                   |
| `list_chat_documents`     | List documents uploaded to current chat            |
| `get_document_preview`    | Get preview/content of a specific document         |
| `search_documents_by_name`| Find documents by filename                         |
| `search_document_chunks`  | Search within specific document chunks             |
| `list_chat_images`        | List images uploaded to current chat               |
| `get_image_details`       | Get details of a specific image analysis           |
| `search_images`           | Search across image analyses                       |

---

## Library Documents (Admin)

Admins can upload documents to the organization-wide library:

1. Go to **Admin Panel** → **Library** → **Upload**
2. Upload documents (PDF, DOCX, TXT, XLSX, and images)
3. Documents are processed and indexed in the `library` Pinecone index
4. All users can search library documents via the `library_search` tool in chat

**Image support in library:** Images (JPEG, PNG, GIF, WebP) are analyzed using GPT vision to extract text/descriptions before chunking and indexing.

---

## Troubleshooting

| Problem                           | Solution                                                |
| --------------------------------- | ------------------------------------------------------- |
| `Cohere API error`                | Check API key — ensure it's a production key            |
| `Pinecone dimension mismatch`     | Index must have 1536 dimensions for Cohere embed-v4.0   |
| `Document stuck in "processing"`  | Check server logs — may be a file format or S3 issue    |
| `No search results`               | Ensure documents finished processing (status = "ready") |
| `OpenAI rate limit`               | Check your OpenAI usage limits and billing              |

---

**Previous:** [← S3 Storage Setup](./05-s3-storage.md) | **Next:** [Email / SMTP Setup →](./07-email-smtp.md)
