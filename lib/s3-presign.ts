import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { UIMessage } from "ai";

const env = {
  region: process.env.NEXT_S3_UPLOAD_REGION,
  accessKeyId: process.env.NEXT_S3_UPLOAD_ACCESS_KEY_ID,
  secretAccessKey: process.env.NEXT_S3_UPLOAD_SECRET_ACCESS_KEY,
  bucket: process.env.NEXT_S3_UPLOAD_BUCKET,
} as const;

const getS3Client = (): S3Client | null => {
  if (!env.region || !env.accessKeyId || !env.secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: env.region,
    credentials: {
      accessKeyId: env.accessKeyId,
      secretAccessKey: env.secretAccessKey,
    },
  });
};

const tryParseS3BucketAndKey = (
  rawUrl: string
): { bucket: string; key: string } | null => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = url.host;
  const path = url.pathname.replace(/^\//, "");

  // Virtual-hosted style: {bucket}.s3.{region}.amazonaws.com/{key}
  // Also: {bucket}.s3.amazonaws.com/{key}
  const virtualHostedMatch = host.match(/^(.+?)\.s3[.-][a-z0-9-]+\.amazonaws\.com$/i);
  const virtualHostedNoRegionMatch = host.match(/^(.+?)\.s3\.amazonaws\.com$/i);

  if (virtualHostedMatch) {
    return { bucket: virtualHostedMatch[1] ?? "", key: decodeURIComponent(path) };
  }
  if (virtualHostedNoRegionMatch) {
    return {
      bucket: virtualHostedNoRegionMatch[1] ?? "",
      key: decodeURIComponent(path),
    };
  }

  // Path style: s3.{region}.amazonaws.com/{bucket}/{key}
  // Also: s3.amazonaws.com/{bucket}/{key}
  const isPathStyle =
    host === "s3.amazonaws.com" ||
    /^s3[.-][a-z0-9-]+\.amazonaws\.com$/i.test(host);

  if (isPathStyle) {
    const [bucket, ...rest] = path.split("/");
    const key = rest.join("/");
    if (!bucket || !key) {
      return null;
    }
    return { bucket, key: decodeURIComponent(key) };
  }

  return null;
};

export const presignS3GetUrl = async (
  rawUrl: string,
  options?: { expiresInSeconds?: number }
): Promise<string> => {
  // If already signed, keep as-is
  if (rawUrl.includes("X-Amz-Signature=") || rawUrl.includes("x-amz-signature=")) {
    return rawUrl;
  }

  const parsed = tryParseS3BucketAndKey(rawUrl);
  if (!parsed?.bucket || !parsed.key) {
    return rawUrl;
  }

  // Only sign for our configured bucket, so we don't accidentally sign arbitrary URLs.
  if (env.bucket && parsed.bucket !== env.bucket) {
    return rawUrl;
  }

  const client = getS3Client();
  if (!client) {
    return rawUrl;
  }

  const expiresIn = options?.expiresInSeconds ?? 60 * 15;

  try {
    const command = new GetObjectCommand({
      Bucket: parsed.bucket,
      Key: parsed.key,
    });

    return await getSignedUrl(client, command, { expiresIn });
  } catch {
    return rawUrl;
  }
};

export const presignS3UrlsInUIMessages = async (
  messages: UIMessage[],
  options?: { expiresInSeconds?: number }
): Promise<UIMessage[]> => {
  const updated: UIMessage[] = [];

  for (const message of messages) {
    if (!Array.isArray(message.parts)) {
      updated.push(message);
      continue;
    }

    const parts = await Promise.all(
      message.parts.map(async (part) => {
        if (
          typeof part === "object" &&
          part !== null &&
          "type" in part &&
          (part as { type?: unknown }).type === "file" &&
          "url" in part &&
          typeof (part as { url?: unknown }).url === "string"
        ) {
          const url = (part as { url: string }).url;
          const signedUrl = await presignS3GetUrl(url, options);
          return { ...(part as Record<string, unknown>), url: signedUrl };
        }
        return part;
      })
    );

    updated.push({ ...message, parts: parts as UIMessage["parts"] });
  }

  return updated;
};
