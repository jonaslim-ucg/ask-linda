import { and, desc, eq, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { db } from ".";
import {
  chat,
  message,
  ragChunk,
  ragDocument,
  imageAnalysis,
  libraryDocument,
  libraryChunk,
  user,
} from "./schema";

// Chat queries
export async function getChatById(id: string) {
  const result = await db.select().from(chat).where(eq(chat.id, id));
  return result[0] ?? null;
}

export async function getChatsByUserId(userId: string) {
  return db
    .select()
    .from(chat)
    .where(eq(chat.userId, userId))
    .orderBy(desc(chat.createdAt));
}

export async function getChatsByUserIdPaginated({
  userId,
  limit = 20,
  cursor,
}: {
  userId: string;
  limit?: number;
  cursor?: string;
}) {
  // If cursor is provided, get the chat to find its createdAt for pagination
  let cursorDate: Date | undefined;
  if (cursor) {
    const cursorChat = await getChatById(cursor);
    if (cursorChat) {
      cursorDate = cursorChat.createdAt;
    }
  }

  const whereConditions = cursorDate
    ? and(eq(chat.userId, userId), lt(chat.createdAt, cursorDate))
    : eq(chat.userId, userId);

  const chats = await db
    .select()
    .from(chat)
    .where(whereConditions)
    .orderBy(desc(chat.createdAt))
    .limit(limit + 1); // Fetch one extra to check if there are more

  const hasMore = chats.length > limit;
  const resultChats = hasMore ? chats.slice(0, limit) : chats;
  const nextCursor = hasMore ? resultChats[resultChats.length - 1]?.id : undefined;

  return {
    chats: resultChats,
    nextCursor,
    hasMore,
  };
}

export async function createChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}) {
  await db.insert(chat).values({
    id,
    userId,
    title,
  });
}

export async function updateChatTitle({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  await db.update(chat).set({ title, updatedAt: new Date() }).where(eq(chat.id, id));
}

export async function deleteChat(id: string) {
  await db.delete(chat).where(eq(chat.id, id));
}

// Message queries
export async function getMessagesByChatId(chatId: string, limit?: number) {
  const query = db
    .select()
    .from(message)
    .where(eq(message.chatId, chatId))
    .orderBy(desc(message.createdAt));

  // If limit is specified, apply it and then reverse to get chronological order
  if (limit) {
    const messages = await query.limit(limit);
    return messages.reverse(); // Return in chronological order (oldest first)
  }

  // Otherwise return all messages in chronological order
  return db
    .select()
    .from(message)
    .where(eq(message.chatId, chatId))
    .orderBy(message.createdAt);
}

export async function updateMessageParts({
  id,
  parts,
}: {
  id: string;
  parts: unknown;
}) {
  await db.update(message).set({ parts }).where(eq(message.id, id));
}

export async function saveMessages(
  messages: {
    id: string;
    chatId: string;
    role: string;
    parts: unknown;
  }[]
) {
  if (messages.length === 0) return;
  await db.insert(message).values(
    messages.map((m) => ({
      id: m.id,
      chatId: m.chatId,
      role: m.role,
      parts: m.parts,
    }))
  );
}

// RAG document queries
export async function createRagDocument({
  id,
  userId,
  chatId,
  fileName,
  fileKey,
  fileUrl,
  source,
  mimeType,
  sizeBytes,
  metadata,
}: {
  id: string;
  userId: string;
  chatId?: string;
  fileName: string;
  fileKey?: string;
  fileUrl?: string;
  source?: string;
  mimeType?: string;
  sizeBytes?: number;
  metadata?: unknown;
}) {
  await db.insert(ragDocument).values({
    id,
    userId,
    chatId,
    fileName,
    fileKey,
    fileUrl,
    source: source ?? "s3",
    mimeType,
    sizeBytes,
    metadata,
  });
}

export async function updateRagDocumentStatus({
  id,
  status,
  chunkCount,
  errorMessage,
}: {
  id: string;
  status: "processing" | "ready" | "failed";
  chunkCount?: number;
  errorMessage?: string | null;
}) {
  await db
    .update(ragDocument)
    .set({
      status,
      chunkCount: chunkCount ?? 0,
      errorMessage: errorMessage ?? null,
      updatedAt: new Date(),
    })
    .where(eq(ragDocument.id, id));
}

export async function getRagDocumentById(id: string) {
  const result = await db.select().from(ragDocument).where(eq(ragDocument.id, id));
  return result[0] ?? null;
}

export async function getRagDocumentsByUserId(userId: string) {
  return db
    .select()
    .from(ragDocument)
    .where(eq(ragDocument.userId, userId))
    .orderBy(desc(ragDocument.createdAt));
}

export async function deleteRagDocumentById(id: string) {
  await db.delete(ragDocument).where(eq(ragDocument.id, id));
}

// RAG chunk queries
export async function saveRagChunks(
  chunks: {
    id: string;
    documentId: string;
    pineconeId: string;
    chunkIndex: number;
    pageNumber?: string | null;
    tokenCount?: number | null;
    text: string;
    metadata?: unknown;
  }[]
) {
  if (chunks.length === 0) return;
  await db.insert(ragChunk).values(
    chunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      pineconeId: chunk.pineconeId,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber ?? null,
      tokenCount: chunk.tokenCount ?? null,
      text: chunk.text,
      metadata: chunk.metadata,
    }))
  );
}

export async function getRagChunksByDocumentId(documentId: string) {
  return db
    .select()
    .from(ragChunk)
    .where(eq(ragChunk.documentId, documentId))
    .orderBy(ragChunk.chunkIndex);
}

export async function getRagChunksByPineconeIds(pineconeIds: string[]) {
  if (pineconeIds.length === 0) return [];
  return db
    .select()
    .from(ragChunk)
    .where(inArray(ragChunk.pineconeId, pineconeIds));
}

// Get RAG documents by chat ID
export async function getRagDocumentsByChatId(chatId: string) {
  return db
    .select()
    .from(ragDocument)
    .where(eq(ragDocument.chatId, chatId))
    .orderBy(desc(ragDocument.createdAt));
}

// Get RAG documents summary for listing (lightweight)
export async function getRagDocumentSummaryByChatId(chatId: string) {
  return db
    .select({
      id: ragDocument.id,
      fileName: ragDocument.fileName,
      mimeType: ragDocument.mimeType,
      status: ragDocument.status,
      chunkCount: ragDocument.chunkCount,
      createdAt: ragDocument.createdAt,
    })
    .from(ragDocument)
    .where(eq(ragDocument.chatId, chatId))
    .orderBy(desc(ragDocument.createdAt));
}

// Get RAG documents by IDs
export async function getRagDocumentsByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(ragDocument)
    .where(inArray(ragDocument.id, ids));
}

// Search RAG documents by filename
export async function searchRagDocumentsByFileName(chatId: string, searchTerm: string) {
  const results = await db
    .select()
    .from(ragDocument)
    .where(eq(ragDocument.chatId, chatId))
    .orderBy(desc(ragDocument.createdAt));

  const lowerSearch = searchTerm.toLowerCase();
  return results.filter((r) =>
    r.fileName.toLowerCase().includes(lowerSearch)
  );
}

// Get sample chunks from a document for preview
export async function getRagDocumentPreviewChunks(documentId: string, limit = 3) {
  return db
    .select({
      id: ragChunk.id,
      chunkIndex: ragChunk.chunkIndex,
      pageNumber: ragChunk.pageNumber,
      text: ragChunk.text,
    })
    .from(ragChunk)
    .where(eq(ragChunk.documentId, documentId))
    .orderBy(ragChunk.chunkIndex)
    .limit(limit);
}

// Search chunks by content text
export async function searchDocumentChunks(params: {
  chatId: string;
  searchText: string;
  documentId?: string;
  limit?: number;
}) {
  const { chatId, searchText, documentId, limit = 10 } = params;
  
  // Get all documents for this chat (or specific document)
  const documents = documentId
    ? await db.select().from(ragDocument).where(eq(ragDocument.id, documentId))
    : await db.select().from(ragDocument).where(eq(ragDocument.chatId, chatId));

  const documentIds = documents.map((d) => d.id);
  
  if (documentIds.length === 0) {
    return [];
  }

  // Get chunks from these documents
  const chunks = await db
    .select({
      id: ragChunk.id,
      documentId: ragChunk.documentId,
      chunkIndex: ragChunk.chunkIndex,
      pageNumber: ragChunk.pageNumber,
      text: ragChunk.text,
    })
    .from(ragChunk)
    .where(inArray(ragChunk.documentId, documentIds));

  // Filter chunks by search text (case-insensitive)
  const lowerSearch = searchText.toLowerCase();
  const matchingChunks = chunks
    .filter((chunk) => chunk.text.toLowerCase().includes(lowerSearch))
    .slice(0, limit);

  // Join with document info
  const results = matchingChunks.map((chunk) => {
    const doc = documents.find((d) => d.id === chunk.documentId);
    return {
      ...chunk,
      fileName: doc?.fileName ?? "",
    };
  });

  return results;
}

// Image analysis queries
export async function saveImageAnalysis({
  id,
  userId,
  chatId,
  messageId,
  fileName,
  fileUrl,
  mimeType,
  analysis,
  model,
  metadata,
}: {
  id: string;
  userId: string;
  chatId: string;
  messageId?: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  analysis: string;
  model?: string;
  metadata?: unknown;
}) {
  await db.insert(imageAnalysis).values({
    id,
    userId,
    chatId,
    messageId,
    fileName,
    fileUrl,
    mimeType,
    analysis,
    model: model ?? "gpt-4o",
    metadata,
  });
}

export async function getImageAnalysisByChatId(chatId: string) {
  return db
    .select()
    .from(imageAnalysis)
    .where(eq(imageAnalysis.chatId, chatId))
    .orderBy(desc(imageAnalysis.createdAt));
}

// Get image analyses summary (lightweight for listing)
export async function getImageAnalysisSummaryByChatId(chatId: string) {
  const results = await db
    .select({
      id: imageAnalysis.id,
      fileName: imageAnalysis.fileName,
      fileUrl: imageAnalysis.fileUrl,
      mimeType: imageAnalysis.mimeType,
      analysis: imageAnalysis.analysis,
      createdAt: imageAnalysis.createdAt,
    })
    .from(imageAnalysis)
    .where(eq(imageAnalysis.chatId, chatId))
    .orderBy(desc(imageAnalysis.createdAt));

  // Return with truncated analysis preview
  return results.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    fileUrl: r.fileUrl,
    mimeType: r.mimeType,
    preview: r.analysis.slice(0, 150) + (r.analysis.length > 150 ? "..." : ""),
    createdAt: r.createdAt,
  }));
}

// Get image analyses summary by user ID (for library view)
export async function getImageAnalysisSummaryByUserId(userId: string) {
  const results = await db
    .select({
      id: imageAnalysis.id,
      fileName: imageAnalysis.fileName,
      fileUrl: imageAnalysis.fileUrl,
      mimeType: imageAnalysis.mimeType,
      analysis: imageAnalysis.analysis,
      chatId: imageAnalysis.chatId,
      createdAt: imageAnalysis.createdAt,
    })
    .from(imageAnalysis)
    .where(eq(imageAnalysis.userId, userId))
    .orderBy(desc(imageAnalysis.createdAt));

  return results.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    fileUrl: r.fileUrl,
    mimeType: r.mimeType,
    chatId: r.chatId,
    preview: r.analysis.slice(0, 150) + (r.analysis.length > 150 ? "..." : ""),
    createdAt: r.createdAt,
  }));
}

export async function getImageAnalysisById(id: string) {
  const result = await db
    .select()
    .from(imageAnalysis)
    .where(eq(imageAnalysis.id, id));
  return result[0] ?? null;
}

export async function deleteImageAnalysisById(id: string) {
  await db.delete(imageAnalysis).where(eq(imageAnalysis.id, id));
}

// Get specific image analysis by ID(s)
export async function getImageAnalysisByIds(ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(imageAnalysis)
    .where(inArray(imageAnalysis.id, ids));
}

// Search image analyses by filename
export async function searchImageAnalysisByFileName(chatId: string, searchTerm: string) {
  const results = await db
    .select()
    .from(imageAnalysis)
    .where(eq(imageAnalysis.chatId, chatId))
    .orderBy(desc(imageAnalysis.createdAt));

  // Filter by filename (case-insensitive)
  const lowerSearch = searchTerm.toLowerCase();
  return results.filter((r) =>
    r.fileName.toLowerCase().includes(lowerSearch)
  );
}

// ============================================
// Library Document queries (Admin uploads)
// ============================================

export async function createLibraryDocument({
  id,
  uploadedBy,
  fileName,
  fileKey,
  fileUrl,
  mimeType,
  sizeBytes,
  metadata,
}: {
  id: string;
  uploadedBy: string;
  fileName: string;
  fileKey?: string;
  fileUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  metadata?: unknown;
}) {
  await db.insert(libraryDocument).values({
    id,
    uploadedBy,
    fileName,
    fileKey,
    fileUrl,
    mimeType,
    sizeBytes,
    metadata,
  });
}

export async function updateLibraryDocumentStatus({
  id,
  status,
  chunkCount,
  errorMessage,
}: {
  id: string;
  status: "processing" | "ready" | "failed";
  chunkCount?: number;
  errorMessage?: string | null;
}) {
  await db
    .update(libraryDocument)
    .set({
      status,
      chunkCount: chunkCount ?? 0,
      errorMessage: errorMessage ?? null,
      updatedAt: new Date(),
    })
    .where(eq(libraryDocument.id, id));
}

export async function getLibraryDocumentById(id: string) {
  const result = await db
    .select()
    .from(libraryDocument)
    .where(eq(libraryDocument.id, id));
  return result[0] ?? null;
}

export async function getLibraryDocumentByFileName(fileName: string) {
  const normalizedFileName = fileName.trim();
  if (!normalizedFileName) return null;

  const result = await db
    .select()
    .from(libraryDocument)
    .where(
      or(
        eq(libraryDocument.fileName, normalizedFileName),
        ilike(libraryDocument.fileName, normalizedFileName)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

export async function getLibraryDocuments({
  limit = 20,
  offset = 0,
  search,
  status,
  sortBy = "newest",
}: {
  limit?: number;
  offset?: number;
  search?: string;
  status?: string;
  sortBy?: string;
} = {}) {
  let query = db.select().from(libraryDocument).$dynamic();

  const conditions = [];
  if (search) {
    conditions.push(ilike(libraryDocument.fileName, `%${search}%`));
  }
  if (status && status !== "all") {
    conditions.push(eq(libraryDocument.status, status));
  }

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  // Apply sorting
  let orderByClause;
  switch (sortBy) {
    case "oldest":
      orderByClause = libraryDocument.createdAt;
      break;
    case "name":
      orderByClause = libraryDocument.fileName;
      break;
    case "size":
      orderByClause = desc(libraryDocument.sizeBytes);
      break;
    case "newest":
    default:
      orderByClause = desc(libraryDocument.createdAt);
      break;
  }

  const rows = await query
    .leftJoin(user, eq(libraryDocument.uploadedBy, user.id))
    .orderBy(orderByClause)
    .limit(limit)
    .offset(offset);

  const documents = rows.map(({ library_document, user: uploader }) => ({
    ...library_document,
    uploaderName: uploader?.name ?? null,
    uploaderEmail: uploader?.email ?? null,
  }));

  // Get total count
  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(libraryDocument)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  // Get total storage size (sum of all document sizes)
  const sizeResult = await db
    .select({ totalSize: sql<number>`COALESCE(SUM(${libraryDocument.sizeBytes}), 0)` })
    .from(libraryDocument)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return {
    documents,
    total: Number(countResult[0]?.count ?? 0),
    totalSize: Number(sizeResult[0]?.totalSize ?? 0),
  };
}

export async function deleteLibraryDocumentById(id: string) {
  await db.delete(libraryDocument).where(eq(libraryDocument.id, id));
}

// Library chunk queries
export async function saveLibraryChunks(
  chunks: {
    id: string;
    documentId: string;
    pineconeId: string;
    chunkIndex: number;
    pageNumber?: string | null;
    tokenCount?: number | null;
    text: string;
    metadata?: unknown;
  }[]
) {
  if (chunks.length === 0) return;
  await db.insert(libraryChunk).values(
    chunks.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      pineconeId: chunk.pineconeId,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber ?? null,
      tokenCount: chunk.tokenCount ?? null,
      text: chunk.text,
      metadata: chunk.metadata,
    }))
  );
}

export async function getLibraryChunksByDocumentId(documentId: string) {
  return db
    .select()
    .from(libraryChunk)
    .where(eq(libraryChunk.documentId, documentId))
    .orderBy(libraryChunk.chunkIndex);
}

export async function getLibraryChunksByPineconeIds(pineconeIds: string[]) {
  if (pineconeIds.length === 0) return [];
  return db
    .select()
    .from(libraryChunk)
    .where(inArray(libraryChunk.pineconeId, pineconeIds));
}

export async function deleteLibraryChunksByDocumentId(documentId: string) {
  return db
    .select({ pineconeId: libraryChunk.pineconeId })
    .from(libraryChunk)
    .where(eq(libraryChunk.documentId, documentId));
}
