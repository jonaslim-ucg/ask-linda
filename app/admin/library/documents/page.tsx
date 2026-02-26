"use client";

import { useState, useEffect } from "react";
import { useQueryStates, parseAsInteger, parseAsStringLiteral, parseAsString } from "nuqs";
import useSWR from "swr";
import {
  FileText,
  Image as ImageIcon,
  File,
  Trash2,
  Download,
  Search,
  Filter,
  MoreVertical,
  FolderOpen,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  List,
  SortAsc,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { DocumentPreviewDialog } from "@/components/library";

interface LibraryDocument {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  chunkCount: number;
  uploadedBy: string;
  uploaderName?: string | null;
  uploaderEmail?: string | null;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface LibraryResponse {
  documents: LibraryDocument[];
  total: number;
  totalSize: number;
  limit: number;
  offset: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

function getFileIcon(mimeType: string) {
  if (mimeType?.startsWith("image/")) {
    return <ImageIcon className="size-5 text-purple-500" />;
  }
  if (mimeType?.includes("pdf")) {
    return <FileText className="size-5 text-red-500" />;
  }
  if (mimeType?.includes("word") || mimeType?.includes("document")) {
    return <FileText className="size-5 text-blue-500" />;
  }
  return <File className="size-5 text-gray-500" />;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "processed":
      return (
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 gap-1">
          <CheckCircle2 className="size-3" />
          Processed
        </Badge>
      );
    case "processing":
      return (
        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 gap-1">
          <Clock className="size-3 animate-spin" />
          Processing
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 gap-1">
          <XCircle className="size-3" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function getUploaderLabel(doc: LibraryDocument): string {
  const name = doc.uploaderName?.trim();
  const email = doc.uploaderEmail?.trim();

  if (name && email) return `${name} (${email})`;
  if (name) return name;
  if (email) return email;
  return doc.uploadedBy;
}

function formatUploadTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

export default function LibraryDocumentsPage() {
  // URL-synced state using nuqs
  const [urlState, setUrlState] = useQueryStates({
    viewMode: parseAsStringLiteral(["list", "grid"] as const).withDefault("list"),
    page: parseAsInteger.withDefault(1),
    limit: parseAsInteger.withDefault(10),
    status: parseAsStringLiteral(["all", "processed", "processing", "failed"] as const).withDefault("all"),
    sortBy: parseAsStringLiteral(["newest", "oldest", "name", "size"] as const).withDefault("newest"),
    search: parseAsString.withDefault(""),
  });

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [debouncedSearch, setDebouncedSearch] = useState(urlState.search);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingDocumentIds, setDeletingDocumentIds] = useState<string[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<string | null>(null);

  // Preview dialog state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewingDocumentId, setPreviewingDocumentId] = useState<string | null>(null);
  const [previewingFileName, setPreviewingFileName] = useState<string | undefined>(undefined);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(urlState.search);
    }, 300);
    return () => clearTimeout(timer);
  }, [urlState.search]);

  // Build SWR key
  const params = new URLSearchParams({
    limit: String(urlState.limit),
    offset: String((urlState.page - 1) * urlState.limit),
  });
  if (debouncedSearch) params.set("search", debouncedSearch);
  if (urlState.status !== "all") params.set("status", urlState.status);
  if (urlState.sortBy) params.set("sortBy", urlState.sortBy);

  const { data, error, isLoading, isValidating, mutate } = useSWR<LibraryResponse>(
    `/api/admin/library?${params}`,
    fetcher,
    {
      revalidateOnFocus: false,
      keepPreviousData: true,
    }
  );

  const documents = data?.documents || [];
  const totalDocuments = data?.total || 0;
  const totalStorageBytes = data?.totalSize || 0;

  const handleDelete = async (ids: string[]) => {
    setIsDeleting(true);
    setDeletingDocumentIds((prev) => [...new Set([...prev, ...ids])]);
    try {
      const response = await fetch("/api/admin/library", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: ids }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);

      toast.success(`Deleted ${ids.length} document(s)`);
      setSelectedItems([]);
      mutate();
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete documents");
    } finally {
      setIsDeleting(false);
      setDeletingDocumentIds((prev) =>
        prev.filter((existingId) => !ids.includes(existingId))
      );
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const handleView = (doc: LibraryDocument) => {
    setPreviewingDocumentId(doc.id);
    setPreviewingFileName(doc.fileName);
    setPreviewOpen(true);
  };

  const handleDownload = async (doc: LibraryDocument) => {
    try {
      toast.info("Preparing download...");
      
      // Request presigned URL from the API
      const response = await fetch(`/api/s3-presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url: doc.fileUrl,
          expiresInSeconds: 300, // 5 minutes
          forceDownload: true // Force download instead of inline display
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to generate download link");
      }

      const data = await response.json();
      const presignedUrl = data.presignedUrl || data.url;

      if (!presignedUrl) {
        throw new Error("No download URL available");
      }

      // Fetch the file as blob to force download
      const fileResponse = await fetch(presignedUrl);
      if (!fileResponse.ok) {
        throw new Error("Failed to fetch file");
      }

      const blob = await fileResponse.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Create a temporary link and trigger download
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = doc.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up blob URL
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
      
      toast.success("Download started");
    } catch (error) {
      console.error("Download error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to download document");
    }
  };

  const handleBulkDownload = async () => {
    const selectedDocs = documents.filter(doc => selectedItems.includes(doc.id));
    
    if (selectedDocs.length === 0) {
      toast.error("No documents selected");
      return;
    }

    toast.info(`Downloading ${selectedDocs.length} document(s)...`);
    
    for (const doc of selectedDocs) {
      await handleDownload(doc);
      // Add a small delay between downloads to avoid overwhelming the browser
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  const totalPages = Math.ceil(totalDocuments / urlState.limit);

  const toggleSelectAll = () => {
    if (selectedItems.length === documents.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(documents.map((doc) => doc.id));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  if (error) {
    toast.error("Failed to load documents");
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 lg:p-8 bg-linear-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center size-10 rounded-xl bg-linear-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/25">
              <FolderOpen className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Document Library
              </h1>
              <p className="text-sm text-muted-foreground md:text-base">
                Browse and manage all documents in the knowledge base
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()} disabled={isValidating}>
            <RefreshCw className={cn("size-4 mr-1", isValidating && "animate-spin")} />
            Refresh
          </Button>
          <Badge variant="outline" className="hidden sm:flex gap-1 py-1.5">
            <FileText className="size-3.5" />
            {totalDocuments} Documents
          </Badge>
          <Badge variant="outline" className="hidden sm:flex gap-1 py-1.5">
            {formatBytes(totalStorageBytes)} Total
          </Badge>
        </div>
      </div>

      {/* Documents List */}
      <Card className="shadow-xl shadow-slate-200/50 dark:shadow-slate-950/50 border-0">
        <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-lg">All Documents</CardTitle>
              <CardDescription>
                {totalDocuments} documents in library
              </CardDescription>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={urlState.search}
                  onChange={(e) => setUrlState({ search: e.target.value, page: 1 })}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              {/* Filters */}
              <div className="flex items-center gap-2">
                <Select value={urlState.status} onValueChange={(val) => setUrlState({ status: val as "all" | "processed" | "processing" | "failed", page: 1 })}>
                  <SelectTrigger className="w-32">
                    <Filter className="size-4 mr-2" />
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="processed">Processed</SelectItem>
                    <SelectItem value="processing">Processing</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={urlState.sortBy} onValueChange={(val) => setUrlState({ sortBy: val as "newest" | "oldest" | "name" | "size", page: 1 })}>
                  <SelectTrigger className="w-32">
                    <SortAsc className="size-4 mr-2" />
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">Newest First</SelectItem>
                    <SelectItem value="oldest">Oldest First</SelectItem>
                    <SelectItem value="name">Name A-Z</SelectItem>
                    <SelectItem value="size">Size</SelectItem>
                  </SelectContent>
                </Select>
                {/* View Toggle */}
                <div className="flex items-center border rounded-lg p-1">
                  <Button
                    variant={urlState.viewMode === "list" ? "secondary" : "ghost"}
                    size="icon"
                    className="size-8"
                    onClick={() => setUrlState({ viewMode: "list" })}
                  >
                    <List className="size-4" />
                  </Button>
                  <Button
                    variant={urlState.viewMode === "grid" ? "secondary" : "ghost"}
                    size="icon"
                    className="size-8"
                    onClick={() => setUrlState({ viewMode: "grid" })}
                  >
                    <Grid3X3 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Bulk Actions */}
          {selectedItems.length > 0 && (
            <div className="flex items-center justify-between px-6 py-3 bg-violet-50 dark:bg-violet-950/30 border-b">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-violet-700 dark:text-violet-400">
                  {selectedItems.length} selected
                </span>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedItems(documents.map((doc) => doc.id))}
                    disabled={selectedItems.length === documents.length}
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setSelectedItems([])}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleBulkDownload}>
                  <Download className="size-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="size-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="size-4 mr-2" />
                  )}
                  Delete
                </Button>
              </div>
            </div>
          )}

          {/* Table View */}
          {urlState.viewMode === "list" && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/50">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={
                          selectedItems.length === documents.length &&
                          documents.length > 0
                        }
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="min-w-0 max-w-[200px] sm:max-w-[300px] md:max-w-[400px] lg:max-w-[500px]">Document</TableHead>
                    <TableHead className="hidden md:table-cell">Size</TableHead>
                    <TableHead className="hidden lg:table-cell">Uploaded By</TableHead>
                    <TableHead className="hidden sm:table-cell">Uploaded At</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32">
                        <div className="flex items-center justify-center">
                          <Loader2 className="size-8 animate-spin text-muted-foreground" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    documents.map((doc) => (
                    <TableRow
                      key={doc.id}
                      className={cn(
                        "group transition-colors",
                        deletingDocumentIds.includes(doc.id) &&
                          "opacity-60",
                        selectedItems.includes(doc.id) &&
                          "bg-violet-50/50 dark:bg-violet-950/20"
                      )}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedItems.includes(doc.id)}
                          disabled={deletingDocumentIds.includes(doc.id)}
                          onCheckedChange={() => toggleSelectItem(doc.id)}
                        />
                      </TableCell>
                      <TableCell className="min-w-0 max-w-[200px] sm:max-w-[300px] md:max-w-[400px] lg:max-w-[500px]">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center size-10 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                            {getFileIcon(doc.mimeType)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="hidden md:block overflow-x-auto scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent hover:scrollbar-thumb-slate-400 dark:hover:scrollbar-thumb-slate-600">
                                    <p className="font-medium whitespace-nowrap cursor-help pr-2">
                                      {doc.fileName}
                                    </p>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-md break-words">
                                  <p>{doc.fileName}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <p className="md:hidden font-medium break-all whitespace-normal max-w-full">
                              {doc.fileName}
                            </p>
                            <p className="text-xs text-muted-foreground md:hidden">
                              {formatBytes(doc.sizeBytes)}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">
                        {formatBytes(doc.sizeBytes)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {getUploaderLabel(doc)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">
                        {formatUploadTimestamp(doc.createdAt)}
                      </TableCell>
                      <TableCell>{getStatusBadge(doc.status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              disabled={deletingDocumentIds.includes(doc.id)}
                            >
                              {deletingDocumentIds.includes(doc.id) ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <MoreVertical className="size-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownload(doc)}>
                              <Download className="size-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleView(doc)}>
                              <FileText className="size-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              disabled={deletingDocumentIds.includes(doc.id)}
                              onClick={() => {
                                setDocumentToDelete(doc.id);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              {deletingDocumentIds.includes(doc.id) ? (
                                <Loader2 className="size-4 mr-2 animate-spin" />
                              ) : (
                                <Trash2 className="size-4 mr-2" />
                              )}
                              {deletingDocumentIds.includes(doc.id)
                                ? "Deleting..."
                                : "Delete"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Grid View */}
          {urlState.viewMode === "grid" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-6">
              {isLoading ? (
                <div className="col-span-full flex items-center justify-center py-16">
                  <Loader2 className="size-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                documents.map((doc) => (
                <Card
                  key={doc.id}
                  className={cn(
                    "flex h-full flex-col cursor-pointer transition-colors",
                    deletingDocumentIds.includes(doc.id) && "opacity-60",
                    selectedItems.includes(doc.id) && "bg-violet-50/50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800"
                  )}
                  onClick={() => !deletingDocumentIds.includes(doc.id) && toggleSelectItem(doc.id)}
                >
                  <CardHeader className="gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        {getFileIcon(doc.mimeType)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <CardTitle className="text-sm cursor-default break-all whitespace-normal w-full max-w-full leading-tight">
                                {doc.fileName}
                              </CardTitle>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-md wrap-break-word">
                              <p>{doc.fileName}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <CardDescription className="text-xs">
                          {new Date(doc.createdAt).toLocaleDateString()} • {formatBytes(doc.sizeBytes)}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {getStatusBadge(doc.status)}
                    </div>
                  </CardHeader>
                  <CardContent className="text-xs text-muted-foreground">
                    <p className="break-all">Uploaded by {getUploaderLabel(doc)}</p>
                    <p className="mt-1">{formatUploadTimestamp(doc.createdAt)}</p>
                  </CardContent>
                  <CardFooter className="mt-auto flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDownload(doc);
                      }}
                      disabled={deletingDocumentIds.includes(doc.id)}
                    >
                      <Download className="size-4 mr-1" />
                      Download
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleView(doc);
                      }}
                      disabled={deletingDocumentIds.includes(doc.id)}
                    >
                      <FileText className="size-4 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDocumentToDelete(doc.id);
                        setDeleteDialogOpen(true);
                      }}
                      disabled={deletingDocumentIds.includes(doc.id)}
                    >
                      {deletingDocumentIds.includes(doc.id) ? (
                        <Loader2 className="size-4 mr-1 animate-spin" />
                      ) : (
                        <Trash2 className="size-4 mr-1" />
                      )}
                      {deletingDocumentIds.includes(doc.id) ? "Deleting..." : "Delete"}
                    </Button>
                  </CardFooter>
                </Card>
              ))
              )}
            </div>
          )}

          {/* Empty State */}
          {!isLoading && documents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex items-center justify-center size-16 rounded-2xl bg-slate-100 dark:bg-slate-800 mb-4">
                <FolderOpen className="size-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No documents found</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                {urlState.search
                  ? "Try adjusting your search query"
                  : "Upload documents to get started"}
              </p>
            </div>
          )}
        </CardContent>

        {/* Pagination */}
        {totalDocuments > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t bg-slate-50/50 dark:bg-slate-900/50">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
                Showing {Math.min((urlState.page - 1) * urlState.limit + 1, totalDocuments)} to{" "}
                {Math.min(urlState.page * urlState.limit, totalDocuments)} of{" "}
                {totalDocuments} documents
              </p>
              <Select
                value={String(urlState.limit)}
                onValueChange={(val) => setUrlState({ limit: Number(val), page: 1 })}
              >
                <SelectTrigger className="w-[100px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 / page</SelectItem>
                  <SelectItem value="20">20 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                  <SelectItem value="100">100 / page</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-2 flex-wrap justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={urlState.page === 1}
                  onClick={() => setUrlState({ page: urlState.page - 1 })}
                >
                  <ChevronLeft className="size-4 sm:mr-1" />
                  <span className="hidden sm:inline">Previous</span>
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={urlState.page === page ? "default" : "outline"}
                      size="sm"
                      className="size-8 p-0"
                      onClick={() => setUrlState({ page })}
                    >
                      {page}
                    </Button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={urlState.page === totalPages}
                  onClick={() => setUrlState({ page: urlState.page + 1 })}
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="size-4 sm:ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Documents</AlertDialogTitle>
            <AlertDialogDescription>
              {documentToDelete
                ? "Are you sure you want to delete this document? This will also remove it from the AI knowledge base."
                : `Are you sure you want to delete ${selectedItems.length} document(s)? This will also remove them from the AI knowledge base.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                handleDelete(documentToDelete ? [documentToDelete] : selectedItems)
              }
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Document Preview Dialog */}
      <DocumentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        documentId={previewingDocumentId}
        fileName={previewingFileName}
      />
    </div>
  );
}
