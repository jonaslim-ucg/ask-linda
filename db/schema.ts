import {
  pgTable,
  text,
  timestamp,
  boolean,
  json,
  integer,
} from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"), // 'user' | 'admin'
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  impersonatedBy: text("impersonated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const twoFactor = pgTable("twoFactor", {
  id: text("id").primaryKey(),
  secret: text("secret"),
  backupCodes: text("backup_codes"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const chat = pgTable("chat", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const message = pgTable("message", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // 'user' | 'assistant'
  parts: json("parts").notNull(), // UIMessage parts
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const ragDocument = pgTable("rag_document", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  chatId: text("chat_id").references(() => chat.id, { onDelete: "set null" }),
  fileName: text("file_name").notNull(),
  fileKey: text("file_key"),
  fileUrl: text("file_url"),
  source: text("source").notNull().default("s3"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  status: text("status").notNull().default("processing"),
  chunkCount: integer("chunk_count").notNull().default(0),
  metadata: json("metadata"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ragChunk = pgTable("rag_chunk", {
  id: text("id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => ragDocument.id, { onDelete: "cascade" }),
  pineconeId: text("pinecone_id").notNull().unique(),
  chunkIndex: integer("chunk_index").notNull(),
  pageNumber: text("page_number"),
  tokenCount: integer("token_count"),
  text: text("text").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const imageAnalysis = pgTable("image_analysis", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  chatId: text("chat_id")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  messageId: text("message_id"),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  mimeType: text("mime_type"),
  analysis: text("analysis").notNull(),
  model: text("model").notNull().default("gpt-4o"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const authSettings = pgTable("auth_settings", {
  id: text("id").primaryKey().default("default"),
  registrationEnabled: boolean("registration_enabled").notNull().default(true),
  maintenanceMode: boolean("maintenance_mode").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Admin Library - separate from user RAG documents
export const libraryDocument = pgTable("library_document", {
  id: text("id").primaryKey(),
  uploadedBy: text("uploaded_by")
    .notNull()
    .references(() => user.id, { onDelete: "set null" }),
  fileName: text("file_name").notNull(),
  fileKey: text("file_key"),
  fileUrl: text("file_url"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  status: text("status").notNull().default("processing"), // 'processing' | 'ready' | 'failed'
  chunkCount: integer("chunk_count").notNull().default(0),
  metadata: json("metadata"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const libraryChunk = pgTable("library_chunk", {
  id: text("id").primaryKey(),
  documentId: text("document_id")
    .notNull()
    .references(() => libraryDocument.id, { onDelete: "cascade" }),
  pineconeId: text("pinecone_id").notNull().unique(),
  chunkIndex: integer("chunk_index").notNull(),
  pageNumber: text("page_number"),
  tokenCount: integer("token_count"),
  text: text("text").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
