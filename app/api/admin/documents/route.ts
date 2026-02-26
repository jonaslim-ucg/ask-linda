import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { ragDocument, user } from "@/db/schema";
import { desc, eq, count, ilike, or, and } from "drizzle-orm";

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

export async function GET(request: Request) {
  const { authorized } = await isAdmin();

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);
    const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
    const search = searchParams.get("search")?.trim();
    const userId = searchParams.get("userId")?.trim();

    const searchFilter = search
      ? or(
          ilike(ragDocument.fileName, `%${search}%`),
          ilike(user.name, `%${search}%`),
          ilike(user.email, `%${search}%`)
        )
      : undefined;

    const userFilter = userId ? eq(ragDocument.userId, userId) : undefined;

    const filters = searchFilter && userFilter
      ? and(searchFilter, userFilter)
      : searchFilter ?? userFilter;

    const [totalResult] = await db
      .select({ total: count() })
      .from(ragDocument)
      .leftJoin(user, eq(ragDocument.userId, user.id))
      .where(filters);

    const documents = await db
      .select({
        id: ragDocument.id,
        fileName: ragDocument.fileName,
        mimeType: ragDocument.mimeType,
        sizeBytes: ragDocument.sizeBytes,
        status: ragDocument.status,
        chunkCount: ragDocument.chunkCount,
        fileUrl: ragDocument.fileUrl,
        userId: ragDocument.userId,
        userName: user.name,
        userEmail: user.email,
        createdAt: ragDocument.createdAt,
      })
      .from(ragDocument)
      .leftJoin(user, eq(ragDocument.userId, user.id))
      .where(filters)
      .orderBy(desc(ragDocument.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      documents,
      total: totalResult?.total ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Failed to fetch documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch documents" },
      { status: 500 }
    );
  }
}
