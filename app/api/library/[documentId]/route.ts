import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getLibraryDocumentById, getLibraryChunksByDocumentId } from "@/db/queries";
import { presignS3GetUrl } from "@/lib/s3-presign";

type RouteParams = Promise<{ documentId: string }>;

export async function GET(
  request: Request,
  { params }: { params: RouteParams }
) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { documentId } = await params;

  // Get the library document
  const document = await getLibraryDocumentById(documentId);
  if (!document) {
    return Response.json({ error: "Document not found" }, { status: 404 });
  }

  // Presign the file URL if available
  let presignedFileUrl: string | null = null;
  if (document.fileUrl) {
    presignedFileUrl = await presignS3GetUrl(document.fileUrl, {
      expiresInSeconds: 60 * 30, // 30 minutes
    });
  }

  // Get the first few chunks for preview
  const chunks = await getLibraryChunksByDocumentId(documentId);
  const previewChunks = chunks.slice(0, 5).map((chunk) => ({
    id: chunk.id,
    chunkIndex: chunk.chunkIndex,
    pageNumber: chunk.pageNumber,
    text: chunk.text,
  }));

  return Response.json({
    document: {
      id: document.id,
      fileName: document.fileName,
      fileUrl: presignedFileUrl,
      mimeType: document.mimeType,
      status: document.status,
      chunkCount: document.chunkCount,
      createdAt: document.createdAt,
    },
    previewChunks,
  });
}
