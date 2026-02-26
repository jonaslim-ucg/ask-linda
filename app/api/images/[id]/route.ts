import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  deleteImageAnalysisById,
  getImageAnalysisById,
  getMessagesByChatId,
  updateMessageParts,
} from "@/db/queries";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;
  const image = await getImageAnalysisById(id);

  if (!image || image.userId !== session.user.id) {
    return new Response("Not found", { status: 404 });
  }

  if (image.chatId) {
    const messages = await getMessagesByChatId(image.chatId);
    const fileName = image.fileName;
    const fileUrl = image.fileUrl;

    for (const msg of messages) {
      const parts = msg.parts as unknown;
      if (!Array.isArray(parts)) continue;

      const nextParts = parts.filter((part) => {
        if (typeof part !== "object" || part === null) return true;
        if (!("type" in part)) return true;
        const typed = part as {
          type?: unknown;
          url?: unknown;
          filename?: unknown;
        };
        if (typed.type !== "file") return true;

        const partUrl = typeof typed.url === "string" ? typed.url : "";
        const partName = typeof typed.filename === "string" ? typed.filename : "";

        const matchesUrl = !!fileUrl && partUrl === fileUrl;
        const matchesName = !!fileName && partName === fileName;

        return !(matchesUrl || matchesName);
      });

      if (nextParts.length !== parts.length) {
        await updateMessageParts({ id: msg.id, parts: nextParts });
      }
    }
  }

  await deleteImageAnalysisById(id);

  return Response.json({ success: true });
}
