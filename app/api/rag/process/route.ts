import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  processRagDocument,
  isSupportedRagFileType,
} from "@/lib/rag";

export const maxDuration = 120; // 2 minutes for document processing

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = (await request.json()) as {
      fileUrl: string;
      fileName: string;
      fileKey?: string;
      mimeType: string;
      sizeBytes?: number;
      chatId: string;
    };

    const { fileUrl, fileName, fileKey, mimeType, sizeBytes, chatId } = body;

    // Validate required fields
    if (!fileUrl || !fileName || !mimeType || !chatId) {
      return Response.json(
        { error: "Missing required fields: fileUrl, fileName, mimeType, chatId" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!isSupportedRagFileType(mimeType)) {
      return Response.json(
        { error: `Unsupported file type: ${mimeType}. Supported: PDF, DOCX, TXT` },
        { status: 400 }
      );
    }

    // Process the document
    const result = await processRagDocument({
      fileUrl,
      fileName,
      fileKey: fileKey ?? fileUrl.split("/").pop() ?? "",
      mimeType,
      sizeBytes,
      userId: session.user.id,
      chatId,
    });

    if (!result.success) {
      return Response.json(
        { error: result.error, documentId: result.documentId },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      documentId: result.documentId,
      chunkCount: result.chunkCount,
    });
  } catch (error) {
    console.error("Document process API error:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
