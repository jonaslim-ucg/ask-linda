import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getLibraryDocumentByFileName, getLibraryDocuments } from "@/db/queries";
import {
  processLibraryDocument,
  deleteLibraryDocument,
} from "@/lib/rag/process-library-document";

// GET - List library documents
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { role?: string };
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = Number.parseInt(searchParams.get("limit") || "20", 10);
  const offset = Number.parseInt(searchParams.get("offset") || "0", 10);
  const search = searchParams.get("search") || undefined;
  const status = searchParams.get("status") || undefined;
  const sortBy = searchParams.get("sortBy") || "newest";

  try {
    const { documents, total, totalSize } = await getLibraryDocuments({
      limit,
      offset,
      search,
      status,
      sortBy,
    });

    return NextResponse.json({
      documents,
      total,
      totalSize,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error fetching library documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}

// POST - Upload and process new library document
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { id: string; role?: string };
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { files } = body as {
      files: {
        fileUrl: string;
        fileName: string;
        fileKey: string;
        mimeType: string;
        sizeBytes?: number;
        replaceExisting?: boolean;
      }[];
    };

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: "No files provided" },
        { status: 400 }
      );
    }

    // Process files
    const results = [];
    for (const file of files) {
      const existingDocument = await getLibraryDocumentByFileName(file.fileName);

      if (existingDocument && !file.replaceExisting) {
        return NextResponse.json(
          {
            error: `A file named "${file.fileName}" already exists`,
            duplicate: true,
            fileName: file.fileName,
            existingDocumentId: existingDocument.id,
          },
          { status: 409 }
        );
      }

      if (existingDocument && file.replaceExisting) {
        await deleteLibraryDocument(existingDocument.id);
      }

      const result = await processLibraryDocument({
        fileUrl: file.fileUrl,
        fileName: file.fileName,
        fileKey: file.fileKey,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        uploadedBy: user.id,
      });
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: failCount === 0,
      results,
      successCount,
      failCount,
    });
  } catch (error) {
    console.error("Error processing library documents:", error);
    return NextResponse.json(
      { error: "Failed to process documents" },
      { status: 500 }
    );
  }
}

// DELETE - Delete library document
export async function DELETE(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { role?: string };
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { documentId, documentIds } = body as {
      documentId?: string;
      documentIds?: string[];
    };

    const idsToDelete = documentIds || (documentId ? [documentId] : []);

    if (idsToDelete.length === 0) {
      return NextResponse.json(
        { error: "No document ID provided" },
        { status: 400 }
      );
    }

    // Delete each document (including Pinecone vectors)
    for (const id of idsToDelete) {
      await deleteLibraryDocument(id);
    }

    return NextResponse.json({
      success: true,
      deletedCount: idsToDelete.length,
    });
  } catch (error) {
    console.error("Error deleting library document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}
