import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { chat } from "@/db/schema";
import { eq } from "drizzle-orm";

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { authorized } = await isAdmin();

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { chatId } = await params;

  try {
    await db.delete(chat).where(eq(chat.id, chatId));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete chat:", error);
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 }
    );
  }
}
