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
export interface UseS3FileUploadOptions {
  maxFiles?: number;
  maxSizeMB?: number;
  allowedTypes?: string[];
}

/**
 * Custom hook for handling file uploads to S3 with validation and state management.
 * @param {Object} options - Configuration options for the hook.
 * @param {number} [options.maxSizeMB] - Maximum file size in MB.
 * @param {string[]} [options.allowedTypes] - Array of allowed MIME types.
 * @returns {Object} - Contains methods and state for file upload management.
 * @example
 * const { files, isUploading, handleFileSelect, removeFile, resetFiles } = useS3FileUpload({
 *   maxSizeMB: 5,
 *   allowedTypes: ["image/jpeg", "image/png"],
 * });
 */
export const useS3FileUpload = ({
  maxSizeMB,
  allowedTypes,
  maxFiles,
}: UseS3FileUploadOptions = {}) => {
  const { uploadToS3 } = usePresignedUpload();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = async (file: File) => {
    // ✅ Only validate if options are provided
    if (allowedTypes && !allowedTypes.includes(file.type)) {
      toast.error(`${file.name}: Invalid file type`);
      return;
    }

    // ✅ Optional: max file count check
    if (maxFiles && files.length >= maxFiles) {
      toast.error(`You can only upload up to ${maxFiles} files.`);
      return;
    }

    if (maxSizeMB && file.size > maxSizeMB * 1024 * 1024) {
      toast.error(`${file.name}: Must be smaller than ${maxSizeMB}MB`);
      return;
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
      return { url, key };
    } catch (error) {
      console.error('Upload error:', error);
      setFiles((prev) => prev.filter((f) => f.name !== file.name));
      toast.error(`Failed to upload ${file.name}`);
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    deleteFileFromS3(files[index].key);
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const resetFiles = () => {
    setFiles([]);
  };

  return {
    files,
    isUploading,
    handleFileSelect,
    removeFile,
    resetFiles,
    setFiles,
  };
};

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
