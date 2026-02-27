// hooks/useFileUpload.ts
import { useState } from 'react';
import { usePresignedUpload } from 'next-s3-upload';
import { toast } from 'sonner';
import deleteFileFromS3 from '@/utils/deleteFileFromS3';

export interface UploadedFile {
  name: string;
  url: string;
  key: string;
  type: string;
  size: string;
  isUploading?: boolean;
}

export interface UploadConfig {
  maxSizeMB?: number;
  allowedTypes?: string[];
  maxFiles?: number;
}

export const useS3MultiFileUpload = (config: UploadConfig = {}) => {
  const { uploadToS3 } = usePresignedUpload();

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (selected: File | FileList): Promise<void> => {
    setError(null);
    const inputFiles =
      selected instanceof FileList ? Array.from(selected) : [selected];

    for (const file of inputFiles) {
      const result = await validateAndUploadFile(file);
      if (!result) break; // Stop if validation/upload fails
    }
  };

  const validateAndUploadFile = async (file: File): Promise<boolean> => {
    const { allowedTypes, maxSizeMB, maxFiles } = config;

    if (maxFiles && files.length >= maxFiles) {
      const err = `Maximum ${maxFiles} files allowed`;
      setError(err);
      toast.error(err);
      return false;
    }

    if (allowedTypes && !allowedTypes.includes(file.type)) {
      const err = `${file.name}: Invalid file type`;
      setError(err);
      toast.error(err);
      return false;
    }

    const maxBytes = maxSizeMB ? maxSizeMB * 1024 * 1024 : Infinity;
    if (file.size > maxBytes) {
      const err = `${file.name}: File size exceeds ${maxSizeMB}MB`;
      setError(err);
      toast.error(err);
      return false;
    }

    const newFile: UploadedFile = {
      name: file.name,
      url: '',
      key: '',
      type: file.type,
      size: formatBytes(file.size),
      isUploading: true,
    };

    setFiles((prev) => [...prev, newFile]);

    try {
      setIsUploading(true);
      const { url, key } = await uploadToS3(file);
      setFiles((prev) =>
        prev.map((f) =>
          f.name === file.name ? { ...f, url, key, isUploading: false } : f,
        ),
      );
      return true;
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : err != null
              ? String(err)
              : null;
      if (message) {
        console.error("Upload error:", message, err);
      } else {
        console.warn(
          "S3 upload failed (no details). Add NEXT_S3_UPLOAD_* to .env — see docs/05-s3-storage.md",
        );
      }
      setFiles((prev) => prev.filter((f) => f.name !== file.name));
      const userMessage = `Failed to upload ${file.name}`;
      setError(userMessage);
      toast.error(userMessage);
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = async (index: number) => {
    try {
      await deleteFileFromS3(files[index].key);
    } catch (err) {
      console.warn('S3 delete failed', err);
    }
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const resetFiles = () => {
    setFiles([]);
    setError(null);
  };

  return {
    files,
    isUploading,
    error,
    handleFileSelect, // ✅ supports both single & multiple
    removeFile,
    resetFiles,
    setFiles,
  };
};

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
