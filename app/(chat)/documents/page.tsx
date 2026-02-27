"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  FileArchiveIcon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  ExternalLinkIcon,
  Trash2Icon,
  Loader2,
} from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const formatDate = (value: string | Date) => {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(date);
};

const formatBytes = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) return "—";
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(value < 10 ? 1 : 0)} ${sizes[i]}`;
};

const truncateFilename = (filename: string, maxLength = 30) => {
  if (filename.length <= maxLength) return filename;
  const ext = filename.split(".").pop() ?? "";
  const name = filename.slice(0, filename.length - ext.length - 1);
  const truncated = name.slice(0, maxLength - ext.length - 4) + "...";
  return `${truncated}.${ext}`;
};

const getFileIcon = (fileName: string, mimeType?: string | null) => {
  if (mimeType?.startsWith("image/")) return <FileImageIcon className="size-5" />;
  if (mimeType?.includes("spreadsheet")) return <FileSpreadsheetIcon className="size-5" />;
  if (mimeType === "application/pdf") return <FileTextIcon className="size-5" />;

  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["xls", "xlsx", "csv"].includes(ext)) {
    return <FileSpreadsheetIcon className="size-5" />;
  }
  if (["pdf", "doc", "docx", "txt", "md"].includes(ext)) {
    return <FileTextIcon className="size-5" />;
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return <FileArchiveIcon className="size-5" />;
  }
  return <FileIcon className="size-5" />;
};

type LibraryDocument = {
  id: string;
  fileName: string;
  fileUrl?: string | null;
  mimeType?: string | null;
  status: "processing" | "ready" | "failed" | string;
  sizeBytes?: number | null;
  chatId?: string | null;
  createdAt: string;
};

type LibraryImage = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string | null;
  preview?: string | null;
  chatId?: string | null;
  createdAt: string;
};

type LibraryItem =
  | ({ kind: "document" } & LibraryDocument)
  | ({ kind: "image" } & LibraryImage);

const statusVariant = (status: string) => {
  if (status === "ready") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
};

export default function DocumentsLibraryPage() {
  const [activeTab, setActiveTab] = useState<"all" | "documents" | "images">("all");
  const [allItems, setAllItems] = useState<LibraryItem[]>([]);
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [images, setImages] = useState<LibraryImage[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [pageAll, setPageAll] = useState(1);
  const [pageDocuments, setPageDocuments] = useState(1);
  const [pageImages, setPageImages] = useState(1);
  const [totalAll, setTotalAll] = useState(0);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const itemsPerPage = 12;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  const buildQuery = useCallback(
    (page: number) => {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }
      params.set("page", String(page));
      params.set("pageSize", String(itemsPerPage));
      return params.toString();
    },
    [debouncedSearch, itemsPerPage]
  );

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/library?${buildQuery(pageAll)}`);
      if (!res.ok) {
        throw new Error("Failed to load library");
      }
      const json = (await res.json()) as {
        items: LibraryItem[];
        total: number;
      };
      setAllItems(json.items ?? []);
      setTotalAll(json.total ?? 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load library";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [buildQuery, pageAll]);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/rag/documents?${buildQuery(pageDocuments)}`);
      if (!res.ok) {
        throw new Error("Failed to load documents");
      }
      const json = (await res.json()) as {
        documents: LibraryDocument[];
        total: number;
      };
      setDocuments(json.documents ?? []);
      setTotalDocuments(json.total ?? 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load documents";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [buildQuery, pageDocuments]);

  const fetchImages = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/images?${buildQuery(pageImages)}`);
      if (!res.ok) {
        throw new Error("Failed to load images");
      }
      const json = (await res.json()) as {
        images: LibraryImage[];
        total: number;
      };
      setImages(json.images ?? []);
      setTotalImages(json.total ?? 0);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load images";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [buildQuery, pageImages]);

  useEffect(() => {
    if (activeTab === "all") {
      void fetchAll();
    }
  }, [activeTab, fetchAll]);

  useEffect(() => {
    if (activeTab === "documents") {
      void fetchDocuments();
    }
  }, [activeTab, fetchDocuments]);

  useEffect(() => {
    if (activeTab === "images") {
      void fetchImages();
    }
  }, [activeTab, fetchImages]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPageAll(1);
    setPageDocuments(1);
    setPageImages(1);
  }, [debouncedSearch]);

  const handleOpenFile = async (url: string) => {
    try {
      const res = await fetch(`/api/s3-presign?url=${encodeURIComponent(url)}`);
      if (!res.ok) {
        throw new Error("Failed to get presigned URL");
      }
      const json = (await res.json()) as { url: string };
      window.open(json.url, "_blank", "noopener");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to open file";
      toast.error(message);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/rag/documents/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to delete document");
      }
      if (activeTab === "all") {
        await fetchAll();
      } else if (activeTab === "documents") {
        await fetchDocuments();
      }
      toast.success("Document deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete document";
      toast.error(message);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDeleteImage = async (id: string) => {
    setDeletingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/images/${id}`, { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to delete image");
      }
      if (activeTab === "all") {
        await fetchAll();
      } else if (activeTab === "images") {
        await fetchImages();
      }
      toast.success("Image deleted");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete image";
      toast.error(message);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;

    setIsDeleting(true);
    const errors: string[] = [];

    for (const id of selectedItems) {
      try {
        const item = allItems.find((item) =>
          item.kind === "document" ? item.id === id : item.id === id
        );
        if (!item) continue;

        if (item.kind === "document") {
          const res = await fetch(`/api/rag/documents/${id}`, { method: "DELETE" });
          if (!res.ok) {
            throw new Error(`Failed to delete ${item.fileName}`);
          }
        } else {
          const res = await fetch(`/api/images/${id}`, { method: "DELETE" });
          if (!res.ok) {
            throw new Error(`Failed to delete ${item.fileName}`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to delete item";
        errors.push(message);
      }
    }

    setIsDeleting(false);
    setSelectedItems([]);

    if (errors.length > 0) {
      toast.error(`Failed to delete ${errors.length} item(s)`);
    } else {
      toast.success(`Successfully deleted ${selectedItems.length} item(s)`);
    }

    // Refresh the current view
    if (activeTab === "all") {
      await fetchAll();
    } else if (activeTab === "documents") {
      await fetchDocuments();
    } else if (activeTab === "images") {
      await fetchImages();
    }
  };

  const handleDeleteAll = async () => {
    setIsDeletingAll(true);
    try {
      const res = await fetch("/api/library", { method: "DELETE" });
      if (!res.ok) {
        throw new Error("Failed to delete all documents");
      }
      const json = (await res.json()) as {
        success: boolean;
        deleted: number;
        failed?: number;
        message?: string;
      };
      if (json.success) {
        toast.success(`Successfully deleted ${json.deleted} item(s)`);
      } else {
        toast.warning(json.message ?? "Some items failed to delete");
      }
      setSelectedItems([]);
      setPageAll(1);
      setPageDocuments(1);
      setPageImages(1);
      if (activeTab === "all") {
        await fetchAll();
      } else if (activeTab === "documents") {
        await fetchDocuments();
      } else if (activeTab === "images") {
        await fetchImages();
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to delete all documents";
      toast.error(message);
    } finally {
      setIsDeletingAll(false);
      setDeleteAllDialogOpen(false);
      setDeleteConfirmText("");
    }
  };

  const renderDocumentCard = (doc: LibraryDocument) => {
    const isDeleting = deletingIds.has(doc.id);
    const isSelected = selectedItems.includes(doc.id);
    return (
      <Card
        key={doc.id}
        className={cn(
          "flex h-full flex-col cursor-pointer transition-colors",
          isDeleting && "opacity-60",
          isSelected && "bg-violet-50/50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800"
        )}
        onClick={() => !isDeleting && toggleSelectItem(doc.id)}
      >
        <CardHeader className="gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
              {getFileIcon(doc.fileName, doc.mimeType)}
            </div>
            <div className="min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <CardTitle className="truncate text-sm cursor-default">
                    {truncateFilename(doc.fileName)}
                  </CardTitle>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{doc.fileName}</p>
                </TooltipContent>
              </Tooltip>
              <CardDescription className="text-xs">
                {formatDate(doc.createdAt)} • {formatBytes(doc.sizeBytes)}
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusVariant(doc.status)}>{doc.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {doc.mimeType ?? "Document"}
        </CardContent>
        <CardFooter className="mt-auto flex flex-wrap items-center gap-2">
          {doc.fileUrl && (
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                void handleOpenFile(doc.fileUrl!);
              }}
            >
              <ExternalLinkIcon className="mr-1 size-4" />
              Open
            </Button>
          )}
          {doc.chatId && (
            <Button asChild size="sm" variant="ghost" onClick={(e) => e.stopPropagation()}>
              <Link href={`/c/${doc.chatId}`} prefetch={false}>Open chat</Link>
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="destructive" disabled={isDeleting}>
                <Trash2Icon className="mr-1 size-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete document?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the document from the library and search index.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => void handleDeleteDocument(doc.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    );
  };

  const renderImageCard = (img: LibraryImage) => {
    const isDeleting = deletingIds.has(img.id);
    const isSelected = selectedItems.includes(img.id);
    return (
      <Card
        key={img.id}
        className={cn(
          "flex h-full flex-col cursor-pointer transition-colors",
          isDeleting && "opacity-60",
          isSelected && "bg-violet-50/50 dark:bg-violet-950/20 border-violet-200 dark:border-violet-800"
        )}
        onClick={() => !isDeleting && toggleSelectItem(img.id)}
      >
        <CardHeader className="gap-2">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileImageIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <CardTitle className="truncate text-sm cursor-default">
                    {truncateFilename(img.fileName)}
                  </CardTitle>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{img.fileName}</p>
                </TooltipContent>
              </Tooltip>
              <CardDescription className="text-xs">
                {formatDate(img.createdAt)}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          {img.preview ?? "Image analysis available"}
        </CardContent>
        <CardFooter className="mt-auto flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              void handleOpenFile(img.fileUrl);
            }}
          >
            <ExternalLinkIcon className="mr-1 size-4" />
            View
          </Button>
          {img.chatId && (
            <Button asChild size="sm" variant="ghost" onClick={(e) => e.stopPropagation()}>
              <Link href={`/c/${img.chatId}`} prefetch={false}>Open chat</Link>
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="destructive" disabled={isDeleting}>
                <Trash2Icon className="mr-1 size-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete image?</AlertDialogTitle>
                <AlertDialogDescription>
                  This removes the image analysis from the library.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => void handleDeleteImage(img.id)}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    );
  };

  const renderEmptyState = (label: string) => (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
      <p>No {label.toLowerCase()} found.</p>
      <p className="mt-1">Upload files in a chat to see them here.</p>
    </div>
  );

  const totalPagesAll = Math.ceil(totalAll / itemsPerPage);
  const totalPagesDocuments = Math.ceil(totalDocuments / itemsPerPage);
  const totalPagesImages = Math.ceil(totalImages / itemsPerPage);

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <div className="flex flex-col">
          <h1 className="text-sm font-semibold">Document Library</h1>
          <p className="text-xs text-muted-foreground">
            Manage all uploaded documents and images.
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Your uploads</h2>
              <p className="text-sm text-muted-foreground">
                PDFs, Word files, Excel spreadsheets, and images are indexed for search.
              </p>
            </div>
            <Input
              className="max-w-xs"
              placeholder="Search by filename..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "all" | "documents" | "images")}
            className="w-full"
          >
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="images">Images</TabsTrigger>
              </TabsList>
              <AlertDialog open={deleteAllDialogOpen} onOpenChange={(open) => {
                setDeleteAllDialogOpen(open);
                if (!open) setDeleteConfirmText("");
              }}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={isDeletingAll || (totalAll === 0 && totalDocuments === 0 && totalImages === 0)}>
                    {isDeletingAll ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2Icon className="size-4 mr-2" />
                    )}
                    Delete All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete all documents and images?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all your uploaded documents and images. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="py-4">
                    <label htmlFor="delete-confirm" className="text-sm font-medium">
                      Type <span className="font-bold text-destructive">delete all</span> to confirm:
                    </label>
                    <Input
                      id="delete-confirm"
                      className="mt-2 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 focus-visible:ring-red-300 dark:focus-visible:ring-red-800"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="delete all"
                      disabled={isDeletingAll}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeletingAll}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      onClick={() => void handleDeleteAll()}
                      disabled={isDeletingAll || deleteConfirmText !== "delete all"}
                    >
                      {isDeletingAll ? (
                        <><Loader2 className="size-4 mr-2 animate-spin" /> Deleting...</>
                      ) : (
                        "Delete All"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Bulk Actions */}
            {selectedItems.length > 0 && (
              <div className="mt-4 flex items-center justify-between rounded-lg border bg-violet-50 dark:bg-violet-950/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-violet-700 dark:text-violet-400">
                    {selectedItems.length} selected
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const currentItems =
                          activeTab === "all"
                            ? allItems.map((item) => item.id)
                            : activeTab === "documents"
                            ? documents.map((doc) => doc.id)
                            : images.map((img) => img.id);
                        setSelectedItems(currentItems);
                      }}
                      disabled={
                        (activeTab === "all" && selectedItems.length === allItems.length) ||
                        (activeTab === "documents" && selectedItems.length === documents.length) ||
                        (activeTab === "images" && selectedItems.length === images.length)
                      }
                    >
                      Select All
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setSelectedItems([])}>
                      Deselect All
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => void handleBulkDelete()}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="size-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2Icon className="size-4 mr-2" />
                    )}
                    Delete
                  </Button>
                </div>
              </div>
            )}

            <TabsContent value="all" className="mt-4">
              {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Card key={`skeleton-all-${index}`} className="h-44" />
                  ))}
                </div>
              ) : totalAll === 0 ? (
                renderEmptyState("files")
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {allItems.map((item) =>
                      item.kind === "document"
                        ? renderDocumentCard(item)
                        : renderImageCard(item)
                    )}
                  </div>
                  {totalPagesAll > 1 && (
                    <Pagination className="mt-6">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setPageAll((p) => Math.max(1, p - 1))}
                            className={pageAll === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {Array.from({ length: totalPagesAll }, (_, i) => i + 1).map((page) => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setPageAll(page)}
                              isActive={pageAll === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setPageAll((p) => Math.min(totalPagesAll, p + 1))}
                            className={pageAll === totalPagesAll ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Card key={`skeleton-doc-${index}`} className="h-44" />
                  ))}
                </div>
              ) : totalDocuments === 0 ? (
                renderEmptyState("documents")
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {documents.map(renderDocumentCard)}
                  </div>
                  {totalPagesDocuments > 1 && (
                    <Pagination className="mt-6">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setPageDocuments((p) => Math.max(1, p - 1))}
                            className={pageDocuments === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {Array.from({ length: totalPagesDocuments }, (_, i) => i + 1).map((page) => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setPageDocuments(page)}
                              isActive={pageDocuments === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setPageDocuments((p) => Math.min(totalPagesDocuments, p + 1))}
                            className={pageDocuments === totalPagesDocuments ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="images" className="mt-4">
              {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <Card key={`skeleton-img-${index}`} className="h-44" />
                  ))}
                </div>
              ) : totalImages === 0 ? (
                renderEmptyState("images")
              ) : (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {images.map(renderImageCard)}
                  </div>
                  {totalPagesImages > 1 && (
                    <Pagination className="mt-6">
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setPageImages((p) => Math.max(1, p - 1))}
                            className={pageImages === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                        {Array.from({ length: totalPagesImages }, (_, i) => i + 1).map((page) => (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setPageImages(page)}
                              isActive={pageImages === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setPageImages((p) => Math.min(totalPagesImages, p + 1))}
                            className={pageImages === totalPagesImages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
