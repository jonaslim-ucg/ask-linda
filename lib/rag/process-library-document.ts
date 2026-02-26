import { CohereClient } from "cohere-ai";
import { SentenceSplitter, Document, TextNode } from "llamaindex";
import { PDFReader } from "@llamaindex/readers/pdf";
import { DocxReader } from "@llamaindex/readers/docx";
import { TextFileReader } from "@llamaindex/readers/text";
import * as XLSX from "xlsx";
import { Pinecone } from "@pinecone-database/pinecone";
import { randomUUID } from "node:crypto";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { presignS3GetUrl } from "@/lib/s3-presign";
import {
  createLibraryDocument,
  updateLibraryDocumentStatus,
  saveLibraryChunks,
  getLibraryChunksByDocumentId,
  deleteLibraryDocumentById,
} from "@/db/queries";

// Custom CohereEmbedding class with internal batching
class CustomCohereEmbedding {
  private cohereClient: CohereClient;
  private batchSize: number;

  constructor(cohereClient: CohereClient, batchSize = 96) {
    this.cohereClient = cohereClient;
    this.batchSize = batchSize;
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
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

// Image types that need OCR/vision processing
const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

// Parse Excel file into Documents
function parseExcelToDocuments(buffer: Buffer, fileName: string): Document[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const documents: Document[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    if (csv.trim()) {
      documents.push(
        new Document({
          text: csv,
          metadata: { sheetName, fileName },
        })
      );
    }
  }

  return documents;
}

// Process image using GPT-4 Vision to extract text/description
async function processImageWithVision(
  imageUrl: string,
  fileName: string
): Promise<string> {
  const { text } = await generateText({
    model: openai("gpt-5-mini"),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this image and provide a detailed description of its contents. 
If it contains text (like a document, screenshot, or infographic), extract and transcribe all visible text.
If it's a diagram, chart, or visual, describe its structure and meaning.
If it's a photo, describe what you see in detail.

Image filename: ${fileName}

Provide your response in a structured format that can be used for search and retrieval.`,
          },
          {
            type: "image",
            image: imageUrl,
          },
        ],
      },
    ],
  });

  return text;
}

export interface ProcessLibraryDocumentOptions {
  fileUrl: string;
  fileName: string;
  fileKey: string;
  mimeType: string;
  sizeBytes?: number;
  uploadedBy: string;
  onProgress?: (message: string) => void;
}

export interface ProcessLibraryDocumentResult {
  success: boolean;
  documentId: string;
  chunkCount: number;
  error?: string;
}

export async function processLibraryDocument({
  fileUrl,
  fileName,
  fileKey,
  mimeType,
  sizeBytes,
  uploadedBy,
  onProgress,
}: ProcessLibraryDocumentOptions): Promise<ProcessLibraryDocumentResult> {
  const documentId = randomUUID();
  const progress = onProgress ?? (() => {});

  try {
    // Validate file type
    const fileExtension = SUPPORTED_MIME_TYPES[mimeType];
    if (!fileExtension) {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    progress(`Processing library document: ${fileName}`);

    // Create document record in database
    await createLibraryDocument({
      id: documentId,
      uploadedBy,
      fileName,
      fileKey,
      fileUrl,
      mimeType,
      sizeBytes,
      metadata: { startedAt: new Date().toISOString() },
    });

    // Initialize Cohere client
    const cohereApiKey = process.env.COHERE_API_KEY;
    if (!cohereApiKey) throw new Error("COHERE_API_KEY not set");

    const co = new CohereClient({ token: cohereApiKey });
    const embedModel = new CustomCohereEmbedding(co);

    // Initialize Pinecone - use LIBRARY_PINECONE_INDEX_NAME for admin library
    const pineconeApiKey = process.env.PINECONE_API_KEY;
    const pineconeIndexName = process.env.LIBRARY_PINECONE_INDEX_NAME || process.env.CHATBOT_PINECONE_INDEX_NAME;
    if (!pineconeApiKey || !pineconeIndexName) {
      throw new Error("Missing Pinecone configuration");
    }

    const pinecone = new Pinecone({ apiKey: pineconeApiKey });
    const pineconeIndex = pinecone.index(pineconeIndexName);

    // Initialize splitter
    const splitter = new SentenceSplitter({ chunkSize: 600, chunkOverlap: 100 });

    // Get presigned URL for S3 access
    progress("Downloading document...");
    const presignedUrl = await presignS3GetUrl(fileUrl, { expiresInSeconds: 60 * 15 });

    let documents: Document[];
    const isImage = IMAGE_MIME_TYPES.includes(mimeType);

    if (isImage) {
      // Process image with Vision API
      progress("Analyzing image content...");
      const imageAnalysis = await processImageWithVision(presignedUrl, fileName);
      
      if (!imageAnalysis.trim()) {
        throw new Error("Could not extract content from image");
      }

      documents = [
        new Document({
          text: imageAnalysis,
          metadata: { fileName, type: "image" },
        }),
      ];
    } else {
      // Download and process document
      const response = await fetch(presignedUrl);
      if (!response.ok) {
        throw new Error(`Failed to download document: ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      progress("Reading document content...");

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

        // Write buffer to temporary file
        const fs = await import("fs/promises");
        const path = await import("path");
        const os = await import("os");
        const tempFilePath = path.join(os.tmpdir(), `${randomUUID()}${fileExtension}`);
        await fs.writeFile(tempFilePath, fileBuffer);

        try {
          documents = await reader.loadData(tempFilePath);
        } finally {
          await fs.unlink(tempFilePath).catch((err) =>
            console.error("Failed to delete temp file:", err)
          );
        }
      }
    }

    if (documents.length === 0) {
      throw new Error("No content extracted from document");
    }

    // Check for empty content
    const totalTextLength = documents.reduce(
      (sum, doc) => sum + (doc.text?.trim()?.length ?? 0),
      0
    );
    if (totalTextLength === 0 && !isImage) {
      throw new Error(
        "This document appears to have no extractable text. For scanned documents, try uploading as images."
      );
    }

    progress("Analyzing document content...");

    // Base metadata for all chunks
    const baseMetadata = {
      documentId,
      uploadedBy,
      source: "library",
      documentType: fileExtension.slice(1),
      fileName,
    };

    // Process each document
    const allNodes: TextNode[] = [];

    for (const doc of documents) {
      const pageText = doc.text?.trim() || "";
      if (!pageText) continue;

      const nodeMetadata: Record<string, unknown> = { ...baseMetadata };
      if (doc.metadata?.page_number) {
        nodeMetadata.pageNumber = doc.metadata.page_number.toString();
      }

      const pageDoc = new Document({ text: pageText });
      const pageChunks = splitter.getNodesFromDocuments([pageDoc]);

      for (let chunkIndex = 0; chunkIndex < pageChunks.length; chunkIndex++) {
        const chunk = pageChunks[chunkIndex];
        allNodes.push(
          new TextNode({
            text: chunk.text,
            metadata: {
              ...nodeMetadata,
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

    progress("Generating embeddings...");

    // Generate embeddings
    const texts = allNodes.map((node) => node.text);
    const embeddings = await embedModel.getTextEmbeddings(texts);

    // Prepare vectors for Pinecone
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

    progress("Uploading to search index...");

    // Upsert to Pinecone in batches
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
      tokenCount: null,
      text: allNodes[index].text,
      metadata: allNodes[index].metadata,
    }));

    await saveLibraryChunks(chunkRecords);

    // Update document status
    await updateLibraryDocumentStatus({
      id: documentId,
      status: "ready",
      chunkCount: allNodes.length,
    });

    progress("Document ready!");

    return {
      success: true,
      documentId,
      chunkCount: allNodes.length,
    };
  } catch (error) {
    console.error("Library document processing error:", error);

    await updateLibraryDocumentStatus({
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

// Delete library document and its vectors from Pinecone
export async function deleteLibraryDocument(documentId: string): Promise<void> {
  const pineconeApiKey = process.env.PINECONE_API_KEY;
  const pineconeIndexName = process.env.LIBRARY_PINECONE_INDEX_NAME || process.env.CHATBOT_PINECONE_INDEX_NAME;

  if (!pineconeApiKey || !pineconeIndexName) {
    throw new Error("Missing Pinecone configuration");
  }

  // Get all chunks to find Pinecone IDs
  const chunks = await getLibraryChunksByDocumentId(documentId);
  const pineconeIds = chunks.map((c) => c.pineconeId);

  if (pineconeIds.length > 0) {
    const pinecone = new Pinecone({ apiKey: pineconeApiKey });
    const pineconeIndex = pinecone.index(pineconeIndexName);

    // Delete vectors from Pinecone in batches
    const deleteBatchSize = 100;
    for (let i = 0; i < pineconeIds.length; i += deleteBatchSize) {
      const batch = pineconeIds.slice(i, i + deleteBatchSize);
      await pineconeIndex.deleteMany(batch);
    }
  }

  // Delete document from database (cascade deletes chunks)
  await deleteLibraryDocumentById(documentId);
}

// Check if a file type is supported
export function isSupportedLibraryFileType(mimeType: string): boolean {
  return mimeType in SUPPORTED_MIME_TYPES;
}

// Get supported file extensions
export function getSupportedLibraryFileTypes(): string[] {
  return Object.values(SUPPORTED_MIME_TYPES);
}

// Batch processing for multiple library documents
export interface BatchProcessLibraryOptions {
  files: {
    fileUrl: string;
    fileName: string;
    fileKey: string;
    mimeType: string;
    sizeBytes?: number;
  }[];
  uploadedBy: string;
  onProgress?: (message: string) => void;
}

export interface BatchProcessLibraryResult {
  results: ProcessLibraryDocumentResult[];
  successCount: number;
  failCount: number;
}

export async function processLibraryDocumentsBatch({
  files,
  uploadedBy,
  onProgress,
}: BatchProcessLibraryOptions): Promise<BatchProcessLibraryResult> {
  const progress = onProgress ?? (() => {});
  const fileCount = files.length;

  progress(
    fileCount === 1
      ? "Processing document..."
      : `Processing ${fileCount} documents...`
  );

  // Process documents sequentially to avoid rate limits
  const results: ProcessLibraryDocumentResult[] = [];
  for (const file of files) {
    const result = await processLibraryDocument({
      fileUrl: file.fileUrl,
      fileName: file.fileName,
      fileKey: file.fileKey,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      uploadedBy,
      onProgress: undefined,
    });
    results.push(result);
  }

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  if (failCount === 0) {
    progress(fileCount === 1 ? "Document ready!" : "All documents ready!");
  } else if (successCount === 0) {
    progress("Document processing failed.");
  } else {
    progress(`${successCount} of ${fileCount} documents ready.`);
  }

  return {
    results,
    successCount,
    failCount,
  };
}
