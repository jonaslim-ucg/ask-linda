import { headers } from "next/headers";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getChatsByUserIdPaginated } from "@/db/queries";

export async function GET(request: NextRequest) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = Number.parseInt(searchParams.get("limit") || "20", 10);
    const cursor = searchParams.get("cursor") || undefined;

    const result = await getChatsByUserIdPaginated({
      userId: session.user.id,
      limit: Math.min(limit, 50), // Max 50 items per page
      cursor,
    });

    return Response.json(result);
  } catch (error) {
    console.error("Get chats error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
