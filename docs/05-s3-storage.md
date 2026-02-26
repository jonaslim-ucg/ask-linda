# S3 Storage Setup

The project uses **AWS S3** to store user-uploaded files (documents, images). Files are uploaded via presigned URLs using the `next-s3-upload` package.

---

## Overview

| Component        | Purpose                                           |
| ---------------- | ------------------------------------------------- |
| `next-s3-upload`  | Handles presigned upload URL generation           |
| `@aws-sdk/client-s3` | Direct S3 operations (delete, get)            |
| `@aws-sdk/s3-request-presigner` | Generates presigned GET URLs     |

---

## Step 1: Create an S3 Bucket

1. Go to [AWS S3 Console](https://s3.console.aws.amazon.com/)
2. Click **Create bucket**
3. Choose a **bucket name** (e.g., `my-chatbot-uploads`)
4. Select a **region** (e.g., `eu-west-2`)
5. Uncheck "Block all public access" if you need direct public URLs (optional — the app uses presigned URLs)
6. Click **Create bucket**

---

## Step 2: Configure CORS

Your bucket needs CORS configured to allow browser uploads. Go to your bucket → **Permissions** → **CORS** and add:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["http://localhost:3000", "https://your-production-domain.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

> **Important:** Update `AllowedOrigins` with your actual domain in production.

---

## Step 3: Create an IAM User

1. Go to [IAM Console](https://console.aws.amazon.com/iam/)
2. Navigate to **Users** → **Create user**
3. Name it (e.g., `chatbot-s3-user`)
4. Attach a custom policy with these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::your-bucket-name",
        "arn:aws:s3:::your-bucket-name/*"
      ]
    }
  ]
}
```

5. Create an **Access Key** for the user
6. Save the **Access Key ID** and **Secret Access Key**

---

## Step 4: Set Environment Variables

Add the following to your `.env`:

```env
NEXT_S3_UPLOAD_BUCKET=your-bucket-name
NEXT_S3_UPLOAD_REGION=eu-west-2
NEXT_S3_UPLOAD_ACCESS_KEY_ID=AKIA...
NEXT_S3_UPLOAD_SECRET_ACCESS_KEY=your-secret-key
```

---

## How Uploads Work

### Upload Flow

1. **Client** requests a presigned upload URL via `POST /api/s3-upload`
2. **Server** generates a presigned PUT URL using `next-s3-upload`
3. **Client** uploads the file directly to S3 using the presigned URL
4. **Client** receives the S3 file URL
5. File is then processed (RAG indexing, image analysis, etc.)

### File Key Format

Files are stored with the pattern:

```
uploadsgo/{sanitized-filename}-{uuid}.{extension}
```

### Presigned GET URLs

When serving files back to users, the server generates presigned GET URLs (with a 15-minute expiry) via `lib/s3-presign.ts`. This means:

- Files don't need to be publicly accessible
- URLs expire automatically for security
- The app handles URL signing transparently

---

## React Hooks for Uploads

### Single File Upload

```typescript
import { useS3FileUpload } from "@/hooks/useS3FileUpload";

const { files, uploadFile, removeFile, isUploading } = useS3FileUpload({
  maxFiles: 5,
  maxSizeMB: 50,
  allowedTypes: ["application/pdf", "image/*"],
});
```

### Multi-File Upload

```typescript
import { useS3MultiFileUpload } from "@/hooks/useS3MultiFileUpload";

const { files, uploadFiles, removeFile, isUploading, error } = useS3MultiFileUpload({
  maxFiles: 10,
  maxSizeMB: 50,
});
```

Both hooks handle:
- File validation (size, type, count)
- Upload progress tracking
- Error handling with toast notifications
- File removal (deletes from S3)

---

## Supported File Types

### For RAG Processing (Documents)

| Type | Extensions           |
| ---- | -------------------- |
| PDF  | `.pdf`               |
| Word | `.docx`              |
| Text | `.txt`               |
| Excel| `.xls`, `.xlsx`      |

### For Image Analysis

| Type | Extensions                    |
| ---- | ----------------------------- |
| JPEG | `.jpg`, `.jpeg`               |
| PNG  | `.png`                        |
| GIF  | `.gif`                        |
| WebP | `.webp`                       |

---

## Troubleshooting

| Problem                         | Solution                                                    |
| ------------------------------- | ----------------------------------------------------------- |
| `AccessDenied` on upload        | Check IAM permissions — ensure `s3:PutObject` is allowed    |
| `CORS error` in browser         | Configure CORS on the S3 bucket (see Step 2)                |
| Files not accessible            | Presigned URLs may have expired — they last 15 minutes      |
| Upload hangs                    | Check network tab for errors — verify bucket region matches |
| `NoSuchBucket` error            | Ensure `NEXT_S3_UPLOAD_BUCKET` matches the actual bucket name |

---

**Previous:** [← Project Architecture](./04-architecture.md) | **Next:** [AI & RAG Setup →](./06-ai-and-rag.md)
