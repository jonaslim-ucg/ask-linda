import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  deleteImageAnalysisById,
  deleteRagDocumentById,
  getImageAnalysisSummaryByUserId,
  getRagChunksByDocumentId,
  getRagDocumentsByUserId,
  getMessagesByChatId,
  updateMessageParts,
} from "@/db/queries";
import { pineconeIndex } from "@/lib/rag/pinecone";

const parseNumber = (value: string | null, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export async function GET(request: Request) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim().toLowerCase() ?? "";
  const page = parseNumber(searchParams.get("page"), 1);
  const pageSize = parseNumber(searchParams.get("pageSize"), 12);

  const [documents, images] = await Promise.all([
    getRagDocumentsByUserId(session.user.id),
    getImageAnalysisSummaryByUserId(session.user.id),
  ]);

  const filteredDocuments = search
    ? documents.filter((doc) => doc.fileName.toLowerCase().includes(search))
    : documents;

  const filteredImages = search
    ? images.filter((img) => img.fileName.toLowerCase().includes(search))
    : images;

  const items = [
    ...filteredDocuments.map((doc) => ({
      kind: "document" as const,
      id: doc.id,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      mimeType: doc.mimeType,
      status: doc.status,
      sizeBytes: doc.sizeBytes,
      chatId: doc.chatId,
      createdAt: doc.createdAt,
    })),
    ...filteredImages.map((img) => ({
      kind: "image" as const,
      id: img.id,
      fileName: img.fileName,
      fileUrl: img.fileUrl,
      mimeType: img.mimeType,
      preview: img.preview,
      chatId: img.chatId,
      createdAt: img.createdAt,
    })),
  ].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const total = items.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paged = items.slice(startIndex, startIndex + pageSize);

  return Response.json({
    items: paged,
    total,
    page,
    pageSize,
    totalPages,
  });
}

export async function DELETE() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const [documents, images] = await Promise.all([
    getRagDocumentsByUserId(session.user.id),
    getImageAnalysisSummaryByUserId(session.user.id),
  ]);

  const errors: string[] = [];

  // Delete all documents with chunks + Pinecone vectors + message parts
  for (const doc of documents) {
    try {
      const chunks = await getRagChunksByDocumentId(doc.id);
      const pineconeIds = chunks.map((chunk) => chunk.pineconeId);

      const batchSize = 500;
      for (let i = 0; i < pineconeIds.length; i += batchSize) {
        const batch = pineconeIds.slice(i, i + batchSize);
        if (batch.length > 0) {
          await pineconeIndex.deleteMany(batch);
        }
      }

      if (doc.chatId) {
        const messages = await getMessagesByChatId(doc.chatId);
        const fileName = doc.fileName;
        const fileUrl = doc.fileUrl ?? "";
        const fileKey = doc.fileKey ?? "";

        for (const msg of messages) {
          const parts = msg.parts as unknown;
          if (!Array.isArray(parts)) continue;

          const nextParts = parts.filter((part) => {
            if (typeof part !== "object" || part === null) return true;
            if (!("type" in part)) return true;
            const typed = part as {
              type?: unknown;
              url?: unknown;
              filename?: unknown;
            };
            if (typed.type !== "file") return true;

            const partUrl = typeof typed.url === "string" ? typed.url : "";
            const partName =
              typeof typed.filename === "string" ? typed.filename : "";

            const matchesUrl = !!fileUrl && partUrl === fileUrl;
            const matchesKey = !!fileKey && partUrl.includes(fileKey);
            const matchesName = !!fileName && partName === fileName;

            return !(matchesUrl || matchesKey || matchesName);
          });

          if (nextParts.length !== parts.length) {
            await updateMessageParts({ id: msg.id, parts: nextParts });
          }
        }
      }

      await deleteRagDocumentById(doc.id);
    } catch {
      errors.push(doc.fileName);
    }
  }

  // Delete all images + message parts
  for (const img of images) {
    try {
      if (img.chatId) {
        const messages = await getMessagesByChatId(img.chatId);
        const fileName = img.fileName;
        const fileUrl = img.fileUrl;

        for (const msg of messages) {
          const parts = msg.parts as unknown;
          if (!Array.isArray(parts)) continue;

          const nextParts = parts.filter((part) => {
            if (typeof part !== "object" || part === null) return true;
            if (!("type" in part)) return true;
            const typed = part as {
              type?: unknown;
              url?: unknown;
              filename?: unknown;
            };
            if (typed.type !== "file") return true;

            const partUrl = typeof typed.url === "string" ? typed.url : "";
            const partName =
              typeof typed.filename === "string" ? typed.filename : "";

            const matchesUrl = !!fileUrl && partUrl === fileUrl;
            const matchesName = !!fileName && partName === fileName;

            return !(matchesUrl || matchesName);
          });

          if (nextParts.length !== parts.length) {
            await updateMessageParts({ id: msg.id, parts: nextParts });
          }
        }
      }

      await deleteImageAnalysisById(img.id);
    } catch {
      errors.push(img.fileName);
    }
  }

  const deleted = documents.length + images.length - errors.length;

  if (errors.length > 0) {
    return Response.json(
      {
        success: false,
        deleted,
        failed: errors.length,
        message: `Deleted ${deleted} items, failed to delete ${errors.length}`,
      },
      { status: 207 }
    );
  }

  return Response.json({ success: true, deleted });
}
