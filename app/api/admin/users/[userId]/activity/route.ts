import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { chat, session as sessionTable } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

type ActivityItem = {
  type: "login" | "chat_created";
  createdAt: Date;
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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { authorized } = await isAdmin();

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { userId } = await params;

  try {
    const [recentLogins, recentChats] = await Promise.all([
      db
        .select({ createdAt: sessionTable.createdAt })
        .from(sessionTable)
        .where(eq(sessionTable.userId, userId))
        .orderBy(desc(sessionTable.createdAt))
        .limit(10),
      db
        .select({ id: chat.id, title: chat.title, createdAt: chat.createdAt })
        .from(chat)
        .where(eq(chat.userId, userId))
        .orderBy(desc(chat.createdAt))
        .limit(10),
    ]);

    const loginActivities: ActivityItem[] = recentLogins.map((row) => ({
      type: "login",
      createdAt: row.createdAt,
    }));

    const chatActivities: ActivityItem[] = recentChats.map((row) => ({
      type: "chat_created",
      createdAt: row.createdAt,
      chatId: row.id,
      chatTitle: row.title,
    }));

    const activities = [...loginActivities, ...chatActivities]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    return NextResponse.json({ activities });
  } catch (error) {
    console.error("Failed to fetch user activity:", error);
    return NextResponse.json(
      { error: "Failed to fetch user activity" },
      { status: 500 }
    );
  }
}
