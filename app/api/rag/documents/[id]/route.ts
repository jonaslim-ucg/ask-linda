import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  deleteRagDocumentById,
  getRagChunksByDocumentId,
  getRagDocumentById,
  getMessagesByChatId,
  updateMessageParts,
} from "@/db/queries";
import { pineconeIndex } from "@/lib/rag/pinecone";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;
  const document = await getRagDocumentById(id);
  if (!document || document.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  return Response.json({ document });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;
  const document = await getRagDocumentById(id);
  if (!document || document.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  const chunks = await getRagChunksByDocumentId(document.id);
  const pineconeIds = chunks.map((chunk) => chunk.pineconeId);

  const batchSize = 500;
  for (let i = 0; i < pineconeIds.length; i += batchSize) {
    const batch = pineconeIds.slice(i, i + batchSize);
    if (batch.length > 0) {
      await pineconeIndex.deleteMany(batch);
    }
  }

  if (document.chatId) {
    const messages = await getMessagesByChatId(document.chatId);
    const fileName = document.fileName;
    const fileUrl = document.fileUrl ?? "";
    const fileKey = document.fileKey ?? "";

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
        const partName = typeof typed.filename === "string" ? typed.filename : "";

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

  await deleteRagDocumentById(document.id);

  return Response.json({ success: true });
}
