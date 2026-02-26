"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Trash2, Download, FileText, Image as ImageIcon, File } from "lucide-react";
import { DataTable } from "@/components/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSearchParams } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import useSWR from "swr";

interface Document {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  chunkCount: number;
  userId: string;
  userName: string;
  userEmail: string;
  createdAt: string;
  fileUrl?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

function getFileIcon(mimeType: string) {
  if (mimeType?.startsWith("image/")) {
    return <ImageIcon className="h-4 w-4" />;
  }
  if (mimeType?.includes("pdf")) {
    return <FileText className="h-4 w-4" />;
  }
  return <File className="h-4 w-4" />;
}

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
  });
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId")?.trim();


  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPagination((prev) => ({ ...prev, offset: 0 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(pagination.limit),
      offset: String(pagination.offset),
    });

    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }

    if (userId) {
      params.set("userId", userId);
    }

    return params.toString();
  }, [pagination.limit, pagination.offset, debouncedSearch, userId]);

  const fetcher = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch documents");
    }
    return response.json() as Promise<{
      documents: Document[];
      total: number;
      limit: number;
      offset: number;
    }>;
  };

  const { data, error, isLoading, mutate } = useSWR(
    `/api/admin/documents?${queryParams}`,
    fetcher
  );

  useEffect(() => {
    if (data?.documents) {
      setDocuments(data.documents);
      setPagination((prev) => ({
        ...prev,
        total: data.total ?? prev.total,
      }));
    }
  }, [data]);

  useEffect(() => {
    if (error) {
      console.error("Failed to fetch documents:", error);
      toast.error("Failed to fetch documents");
    }
  }, [error]);



  async function handleDownloadDocument(doc: Document) {
    try {
      toast.loading("Preparing download...", { id: "download" });

      const response = await fetch(
        `/api/admin/documents/${doc.id}/download`
      );

      if (!response.ok) {
        throw new Error("Failed to generate download URL");
      }

      const { url, fileName } = (await response.json()) as {
        url: string;
        fileName: string;
      };

      // Create a temporary anchor element to trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success("Download started", { id: "download" });
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Failed to download document", { id: "download" });
    }
  }

  const columns = [
    {
      key: "fileName",
      header: "File",
      render: (doc: Document) => (
        <div className="flex items-center gap-2">
          {getFileIcon(doc.mimeType)}
          <span className="font-medium truncate max-w-50">
            {doc.fileName}
          </span>
        </div>
      ),
    },
    {
      key: "userName",
      header: "Owner",
      render: (doc: Document) => (
        <div>
          <p className="text-sm font-medium">{doc.userName}</p>
          <p className="text-xs text-muted-foreground">{doc.userEmail}</p>
        </div>
      ),
    },
    {
      key: "sizeBytes",
      header: "Size",
      render: (doc: Document) => formatBytes(doc.sizeBytes || 0),
    },
    {
      key: "status",
      header: "Status",
      render: (doc: Document) => (
        <Badge
          variant={
            doc.status === "processed"
              ? "default"
              : doc.status === "processing"
                ? "secondary"
                : "destructive"
          }
        >
          {doc.status}
        </Badge>
      ),
    },
    {
      key: "chunkCount",
      header: "Chunks",
    },
    {
      key: "createdAt",
      header: "Uploaded",
      render: (doc: Document) => new Date(doc.createdAt).toLocaleDateString(),
    },
    {
      key: "actions",
      header: "",
      render: (doc: Document) => (
        <div className="flex items-center gap-2">
          {doc.fileUrl && (
            <Button
              onClick={() => handleDownloadDocument(doc)}
              size="icon"
              variant="ghost"
            >
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Documents</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            View and manage uploaded documents
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents..."
            value={searchQuery}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={documents}
        emptyMessage="No documents found"
        isLoading={isLoading}
      />

      {(data?.total ?? 0) > pagination.limit && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            Page {Math.floor(pagination.offset / pagination.limit) + 1} of{" "}
            {Math.max(
              1,
              Math.ceil((data?.total ?? 0) / pagination.limit)
            )}
          </p>
          <div className="flex gap-2 justify-center sm:justify-end">
            <Button
              disabled={pagination.offset === 0}
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  offset: Math.max(0, prev.offset - prev.limit),
                }))
              }
              size="sm"
              variant="outline"
            >
              Previous
            </Button>
            <Button
              disabled={
                pagination.offset + pagination.limit >= (data?.total ?? 0)
              }
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  offset: prev.offset + prev.limit,
                }))
              }
              size="sm"
              variant="outline"
            >
              Next
            </Button>
          </div>
        </div>
      )}


    </div>
  );
}
