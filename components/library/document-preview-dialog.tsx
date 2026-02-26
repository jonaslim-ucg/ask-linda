"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DocumentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string | null;
  fileName?: string;
}

interface DocumentPreviewData {
  document: {
    id: string;
    fileName: string;
    fileUrl: string | null;
    mimeType: string | null;
    status: string;
    chunkCount: number;
    createdAt: string;
  };
  previewChunks: {
    id: string;
    chunkIndex: number;
    pageNumber: string | null;
    text: string;
  }[];
}

export function DocumentPreviewDialog({
  open,
  onOpenChange,
  documentId,
  fileName,
}: DocumentPreviewDialogProps) {
  const [previewData, setPreviewData] = useState<DocumentPreviewData | null>(null);
  const [loading, setLoading] = useState(false);

  // Check if file is PDF
  const isPDF = (doc: DocumentPreviewData["document"]): boolean => {
    return (
      doc.mimeType === "application/pdf" ||
      doc.fileName.toLowerCase().endsWith(".pdf")
    );
  };

  // Get viewer URL for the document
  const getViewerUrl = (doc: DocumentPreviewData["document"]): string => {
    if (!doc.fileUrl) return "";
    
    // For PDFs, use direct URL
    if (isPDF(doc)) {
      return doc.fileUrl;
    }
    
    // For other documents (DOC, DOCX, XLS, etc.), use Google Docs Viewer
    return `https://docs.google.com/viewer?url=${encodeURIComponent(doc.fileUrl)}&embedded=true`;
  };

  // Fetch document preview data
  const fetchPreview = useCallback(async (id: string) => {
    setLoading(true);
    setPreviewData(null);

    try {
      const res = await fetch(`/api/library/${id}`);
      if (!res.ok) {
        throw new Error("Failed to load document preview");
      }
      const data = await res.json() as DocumentPreviewData;
      setPreviewData(data);
    } catch (error) {
      console.error("Failed to load source preview:", error);
      toast.error("Failed to load document preview");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load preview when dialog opens with a documentId
  useEffect(() => {
    if (open && documentId) {
      fetchPreview(documentId);
    }
  }, [open, documentId, fetchPreview]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setPreviewData(null);
      setLoading(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[90vh] w-[95vw] max-w-[95vw] flex flex-col p-0 gap-0 sm:max-w-[90vw] md:max-w-[85vw] lg:max-w-[80vw]">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            {fileName ?? previewData?.document?.fileName ?? "Document Preview"}
          </DialogTitle>
          <DialogDescription>
            Preview of content from the knowledge library
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : previewData?.document?.fileUrl ? (
            <iframe
              src={getViewerUrl(previewData.document)}
              className="h-full w-full border-0"
              title="Document Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Failed to load document preview
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
