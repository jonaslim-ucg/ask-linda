import { CohereClient } from "cohere-ai";
import { SentenceSplitter, Document, TextNode } from "llamaindex";
import { PDFReader } from "@llamaindex/readers/pdf";
import { DocxReader } from "@llamaindex/readers/docx";
import { TextFileReader } from "@llamaindex/readers/text";
import * as XLSX from "xlsx";
import { Pinecone } from "@pinecone-database/pinecone";
import { randomUUID } from "node:crypto";
import { presignS3GetUrl } from "@/lib/s3-presign";
import {
  createRagDocument,
  updateRagDocumentStatus,
  saveRagChunks,
} from "@/db/queries";

// Define custom CohereEmbedding class with internal batching
class CustomCohereEmbedding {
  private cohereClient: CohereClient;
  private batchSize: number;

  constructor(cohereClient: CohereClient, batchSize = 96) {
    this.cohereClient = cohereClient;
    this.batchSize = batchSize; // Cohere API limit
  }

  async getTextEmbedding(text: string): Promise<number[]> {
    const response = await this.cohereClient.embed({
      texts: [text],
      model: "embed-v4.0",
      inputType: "search_document",
    });
    const embeddings = response.embeddings as number[][];
    return embeddings[0];
  }

  async getTextEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const response = await this.cohereClient.embed({
        texts: batch,
        model: "embed-v4.0",
        inputType: "search_document",
      });
      embeddings.push(...(response.embeddings as number[][]));
    }
    return embeddings;
  }
}

// Supported file types
const SUPPORTED_MIME_TYPES: Record<string, string> = {
  "application/pdf": ".pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "text/plain": ".txt",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

// Parse Excel file into Documents (one per sheet)
function parseExcelToDocuments(buffer: Buffer, fileName: string): Document[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const documents: Document[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    // Convert sheet to CSV for text representation
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) {
      documents.push(
        new Document({
          text: csv,
          metadata: {
            sheetName,
            fileName,
          },
        })
      );
    }
  }

  return documents;
}

export interface ProcessDocumentOptions {
  fileUrl: string;
  fileName: string;
  fileKey: string;
  mimeType: string;
  sizeBytes?: number;
  userId: string;
  chatId: string;
  onProgress?: (message: string) => void;
}

export interface ProcessDocumentResult {
  success: boolean;
  documentId: string;
  chunkCount: number;
  error?: string;
}

export async function processRagDocument({
  fileUrl,
  fileName,
  fileKey,
  mimeType,
  sizeBytes,
  userId,
  chatId,
  onProgress,
}: ProcessDocumentOptions): Promise<ProcessDocumentResult> {
  const documentId = randomUUID();
  const progress = onProgress ?? (() => {});

  try {
    // Validate file type
    const fileExtension = SUPPORTED_MIME_TYPES[mimeType];
    if (!fileExtension) {
      throw new Error(`Unsupported file type: ${mimeType}. Supported: PDF, DOCX, TXT`);
    }

    progress(`Processing document: ${fileName}`);

    // Create document record in database with processing status
    await createRagDocument({
      id: documentId,
      userId,
      chatId,
      fileName,
      fileKey,
      fileUrl,
      source: "s3",
      mimeType,
      sizeBytes,
      metadata: { startedAt: new Date().toISOString() },
    });

    // Initialize Cohere client
    const cohereApiKey = process.env.COHERE_API_KEY;
    if (!cohereApiKey) throw new Error("COHERE_API_KEY not set");

    const co = new CohereClient({ token: cohereApiKey });
    const embedModel = new CustomCohereEmbedding(co);

    // Initialize Pinecone client directly
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const pineconeIndexName = process.env.CHATBOT_PINECONE_INDEX_NAME;
    if (!pineconeApiKey || !pineconeIndexName) {
      throw new Error("Missing Pinecone configuration");
    }

    const pinecone = new Pinecone({ apiKey: pineconeApiKey });
    const pineconeIndex = pinecone.index(pineconeIndexName);

    // Initialize splitter
    const splitter = new SentenceSplitter({ chunkSize: 600, chunkOverlap: 100 });

    // Get presigned URL for S3 access
    progress("Checking uploaded document...");
    const presignedUrl = await presignS3GetUrl(fileUrl, { expiresInSeconds: 60 * 15 });
    console.log("Presigned URL generated for:", fileUrl);
    
    // Download the document
    const response = await fetch(presignedUrl);
    if (!response.ok) {
      throw new Error(`Failed to download document: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    console.log(`Downloaded file: ${fileName}, size: ${fileBuffer.length} bytes`);

    // Select appropriate reader based on file type
    progress("Reading document content...");
    let documents: Document[];

    // Handle Excel files separately
    if (fileExtension === ".xls" || fileExtension === ".xlsx") {
      documents = parseExcelToDocuments(fileBuffer, fileName);
    } else {
      let reader: PDFReader | DocxReader | TextFileReader;
      switch (fileExtension) {
        case ".pdf":
          reader = new PDFReader();
          break;
        case ".docx":
          reader = new DocxReader();
          break;
        case ".txt":
          reader = new TextFileReader();
          break;
        default:
          throw new Error(`Unsupported file type: ${fileExtension}`);
      }

      // Write buffer to temporary file for reader
      const fs = await import("fs/promises");
      const path = await import("path");
      const os = await import("os");
      const tempFilePath = path.join(os.tmpdir(), `${randomUUID()}${fileExtension}`);
      await fs.writeFile(tempFilePath, fileBuffer);
      console.log(`Written temp file: ${tempFilePath}`);

      // Load the document using the selected reader
      try {
        documents = await reader.loadData(tempFilePath);
      } finally {
        // Clean up the temporary file
        await fs.unlink(tempFilePath).catch((err) => 
          console.error("Failed to delete temp file:", err)
        );
      }
    }

    if (documents.length === 0) {
      throw new Error("No content extracted from document");
    }

    // Debug: Log what was extracted
    console.log(`PDF extraction: ${documents.length} documents extracted`);
    for (let i = 0; i < Math.min(documents.length, 3); i++) {
      const doc = documents[i];
      console.log(`Doc ${i}: text length = ${doc.text?.length ?? 0}, metadata =`, doc.metadata);
      if (doc.text) {
        console.log(`Doc ${i} preview: "${doc.text.substring(0, 200)}..."`);
      }
    }

    // Check if all documents have empty text (scanned/image PDF)
    const totalTextLength = documents.reduce((sum, doc) => sum + (doc.text?.trim()?.length ?? 0), 0);
    if (totalTextLength === 0 && fileExtension === ".pdf") {
      throw new Error(
        "This PDF appears to be a scanned or image-based document with no extractable text. " +
        "Please upload a text-based PDF, or try uploading the document as images for analysis."
      );
    }

    progress(`Analyzing document content...`);

    // Base metadata for all chunks
    const baseMetadata = {
      documentId,
      userId,
      chatId,
      documentType: fileExtension.slice(1),
      fileName,
    };

    // Process each document (page for PDFs, single doc for others)
    const allNodes: TextNode[] = [];

    for (const doc of documents) {
      const pageText = doc.text?.trim() || "";
      if (!pageText) continue;

      // Include pageNumber if available (e.g., for PDFs)
      const nodeMetadata: Record<string, unknown> = { ...baseMetadata };
      if (doc.metadata?.page_number) {
        nodeMetadata.pageNumber = doc.metadata.page_number.toString();
      }

      // Split text into chunks
      const pageDoc = new Document({ text: pageText });
      const pageChunks = splitter.getNodesFromDocuments([pageDoc]);
      
      for (let chunkIndex = 0; chunkIndex < pageChunks.length; chunkIndex++) {
        const chunk = pageChunks[chunkIndex];
        allNodes.push(
          new TextNode({
            text: chunk.text,
            metadata: {
              ...nodeMetadata,
              elementType: "text",
              text: chunk.text,
              chunkIndex,
            },
          })
        );
      }
    }

    if (allNodes.length === 0) {
      throw new Error("No valid text content extracted from the document");
    }

    progress("Preparing document for search...");

    // Generate embeddings
    const texts = allNodes.map((node) => node.text);
    const embeddings = await embedModel.getTextEmbeddings(texts);

    // Prepare vectors for Pinecone upsert
    const vectors = allNodes.map((node, i) => {
      const vectorId = randomUUID();
      return {
        id: vectorId,
        values: embeddings[i],
        metadata: {
          ...node.metadata,
          text: node.text,
        },
      };
    });

    progress("Finalizing...");

    // Upsert to Pinecone in batches of 100
    const upsertBatchSize = 100;
    for (let i = 0; i < vectors.length; i += upsertBatchSize) {
      const batch = vectors.slice(i, i + upsertBatchSize);
      await pineconeIndex.upsert(batch);
    }

    // Save chunk records to database
    const chunkRecords = vectors.map((vector, index) => ({
      id: randomUUID(),
      documentId,
      pineconeId: vector.id,
      chunkIndex: index,
      pageNumber: (allNodes[index].metadata?.pageNumber as string) ?? null,
      tokenCount: null, // Could add token counting if needed
      text: allNodes[index].text,
      metadata: allNodes[index].metadata,
    }));

    await saveRagChunks(chunkRecords);

    // Update document status to ready
    await updateRagDocumentStatus({
      id: documentId,
      status: "ready",
      chunkCount: allNodes.length,
    });

    progress("Document ready for search!");

    return {
      success: true,
      documentId,
      chunkCount: allNodes.length,
    };
  } catch (error) {
    console.error("Document processing error:", error);
    
    // Update document status to failed
    await updateRagDocumentStatus({
      id: documentId,
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      success: false,
      documentId,
      chunkCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Check if a file type is supported for RAG processing
export function isSupportedRagFileType(mimeType: string): boolean {
  return mimeType in SUPPORTED_MIME_TYPES;
}

// Get supported file extensions
export function getSupportedRagFileTypes(): string[] {
  return Object.values(SUPPORTED_MIME_TYPES);
}

// Batch processing options for multiple documents
export interface BatchProcessOptions {
  files: {
    fileUrl: string;
    fileName: string;
    fileKey: string;
    mimeType: string;
    sizeBytes?: number;
  }[];
  userId: string;
  chatId: string;
  onProgress?: (message: string) => void;
}

export interface BatchProcessResult {
  results: ProcessDocumentResult[];
  successCount: number;
  failCount: number;
}

// Process multiple documents in parallel
export async function processRagDocumentsBatch({
  files,
  userId,
  chatId,
  onProgress,
}: BatchProcessOptions): Promise<BatchProcessResult> {
  const progress = onProgress ?? (() => {});
  const fileCount = files.length;

  // User-friendly generic progress messages
  progress(fileCount === 1 ? "Preparing your document..." : `Preparing ${fileCount} documents...`);

  // Process all documents in parallel
  const results = await Promise.all(
    files.map((file) =>
      processRagDocument({
        fileUrl: file.fileUrl,
        fileName: file.fileName,
        fileKey: file.fileKey,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        userId,
        chatId,
        // No individual progress - we handle it generically
        onProgress: undefined,
      })
    )
  );

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  // Final status message
  if (failCount === 0) {
    progress(fileCount === 1 ? "Document ready!" : "All documents ready!");
  } else if (successCount === 0) {
    progress(fileCount === 1 ? "Document processing failed." : "Document processing failed.");
  } else {
    progress(`${successCount} of ${fileCount} documents ready.`);
  }

  return {
    results,
    successCount,
    failCount,
  };
}
