import { CohereClient } from "cohere-ai";
import { Pinecone } from "@pinecone-database/pinecone";
import { db } from "@/db";
import { libraryChunk, libraryDocument } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

export const queryChatbotRagDocument = async ({
  query,
  chatId,
  userId,
  topK = 20,
}: {
  query: string;
  chatId: string;
  userId: string;
  topK?: number;
}) => {
  const cohereApiKey = process.env.COHERE_API_KEY;
  if (!cohereApiKey) throw new Error("COHERE_API_KEY not set");

  const pineconeApiKey = process.env.PINECONE_API_KEY;
  if (!pineconeApiKey) throw new Error("PINECONE_API_KEY not set");

  const pineconeIndexName = process.env.CHATBOT_PINECONE_INDEX_NAME;
  if (!pineconeIndexName)
    throw new Error("CHATBOT_PINECONE_INDEX_NAME not set");

  // Initialize Cohere client
  const co = new CohereClient({
    token: cohereApiKey,
  });

  const queryEmbed = await co.embed({
    texts: [query],
    model: "embed-v4.0",
    inputType: "search_query",
  });

  const pineconeClient = new Pinecone({
    apiKey: pineconeApiKey,
  });
  const index = pineconeClient.index(pineconeIndexName);

  // Build filter dynamically
  const filter: Record<string, { $eq: string }> = {
    chatId: { $eq: chatId },
  };

  // Add userId filter if provided
  if (userId) {
    filter.userId = { $eq: userId };
  }

  const embeddings = queryEmbed.embeddings as number[][];
  const results = await index.query({
    topK,
    vector: embeddings[0],
    includeMetadata: true,
    includeValues: true,
    filter,
  });
  // console.log("queryChatbotRagDocument results:", JSON.stringify(results, null, 2));
  return results;
};

/**
 * Query the admin library documents using semantic search.
 * This searches across all documents in the shared library that have been uploaded by admins.
 */
export const queryLibraryDocument = async ({
  query,
  topK = 10,
}: {
  query: string;
  topK?: number;
}): Promise<{
  results: {
    id: string;
    documentId: string;
    fileName: string;
    text: string;
    pageNumber: string | null;
    chunkIndex: number;
    score: number;
  }[];
}> => {
  const cohereApiKey = process.env.COHERE_API_KEY;
  if (!cohereApiKey) throw new Error("COHERE_API_KEY not set");

  const pineconeApiKey = process.env.PINECONE_API_KEY;
  if (!pineconeApiKey) throw new Error("PINECONE_API_KEY not set");

  // Use LIBRARY_PINECONE_INDEX_NAME for admin library
  const pineconeIndexName =
    process.env.LIBRARY_PINECONE_INDEX_NAME ||
    process.env.CHATBOT_PINECONE_INDEX_NAME;
  if (!pineconeIndexName)
    throw new Error("LIBRARY_PINECONE_INDEX_NAME not set");

  // Initialize Cohere client
  const co = new CohereClient({
    token: cohereApiKey,
  });

  const queryEmbed = await co.embed({
    texts: [query],
    model: "embed-v4.0",
    inputType: "search_query",
  });

  const pineconeClient = new Pinecone({
    apiKey: pineconeApiKey,
  });
  const index = pineconeClient.index(pineconeIndexName);

  const embeddings = queryEmbed.embeddings as number[][];
  const pineconeResults = await index.query({
    topK,
    vector: embeddings[0],
    includeMetadata: true,
    includeValues: false,
  });

  if (!pineconeResults.matches || pineconeResults.matches.length === 0) {
    return { results: [] };
  }

  // Get the pinecone IDs to fetch from our database
  const pineconeIds = pineconeResults.matches.map((m) => m.id);
  const scoreMap = new Map(
    pineconeResults.matches.map((m) => [m.id, m.score ?? 0])
  );

  // Fetch chunks from database with document info
  const chunks = await db
    .select({
      id: libraryChunk.id,
      documentId: libraryChunk.documentId,
      pineconeId: libraryChunk.pineconeId,
      chunkIndex: libraryChunk.chunkIndex,
      pageNumber: libraryChunk.pageNumber,
      text: libraryChunk.text,
      fileName: libraryDocument.fileName,
    })
    .from(libraryChunk)
    .innerJoin(libraryDocument, eq(libraryChunk.documentId, libraryDocument.id))
    .where(inArray(libraryChunk.pineconeId, pineconeIds));

  // Map results with scores and sort by score
  const results = chunks
    .map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      fileName: chunk.fileName,
      text: chunk.text,
      pageNumber: chunk.pageNumber,
      chunkIndex: chunk.chunkIndex,
      score: scoreMap.get(chunk.pineconeId) ?? 0,
    }))
    .sort((a, b) => b.score - a.score);

  return { results };
};
