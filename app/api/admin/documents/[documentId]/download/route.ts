import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { ragDocument } from "@/db/schema";
import { eq } from "drizzle-orm";
import { presignS3GetUrl } from "@/lib/s3-presign";

async function isAdmin() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { authorized: false, session: null };
  }

  const userData = session.user as { role?: string };
  if (userData.role !== "admin") {
    return { authorized: false, session };
  }

  return { authorized: true, session };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const { authorized } = await isAdmin();

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { documentId } = await params;

    const [document] = await db
      .select({
        id: ragDocument.id,
        fileName: ragDocument.fileName,
        fileUrl: ragDocument.fileUrl,
      })
      .from(ragDocument)
      .where(eq(ragDocument.id, documentId))
      .limit(1);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    if (!document.fileUrl) {
      return NextResponse.json(
        { error: "Document file URL not available" },
        { status: 400 }
      );
    }

    // Generate presigned URL valid for 1 hour
    const presignedUrl = await presignS3GetUrl(document.fileUrl, {
      expiresInSeconds: 3600,
    });

    return NextResponse.json({
      url: presignedUrl,
      fileName: document.fileName,
    });
  } catch (error) {
    console.error("Failed to generate download URL:", error);
    return NextResponse.json(
      { error: "Failed to generate download URL" },
      { status: 500 }
    );
  }
}
