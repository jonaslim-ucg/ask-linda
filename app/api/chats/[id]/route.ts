import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getChatById, getMessagesByChatId, updateChatTitle, deleteChat } from "@/db/queries";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const chat = await getChatById(id);

    if (!chat) {
      return new Response("Chat not found", { status: 404 });
    }

    // Verify the chat belongs to the user
    if (chat.userId !== session.user.id) {
      return new Response("Forbidden", { status: 403 });
    }

    const messages = await getMessagesByChatId(id);

    return Response.json({
      chat,
      messages,
    });
  } catch (error) {
    console.error("Get chat error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const chat = await getChatById(id);

    if (!chat) {
      return new Response("Chat not found", { status: 404 });
    }

    // Verify the chat belongs to the user
    if (chat.userId !== session.user.id) {
      return new Response("Forbidden", { status: 403 });
    }

    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return new Response("Invalid title", { status: 400 });
    }

    await updateChatTitle({ id, title: title.trim() });

    return Response.json({ success: true });
  } catch (error) {
    console.error("Update chat error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const chat = await getChatById(id);

    if (!chat) {
      return new Response("Chat not found", { status: 404 });
    }

    // Verify the chat belongs to the user
    if (chat.userId !== session.user.id) {
      return new Response("Forbidden", { status: 403 });
    }

    await deleteChat(id);

    return Response.json({ success: true });
  } catch (error) {
    console.error("Delete chat error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
