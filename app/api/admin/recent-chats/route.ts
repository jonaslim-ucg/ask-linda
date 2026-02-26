import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { chat, user } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

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

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  try {
    const recentChatsQuery = db
      .select({
        id: chat.id,
        title: chat.title,
        userName: user.name,
        createdAt: chat.createdAt,
      })
      .from(chat)
      .leftJoin(user, eq(chat.userId, user.id));

    const recentChats = await (userId
      ? recentChatsQuery.where(eq(chat.userId, userId))
      : recentChatsQuery
    )
      .orderBy(desc(chat.createdAt))
      .limit(10);

    return NextResponse.json({ recentChats });
  } catch (error) {
    console.error("Failed to fetch recent chats:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent chats" },
      { status: 500 }
    );
  }
}
