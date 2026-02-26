import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getImageAnalysisSummaryByUserId } from "@/db/queries";

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

  const images = await getImageAnalysisSummaryByUserId(session.user.id);
  const filtered = search
    ? images.filter((img) => img.fileName.toLowerCase().includes(search))
    : images;

  const total = filtered.length;
  const totalPages = Math.ceil(total / pageSize);
  const startIndex = (page - 1) * pageSize;
  const paged = filtered.slice(startIndex, startIndex + pageSize);

  return Response.json({
    images: paged,
    total,
    page,
    pageSize,
    totalPages,
  });
}
