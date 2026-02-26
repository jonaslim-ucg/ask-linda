import { POST as route } from 'next-s3-upload/route';
import { sanitizeKey } from 'next-s3-upload';
import { randomUUID } from 'crypto';

export const POST = route.configure({
  async key(req, filename) {
    const sanitizedFilename = sanitizeKey(filename);
    const extIndex = sanitizedFilename.lastIndexOf('.');
    const name = sanitizedFilename.substring(0, extIndex);
    const ext = sanitizedFilename.substring(extIndex);
    const uniqueId = randomUUID(); // Example: 'a1b2c3d4-e5f6-7g8h-9i10-j11k12l13m14'

    return `uploadsgo/${name}-${uniqueId}${ext}`;
  },
  accessKeyId: process.env.NEXT_S3_UPLOAD_ACCESS_KEY_ID,
  secretAccessKey: process.env.NEXT_S3_UPLOAD_SECRET_ACCESS_KEY,
  bucket: process.env.NEXT_S3_UPLOAD_BUCKET,
  region: process.env.NEXT_S3_UPLOAD_REGION,
});
