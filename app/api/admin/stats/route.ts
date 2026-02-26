import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user, chat, message, libraryDocument } from "@/db/schema";
import { count, desc, eq } from "drizzle-orm";

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

export async function GET() {
  const { authorized } = await isAdmin();

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // Get total counts
    const [usersCount] = await db.select({ count: count() }).from(user);
    const [chatsCount] = await db.select({ count: count() }).from(chat);
    const [documentsCount] = await db
      .select({ count: count() })
      .from(libraryDocument);
    const [messagesCount] = await db.select({ count: count() }).from(message);

    // Get recent users
    const recentUsers = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      })
      .from(user)
      .orderBy(desc(user.createdAt))
      .limit(10);

    // Get recent chats with user info
    const recentChats = await db
      .select({
        id: chat.id,
        title: chat.title,
        userName: user.name,
        createdAt: chat.createdAt,
      })
      .from(chat)
      .leftJoin(user, eq(chat.userId, user.id))
      .orderBy(desc(chat.createdAt))
      .limit(10);

    return NextResponse.json({
      totalUsers: usersCount.count,
      totalChats: chatsCount.count,
      totalDocuments: documentsCount.count,
      totalMessages: messagesCount.count,
      recentUsers,
      recentChats,
    });
  } catch (error) {
    console.error("Failed to fetch admin stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
