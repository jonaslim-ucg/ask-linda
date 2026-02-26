import { Pinecone } from "@pinecone-database/pinecone";

const apiKey = process.env.PINECONE_API_KEY;
const indexName = process.env.CHATBOT_PINECONE_INDEX_NAME;

if (!apiKey || !indexName) {
  throw new Error("Missing Pinecone configuration");
}

const pinecone = new Pinecone({ apiKey });

export const pineconeIndex = pinecone.Index(indexName);
