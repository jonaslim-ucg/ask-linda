"use server";

import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.NEXT_S3_UPLOAD_REGION,
  credentials: {
    accessKeyId: process.env.NEXT_S3_UPLOAD_ACCESS_KEY_ID,
    secretAccessKey: process.env.NEXT_S3_UPLOAD_SECRET_ACCESS_KEY,
  },
});
const Bucket = process.env.NEXT_S3_UPLOAD_BUCKET;

/**
 * Deletes a file from S3.
 * @param {string} Bucket - The S3 bucket name.
 * @param {string} Key - The key (path/filename) of the file to delete.
 */
const deleteFileFromS3 = async (Key) => {
  try {
    const command = new DeleteObjectCommand({ Bucket, Key });
    await s3.send(command);
    // console.log(`Deleted ${Key} from ${Bucket}`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting file from S3:", error);
    throw error;
  }
};

export default deleteFileFromS3;
