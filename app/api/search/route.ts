import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { chat, message } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query || query.trim().length === 0) {
      return Response.json({ chats: [], messages: [] });
    }

    const searchQuery = `%${query}%`;

    // Search in chat titles
    const matchingChats = await db
      .select({
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt,
      })
      .from(chat)
      .where(
        sql`${chat.userId} = ${session.user.id} AND ${chat.title} ILIKE ${searchQuery}`
      )
      .orderBy(chat.createdAt)
      .limit(10);

    // Search in messages - only search in text content, not entire JSON
    const matchingMessages = await db
      .select({
        messageId: message.id,
        chatId: message.chatId,
        chatTitle: chat.title,
        role: message.role,
        parts: message.parts,
        createdAt: message.createdAt,
      })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        sql`${chat.userId} = ${session.user.id} AND ${message.parts}::text ILIKE ${searchQuery}`
      )
      .orderBy(message.createdAt)
      .limit(20);

    return Response.json({
      chats: matchingChats,
      messages: matchingMessages,
      query,
    });
  } catch (error) {
    console.error("Search error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
