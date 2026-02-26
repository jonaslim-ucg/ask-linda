import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getRagDocumentsByUserId } from "@/db/queries";

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

  const documents = await getRagDocumentsByUserId(session.user.id);
  const filtered = search
    ? documents.filter((doc) => doc.fileName.toLowerCase().includes(search))
    : documents;

  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paged = filtered.slice(startIndex, startIndex + pageSize);

  return Response.json({
    documents: paged.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      mimeType: doc.mimeType,
      status: doc.status,
      sizeBytes: doc.sizeBytes,
      chatId: doc.chatId,
      createdAt: doc.createdAt,
    })),
    total,
    page,
    pageSize,
    totalPages,
  });
}
