import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { chat, message, user } from "@/db/schema";
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
          ilike(chat.title, `%${search}%`),
          ilike(user.name, `%${search}%`),
          ilike(user.email, `%${search}%`)
        )
      : undefined;

    const userFilter = userId ? eq(chat.userId, userId) : undefined;

    const filters = searchFilter && userFilter
      ? and(searchFilter, userFilter)
      : searchFilter ?? userFilter;

    const [totalResult] = await db
      .select({ total: count() })
      .from(chat)
      .leftJoin(user, eq(chat.userId, user.id))
      .where(filters);

    const chatsWithDetails = await db
      .select({
        id: chat.id,
        title: chat.title,
        userId: chat.userId,
        userName: user.name,
        userEmail: user.email,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      })
      .from(chat)
      .leftJoin(user, eq(chat.userId, user.id))
      .where(filters)
      .orderBy(desc(chat.createdAt))
      .limit(limit)
      .offset(offset);

    // Get message counts for each chat
    const chatsWithMessageCount = await Promise.all(
      chatsWithDetails.map(async (c) => {
        const [messageCount] = await db
          .select({ count: count() })
          .from(message)
          .where(eq(message.chatId, c.id));
        return {
          ...c,
          messageCount: messageCount.count,
        };
      })
    );

    return NextResponse.json({
      chats: chatsWithMessageCount,
      total: totalResult?.total ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Failed to fetch chats:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}
