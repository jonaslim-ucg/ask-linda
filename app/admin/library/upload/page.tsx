"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Upload,
  FileText,
  FolderOpen,
  CloudUpload,
  CheckCircle,
  XCircle,
  Loader2,
  Trash2,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usePresignedUpload } from "next-s3-upload";
import { toast } from "sonner";

interface UploadingFile {
  id: string;
  file: File;
  name: string;
  progress: number;
  size: number;
  status:
    | "pending"
    | "uploading"
    | "processing"
    | "conflict"
    | "completed"
    | "skipped"
    | "error";
  errorMessage?: string;
  s3Key?: string;
  s3Url?: string;
}

const SUPPORTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_CONCURRENT_UPLOADS = 10;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

export default function LibraryUploadPage() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [files, setFiles] = useState<UploadingFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isResolvingConflicts, setIsResolvingConflicts] = useState(false);
  const { uploadToS3 } = usePresignedUpload();
  const abortControllerRef = useRef<AbortController | null>(null);

  const pendingFiles = files.filter((f) => f.status === "pending");
  const activeFiles = files.filter((f) => f.status === "uploading" || f.status === "processing");
  const conflictFiles = files.filter((f) => f.status === "conflict");
  const completedFiles = files.filter((f) => f.status === "completed");
  const skippedFiles = files.filter((f) => f.status === "skipped");
  const errorFiles = files.filter((f) => f.status === "error");

  const submitForProcessing = async (
    fileEntry: UploadingFile,
    replaceExisting: boolean
  ) => {
    const response = await fetch("/api/admin/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: [
          {
            fileUrl: fileEntry.s3Url,
            fileName: fileEntry.name,
            fileKey: fileEntry.s3Key,
            mimeType: fileEntry.file.type,
            sizeBytes: fileEntry.size,
            replaceExisting,
          },
        ],
      }),
    });

    const result = await response.json();
    return { response, result };
  };

  const processFile = async (fileEntry: UploadingFile) => {
    // Update to uploading status
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileEntry.id ? { ...f, status: "uploading" as const, progress: 10 } : f
      )
    );

    try {
      // Upload to S3
      const { url, key } = await uploadToS3(fileEntry.file, {
        endpoint: {
          request: {
            headers: {},
          },
        },
      });

      // Update to processing status
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileEntry.id
            ? { ...f, progress: 50, status: "processing" as const, s3Key: key, s3Url: url }
            : f
        )
      );

      const { response, result } = await submitForProcessing(
        {
          ...fileEntry,
          s3Url: url,
          s3Key: key,
        },
        false
      );

      if (response.status === 409 && result?.duplicate) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === fileEntry.id
              ? {
                  ...f,
                  status: "conflict" as const,
                  errorMessage:
                    "File already exists. Duplicate check is by file title only. Choose Replace or Skip.",
                }
              : f
          )
        );
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Processing failed");
      }

      // Mark as completed
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileEntry.id
            ? { ...f, progress: 100, status: "completed" as const }
            : f
        )
      );
    } catch (error) {
      console.error("Upload error:", error);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileEntry.id
            ? {
                ...f,
                status: "error" as const,
                errorMessage:
                  error instanceof Error ? error.message : "Upload failed",
              }
            : f
        )
      );
    }
  };

  const handleReplaceDuplicate = async (fileId: string) => {
    const fileEntry = files.find((f) => f.id === fileId);
    if (!fileEntry || !fileEntry.s3Url || !fileEntry.s3Key) return;

    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, status: "processing" as const, errorMessage: undefined }
          : f
      )
    );

    try {
      const { response, result } = await submitForProcessing(fileEntry, true);

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Replace failed");
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? { ...f, progress: 100, status: "completed" as const }
            : f
        )
      );
      toast.success(`${fileEntry.name} replaced successfully`);
    } catch (error) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === fileId
            ? {
                ...f,
                status: "error" as const,
                errorMessage: error instanceof Error ? error.message : "Replace failed",
              }
            : f
        )
      );
    }
  };

  const handleSkipDuplicate = (fileId: string) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, status: "skipped" as const, errorMessage: "Skipped duplicate file" }
          : f
      )
    );
  };

  const handleReplaceAllDuplicates = async () => {
    const ids = files.filter((f) => f.status === "conflict").map((f) => f.id);
    if (ids.length === 0) return;

    setIsResolvingConflicts(true);
    for (const id of ids) {
      await handleReplaceDuplicate(id);
    }
    setIsResolvingConflicts(false);
  };

  const handleSkipAllDuplicates = () => {
    setFiles((prev) =>
      prev.map((f) =>
        f.status === "conflict"
          ? { ...f, status: "skipped" as const, errorMessage: "Skipped duplicate file" }
          : f
      )
    );
    toast.info("Skipped all duplicate files");
  };

  const startUpload = async () => {
    if (pendingFiles.length === 0) return;

    setIsProcessing(true);
    abortControllerRef.current = new AbortController();

    // Process files in batches of MAX_CONCURRENT_UPLOADS
    const filesToProcess = [...pendingFiles];
    
    while (filesToProcess.length > 0) {
      const batch = filesToProcess.splice(0, MAX_CONCURRENT_UPLOADS);
      await Promise.all(batch.map((file) => processFile(file)));
    }

    setIsProcessing(false);
    toast.success("Upload batch completed");
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const clearCompleted = () => {
    setFiles((prev) =>
      prev.filter(
        (f) =>
          f.status !== "completed" &&
          f.status !== "error" &&
          f.status !== "skipped"
      )
    );
  };

  const handleFiles = useCallback((newFiles: File[]) => {
    const validFiles: UploadingFile[] = [];

    for (const file of newFiles) {
      // Check for duplicates
      const isDuplicate = files.some((f) => f.name === file.name && f.size === file.size);
      if (isDuplicate) {
        toast.error(`${file.name}: Already added`);
        continue;
      }

      // Validate type
      if (!SUPPORTED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: Unsupported file type`);
        continue;
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`${file.name}: File too large (max 50MB)`);
        continue;
      }

      validFiles.push({
        id: Math.random().toString(36).substring(7),
        file,
        name: file.name,
        progress: 0,
        size: file.size,
        status: "pending",
      });
    }

    if (validFiles.length === 0) return;

    setFiles((prev) => [...validFiles, ...prev]);
    toast.success(`Added ${validFiles.length} file(s) to queue`);
  }, [files]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      if (droppedFiles.length > 0) {
        handleFiles(droppedFiles);
      }
    },
    [handleFiles]
  );

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault(); // Prevent default paste behavior
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file") {
          const file = items[i].getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        handleFiles(files);
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [handleFiles]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 bg-linear-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
              <Upload className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Upload Documents
              </h1>
              <p className="text-sm text-muted-foreground md:text-base">
                Upload files to add to the AI knowledge base
              </p>
            </div>
          </div>
        </div>
      </div>, drop, or paste

      {/* Upload Zone */}
      <Card className="border-2 border-dashed border-muted-foreground/25 bg-linear-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800 overflow-hidden">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative transition-all duration-300",
            isDragOver && "bg-violet-50 dark:bg-violet-950/20"
          )}
        >
          {isDragOver && (
            <div className="absolute inset-0 bg-linear-to-br from-violet-500/10 to-purple-500/10 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 animate-pulse">
                <CloudUpload className="size-16 text-violet-500" />
                <p className="text-xl font-semibold text-violet-600 dark:text-violet-400">
                  Drop files here to upload
                </p>
              </div>
            </div>
          )}
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="flex items-center justify-center size-20 rounded-2xl bg-linear-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 border border-violet-200 dark:border-violet-800">
                <Upload className="size-10 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">
                  Drag and drop files here
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Upload PDF, DOCX, TXT, or image files. Maximum file size is 50MB.
                  Files will be processed and added to the AI knowledge base.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="h-px w-16 bg-border" />
                <span className="text-sm text-muted-foreground">or</span>
                <div className="h-px w-16 bg-border" />
              </div>
              <Button 
                onClick={() => document.getElementById("file-upload")?.click()}
                className="bg-linear-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/25"
              >
                <Upload className="size-4 mr-2" />
                Browse Files
              </Button>
              <input
                id="file-upload"
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    handleFiles(Array.from(e.target.files));
                  }
                }}
              />
            </div>
          </CardContent>
        </div>
      </Card>

      {/* File Queue */}
      {files.length > 0 && (
        <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-950/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CloudUpload className="size-5 text-violet-600" />
                <h3 className="font-semibold">
                  {pendingFiles.length > 0 && `${pendingFiles.length} pending`}
                  {activeFiles.length > 0 && ` • ${activeFiles.length} processing`}
                  {conflictFiles.length > 0 && ` • ${conflictFiles.length} needs action`}
                  {completedFiles.length > 0 && ` • ${completedFiles.length} completed`}
                  {skippedFiles.length > 0 && ` • ${skippedFiles.length} skipped`}
                  {errorFiles.length > 0 && ` • ${errorFiles.length} failed`}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {(completedFiles.length > 0 || errorFiles.length > 0 || skippedFiles.length > 0) && (
                  <Button variant="outline" size="sm" onClick={clearCompleted}>
                    Clear Finished
                  </Button>
                )}
                {conflictFiles.length > 0 && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSkipAllDuplicates}
                      disabled={isResolvingConflicts}
                    >
                      Skip All Duplicates
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleReplaceAllDuplicates}
                      disabled={isResolvingConflicts}
                      className="bg-violet-600 hover:bg-violet-700"
                    >
                      {isResolvingConflicts ? (
                        <>
                          <Loader2 className="size-4 mr-2 animate-spin" />
                          Replacing...
                        </>
                      ) : (
                        "Replace All Duplicates"
                      )}
                    </Button>
                  </>
                )}
                {pendingFiles.length > 0 && (
                  <Button
                    onClick={startUpload}
                    disabled={isProcessing || isResolvingConflicts}
                    className="bg-linear-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Play className="size-4 mr-2" />
                        Start Upload ({pendingFiles.length})
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
            {conflictFiles.length > 0 && (
              <div className="mb-3 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                Attention: duplicate detection checks only the file title/name (not file content).
              </div>
            )}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {files.map((file) => (
                <div key={file.id} className="space-y-2 bg-white dark:bg-slate-900 rounded-lg p-3 border">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {file.status === "completed" ? (
                        <CheckCircle className="size-4 text-green-600 shrink-0" />
                      ) : file.status === "error" ? (
                        <XCircle className="size-4 text-red-600 shrink-0" />
                      ) : file.status === "processing" ? (
                        <Loader2 className="size-4 text-violet-600 animate-spin shrink-0" />
                      ) : file.status === "uploading" ? (
                        <Loader2 className="size-4 text-blue-600 animate-spin shrink-0" />
                      ) : (
                        <FileText className="size-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-medium truncate max-w-50 md:max-w-100">
                        {file.name}
                      </span>
                      <Badge variant="secondary" className="shrink-0">
                        {formatBytes(file.size)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {file.status === "pending" && (
                        <Badge variant="outline">Pending</Badge>
                      )}
                      {file.status === "uploading" && (
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          Uploading...
                        </Badge>
                      )}
                      {file.status === "processing" && (
                        <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                          Processing...
                        </Badge>
                      )}
                      {file.status === "conflict" && (
                        <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                          Duplicate Found
                        </Badge>
                      )}
                      {file.status === "completed" && (
                        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          Complete
                        </Badge>
                      )}
                      {file.status === "skipped" && (
                        <Badge variant="secondary">
                          Skipped
                        </Badge>
                      )}
                      {file.status === "error" && (
                        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          {file.errorMessage || "Error"}
                        </Badge>
                      )}
                      {file.status === "conflict" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleReplaceDuplicate(file.id)}
                            className="bg-violet-600 hover:bg-violet-700"
                          >
                            Replace
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleSkipDuplicate(file.id)}
                          >
                            Skip
                          </Button>
                        </>
                      )}
                      {file.status === "pending" && !isProcessing && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeFile(file.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {(file.status === "uploading" || file.status === "processing") && (
                    <Progress 
                      value={file.progress} 
                      className="h-1.5"
                    />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Guidelines */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center size-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 shrink-0">
              <FolderOpen className="size-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold">Upload Guidelines</h3>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Supported formats: PDF, DOCX, TXT, Excel, PNG, JPG, GIF, WebP</li>
                <li>• Paste files or images directly from clipboard (Ctrl+V)</li>
                <li>• Maximum file size: 50MB per file</li>
                <li>• Duplicate detection is based on file title/name only</li>
                <li>• Add files to the queue, then click &quot;Start Upload&quot; to process</li>
                <li>• Up to 10 files are processed simultaneously</li>
                <li>• Processing time varies based on file size and type</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

     
    </div>
  );
}
