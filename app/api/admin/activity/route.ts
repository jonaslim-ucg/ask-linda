import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { chat, session as sessionTable, user } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

type ActivityItem = {
  type: "login" | "chat_created";
  createdAt: Date;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  chatId?: string;
  chatTitle?: string;
};

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
  const perTypeLimit = 10;

  try {
    const loginQuery = db
      .select({
        createdAt: sessionTable.createdAt,
        userId: sessionTable.userId,
        userName: user.name,
        userEmail: user.email,
      })
      .from(sessionTable)
      .leftJoin(user, eq(sessionTable.userId, user.id));

    const chatQuery = db
      .select({
        createdAt: chat.createdAt,
        userId: chat.userId,
        chatId: chat.id,
        chatTitle: chat.title,
        userName: user.name,
        userEmail: user.email,
      })
      .from(chat)
      .leftJoin(user, eq(chat.userId, user.id));

    const [recentLogins, recentChats] = await Promise.all([
      (userId ? loginQuery.where(eq(sessionTable.userId, userId)) : loginQuery)
        .orderBy(desc(sessionTable.createdAt))
        .limit(perTypeLimit),
      (userId ? chatQuery.where(eq(chat.userId, userId)) : chatQuery)
        .orderBy(desc(chat.createdAt))
        .limit(perTypeLimit),
    ]);

    const loginActivities: ActivityItem[] = recentLogins.map((row) => ({
      type: "login",
      createdAt: row.createdAt,
      userId: row.userId,
      userName: row.userName,
      userEmail: row.userEmail,
    }));

    const chatActivities: ActivityItem[] = recentChats.map((row) => ({
      type: "chat_created",
      createdAt: row.createdAt,
      userId: row.userId,
      userName: row.userName,
      userEmail: row.userEmail,
      chatId: row.chatId,
      chatTitle: row.chatTitle,
    }));

    const activities = [...loginActivities, ...chatActivities]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    return NextResponse.json({ activities });
  } catch (error) {
    console.error("Failed to fetch admin activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin activity" },
      { status: 500 }
    );
  }
}
