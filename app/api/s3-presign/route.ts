import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { presignS3GetUrl } from "@/lib/s3-presign";

export async function GET(request: Request) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url || typeof url !== "string") {
      return new Response("Missing url", { status: 400 });
    }

    const signedUrl = await presignS3GetUrl(url);

    return Response.json({ url: signedUrl });
  } catch (error) {
    console.error("S3 presign error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const body = await request.json();
    const { url, expiresInSeconds } = body;

    if (!url || typeof url !== "string") {
      return new Response("Missing url", { status: 400 });
    }

    const signedUrl = await presignS3GetUrl(url, { 
      expiresInSeconds: expiresInSeconds || 900 
    });

    return Response.json({ presignedUrl: signedUrl, url: signedUrl });
  } catch (error) {
    console.error("S3 presign error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
