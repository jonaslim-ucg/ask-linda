import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateText,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { openai } from "@ai-sdk/openai";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  createChat,
  getChatById,
  getImageAnalysisByIds,
  getImageAnalysisSummaryByChatId,
  getMessagesByChatId,
  getRagDocumentSummaryByChatId,
  getRagDocumentPreviewChunks,
  searchRagDocumentsByFileName,
  searchDocumentChunks,
  saveImageAnalysis,
  saveMessages,
  searchImageAnalysisByFileName,
  updateChatTitle,
} from "@/db/queries";
import { z } from "zod";
import {
  queryChatbotRagDocument,
  queryLibraryDocument,
  processRagDocumentsBatch,
  isSupportedRagFileType,
} from "@/lib/rag";
import type { FileUIPart } from "ai";
import { randomUUID } from "node:crypto";
import { presignS3GetUrl } from "@/lib/s3-presign";

// Image MIME types for vision processing
const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
];

// Analyze image with vision model
async function analyzeImageWithVision(imageUrl: string): Promise<string> {
  const { text } = await generateText({
    model: openai("gpt-5-mini"),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analyze this image in detail. Describe what you see, including any text, objects, people, colors, layout, and any other relevant information. Be thorough but concise.",
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

export const maxDuration = 60;

// System prompt for the AI
const systemPrompt = `You are Ask Linda — a secure, internal, expert knowledge assistant for this organization. You understand organizational context, reference official documents, accelerate learning, support decision-making, and deliver fast, accurate, and explainable responses.

YOUR CORE MISSION:
The organization's internal knowledge base (accessed via library_search) is your primary authority. These documents are NOT passive storage — they are active learning and decision-support assets including policies, procedures, HR manuals, clinical guidelines, operational workflows, IT/accounting/compliance documentation, and training materials.

You exist to:
1. **Compress knowledge access** — reduce information retrieval from hours to seconds
2. **Accelerate onboarding** — new staff ask you instead of reading multiple manuals
3. **Ensure consistency** — deliver answers aligned with official internal policies
4. **Support decisions** — help users understand data and generate structured outputs while keeping final decisions with humans
5. **Be the Single Source of Truth** — prevent conflicting interpretations by grounding answers in approved documents

TOOL CALLING:
- You can call MULTIPLE tools in a single step - use them in parallel/sequence when it makes sense.
- You can call tools in any order or combination based on the situation.
- Don't be limited to calling one tool at a time - be efficient and call multiple if needed.
- Examples of parallel tool calls:
  - User asks about "images and documents" → call list_chat_images AND list_chat_documents together
  - User asks to "find pricing in doc.pdf" → call search_documents_by_name AND rag_search together
  - User asks "what's in the image and document?" → call get_image_details AND get_document_preview together

DOCUMENT/RAG TOOLS:
- library_search: **PRIMARY TOOL** - Semantic search across the organization's authoritative internal knowledge base (policies, procedures, HR manuals, onboarding docs, clinical guidelines, protocols, operational workflows, IT/accounting/compliance docs, training materials). USE THIS BY DEFAULT for all questions about organizational knowledge, policies, procedures, clinical protocols, or any general question unless the user explicitly mentions their own uploaded files.
- rag_search: Semantic search across documents uploaded by the user in this chat. ONLY use when user explicitly references "my document", "the file I uploaded", "my PDF", etc.
- list_chat_documents: List all documents. Use when unsure what's available.
- get_document_preview: Get first few sections of a document. ONLY use this to understand what the document is about (a "hint"). It does NOT contain full document content - documents are too long for preview.
- search_documents_by_name: Find documents by filename.
- search_document_chunks: Exact text/phrase search within chunks.

QUERY REFORMULATION FOR SEMANTIC SEARCH (CRITICAL):
When calling rag_search or library_search, ALWAYS reformulate the user's question into an optimal semantic search query:

**Reformulation Principles:**
1. **Extract Core Concepts**: Identify the main topics, entities, and intent from the user's question
2. **Use Key Terms**: Focus on important nouns, medical terms, technical terminology, and specific concepts
3. **Remove Conversational Fluff**: Strip out "what is", "can you tell me", "I want to know", "please explain"
4. **Add Context**: Include relevant synonyms or related terms that might appear in documents
5. **Be Specific**: Use precise terminology rather than vague language
6. **Keep It Concise**: 3-10 words typically work best for semantic search

**Examples:**
- User: "What are the vacation policies for new employees?"
  → Query: "vacation policy new employee eligibility PTO accrual"
  
- User: "Can you tell me about diabetes management and treatment options?"
  → Query: "diabetes management treatment medication insulin therapy blood sugar control"
  
- User: "I need to know what the company's stance is on remote work"
  → Query: "remote work policy telecommuting work from home guidelines"
  
- User: "What does my blood test show about cholesterol?"
  → Query: "blood test results cholesterol levels LDL HDL triglycerides"
  
- User: "How do I submit an expense report?"
  → Query: "expense report submission process reimbursement procedure"

**Medical/Clinical Queries:**
- Include related medical terminology, anatomical terms, and clinical concepts
- Add common abbreviations (e.g., "hypertension high blood pressure BP")
- Include treatment modalities when relevant

**Technical Queries:**
- Use industry-standard terminology and acronyms
- Include related technical concepts and synonyms

**Policy/HR Queries:**
- Include policy types, employee categories, and relevant procedures
- Add synonyms (e.g., "PTO paid time off vacation leave")

CRITICAL CONTEXT AWARENESS RULES:
1. **ALWAYS ANALYZE THE CURRENT PROMPT**: For every user message, analyze what they're asking about and choose the appropriate tool(s) based on the CONTENT of their question, not just which tool was used previously.

2. **UNDERSTAND REFERENCES**: When users use pronouns ("it", "the document", "that policy") or follow-up phrases ("what about", "tell me more", "and also"), understand what they're referring to from context:
   - If they previously asked about a company handbook → they likely mean the library document
   - If they previously asked about their uploaded file → they likely mean their uploaded document
   - Use this understanding to inform your tool choice, but base the decision on WHAT they're asking about

3. **DETECT PERSONAL DOCUMENT REFERENCES**: When users use possessive language or personal references, they likely mean THEIR uploaded documents:
   - "my blood test", "my report", "my lab results", "my X-ray", "my scan"
   - "according to my [document]", "based on my [document]"
   - "tell me about my [something]", "analyze my [something]"
   - "in my document", "from my file"
   - When you see these patterns, FIRST check if user has uploaded documents (use list_chat_documents)
   - If documents exist, use rag_search OR call both rag_search and library_search in parallel
   - If no documents exist, inform user and ask them to upload or use library_search for general info

4. **IMPLICIT COMPANY CONTEXT**: Use library_search when the question implies organizational/company knowledge, even without explicit keywords:
   - Questions about rules, policies, procedures, guidelines (without possessive language)
   - Questions about benefits, payroll, holidays, vacation
   - Questions about onboarding, training, performance reviews
   - Questions about medical procedures, clinical protocols, patient care guidelines (general, not personal)
   - Questions about compliance, safety, regulations
   - Questions that reference content from a previous library_search result

5. **WHEN UNSURE - CALL BOTH**: If you're uncertain whether to use rag_search or library_search:
   - Call BOTH tools in parallel
   - Present results from whichever returns relevant information
   - This is PREFERRED over guessing wrong

6. **DEFAULT TO library_search**: library_search is the PRIMARY tool for GENERAL questions. Use it by default for searches about policies, procedures, and general knowledge UNLESS the user uses personal/possessive language suggesting they have uploaded documents.

WHEN TO USE WHICH SEARCH (DECISION GUIDE):

**Use rag_search (for personal/uploaded documents):**
- User explicitly mentions "my document", "the file I uploaded", "my PDF", "this file"
- User uses POSSESSIVE language: "my blood test", "my report", "my lab results", "my X-ray", "my scan", "my medical records"
- User says "according to my [X]", "based on my [X]", "analyze my [X]", "tell me about my [X]"
- User references content from a previous rag_search result
- User asks about content they clearly uploaded in this chat
- **IMPORTANT**: When you see possessive/personal language, FIRST check if documents exist using list_chat_documents, then use rag_search

**Use library_search (for company/general knowledge):**
- User asks about workplace topics (policies, procedures, HR, attendance, benefits, conduct, being late, leave, holidays) WITHOUT possessive language
- User asks about medical/clinical topics in GENERAL terms (not "my" blood test, but "how to interpret blood tests")
- User mentions company-related terms ("company policy", "our handbook", "organization procedures")
- User references content from a previous library_search result
- General questions without specific file references or possessive language
- Questions about general medical knowledge, treatments, protocols (not personal medical documents)

**Use BOTH rag_search AND library_search in parallel (when ambiguous):**
- Question could apply to both user uploads AND company library
- User has uploaded documents AND question is not clearly personal or general
- When you need comprehensive results from all available sources
- **EXAMPLE**: "tell me about diabetes management" (could be personal plan or general info) → call both

**Special handling for medical queries:**
- "my blood test" / "my lab results" / "my report" → rag_search (personal documents)
- "blood test interpretation" / "normal blood values" → library_search (general knowledge)
- "according to my test results" → rag_search (personal)
- If unsure → call BOTH in parallel

IMPORTANT WORKFLOW:
- get_document_preview gives you a HINT of what the document contains, NOT the answer.
- ALWAYS follow up get_document_preview with rag_search to find the actual answer.
- Example: User asks "what's in this document?" → 
  1. get_document_preview to understand what topics it covers
  2. Then rag_search with specific terms to get actual content for answering
- NEVER answer user questions using ONLY preview content - it's incomplete.

IMAGE TOOLS:
- For NEW images in current message: Analysis is already in IMAGE CONTEXT below.
- For PREVIOUS images: Use the image tools.
- list_chat_images: See all available images.
- get_image_details: Get full analysis for specific image(s) by ID.
- search_images: Find images by filename.
- Can call multiple image tools together when needed.

PRESENTING LISTS TO USERS:
- When showing document or image lists, DO NOT display technical IDs to users.
- Use a clean, numbered format with filename and upload date.
- Keep IDs internal - you need them to call other tools, but users don't need to see them.
- Example format:
  1️⃣ **filename.pdf** (uploaded Jan 27, 2026)
  2️⃣ **report.docx** (uploaded Jan 26, 2026)
  

SUPPORTED INTERACTION MODES:
You support all of the following user interaction patterns. Detect which mode the user is in and respond accordingly:

**A. Natural Language Q&A** — Direct questions about policies, procedures, clinical data, or operations.
  - Example: "What is our company policy on procurement approvals over $10,000?"
  - Action: library_search → answer clearly with citations

**B. Search & Retrieval** — Finding specific documents or the most relevant source for a topic.
  - Example: "Find me the most relevant document about vendor onboarding"
  - Action: library_search → present document name, summary, and key sections

**C. Interpretation & Analysis** — User uploads files (lab results, reports, images, spreadsheets) and asks for interpretation.
  - Example: "What does this lab result mean clinically?"
  - Action: rag_search (for uploaded content) + library_search (for clinical reference guidelines) → interpret with citations from both

**D. Summarization & Simplification** — User wants a large document or policy distilled into key points.
  - Example: "Summarize this policy in plain language"
  - Action: rag_search or library_search → provide bullet-point summary, highlight key takeaways, cite source

**E. Report & Document Generation** — User requests structured outputs like memos, SOPs, checklists, step-by-step guides.
  - Example: "Draft a checklist for onboarding a new nurse"
  - Action: library_search for relevant procedures → generate structured document grounded in official sources

**F. Guided Learning & Onboarding** — New staff seeking role-specific guidance.
  - Example: "I'm starting in procurement—what should I learn today?"
  - Action: library_search for onboarding docs, training materials, role-specific policies → create a learning path with document links, suggest priority topics, provide step-by-step orientation

RESPONSE STYLE:
- Be conversational, clear, and helpful
- Use emojis naturally to add personality and visual interest (but don't overuse them)
- Format responses with markdown for better readability

**Tone Adaptation:**
- Medical/Clinical queries → Professional clinical tone, empathetic, evidence-based. Maintain patient safety. Always recommend consulting healthcare professionals for medical decisions.
- HR/Operations queries → Business-professional tone, clear and actionable
- Technical/IT queries → Precise, instructional, step-by-step
- Onboarding queries → Warm, encouraging, structured learning guidance
- General queries → Conversational and approachable

FOR LONGER, STRUCTURED RESPONSES:
- Start with a friendly opener when appropriate (e.g., "Perfect 👍", "Got it! 👍", etc)
- Use numbered headings with emoji numbers for main sections: ## 1️⃣, ## 2️⃣, ## 3️⃣
- Separate major sections with --- when it improves clarity
- Use bullet points (*) for lists - keep them clean without trailing emojis
- Use callout emojis as prefixes: 👉, ❌, ✅, 🔥, ⚠️ (not at the end of lines) if necessary then.
- Emphasize key points with **bold** and *italics*
- End longer responses with next steps or a friendly prompt when relevant

FOR SHORT RESPONSES:
- Keep it concise and direct
- Use emojis sparingly for emphasis
- Skip elaborate formatting if the answer is simple

FORMATTING RULES:
- Always use markdown for code, links, and structure
- Use code fences for code snippets and formulas
- Make responses scannable and visually engaging
- Match the complexity of formatting to the complexity of the question

CITATIONS (CRITICAL):
- When you use information from documents, add citations in this format at the end of the sentence: [file: <fileName>, page: <pageNumber>].
- If page is unknown, omit it: [file: <fileName>].
- **Cite every factual claim sourced from documents** — this ensures transparency and trust.
- MEDICAL CITATIONS: For healthcare information, always cite sources and include document names to ensure clinical transparency and accountability.
- When multiple documents support an answer, cite all of them.
- Never fabricate information — if the documents don't contain an answer, say so clearly and suggest next steps.

DECISION SUPPORT BOUNDARIES:
- You ASSIST decision-making, you do NOT replace professional judgment.
- For clinical, financial, legal, or compliance questions: provide the relevant information from documents, explain reasoning, but explicitly note that final decisions should be made by qualified professionals.
- Flag uncertainty when documents don't fully address a question.
- Never present document-sourced guidance as medical/legal advice — present it as "per organizational documentation" or "according to internal guidelines."

MULTI-DOMAIN & ONBOARDING SUPPORT:
- You can assist across ALL organizational domains: medical, technology, HR, accounting, legal, operations, sales, marketing, procurement, compliance, safety, and general.
- MEDICAL DOMAIN EXPERTISE: For healthcare-related queries, prioritize clinical accuracy, patient safety, and evidence-based information. Use medical terminology appropriately and cite sources for clinical recommendations.
- ONBOARDING: When a user indicates they are new or asks onboarding questions:
  1. Identify their role/department if mentioned
  2. Search for role-specific onboarding documents, policies, and training materials
  3. Create a structured learning path with priorities
  4. Provide links to relevant documents
  5. Suggest what to learn first vs. what can wait
- When the domain is unclear, ask a short clarifying question (e.g., "Is this HR or IT?").
- Use library_search to find company policies, procedures, and training documents for onboarding and general questions.

`;

// Generate chat title from user message
async function generateTitleFromMessage(userMessage: string): Promise<string> {
  const { text } = await generateText({
    model: openai("gpt-4.1-mini"),
    system:
      "Generate a short, concise title (3-6 words) for a chat based on the user's message. Return only the title, no quotes or extra text.",
    prompt: userMessage,
  });
  return text.trim();
}

// Convert DB messages to UI messages
function convertToUIMessages(
  dbMessages: { id: string; role: string; parts: unknown }[],
): UIMessage[] {
  return dbMessages.map((msg) => ({
    id: msg.id,
    role: msg.role as "user" | "assistant",
    parts: msg.parts as UIMessage["parts"],
    content: "", // Required by UIMessage but parts take precedence
  }));
}

// Strip file parts from messages before sending to model
function stripFilePartsFromMessages(messages: UIMessage[]): UIMessage[] {
  return messages.map((msg) => ({
    ...msg,
    parts: Array.isArray(msg.parts)
      ? msg.parts.filter(
          (part) =>
            typeof part !== "object" ||
            part === null ||
            !("type" in part) ||
            part.type !== "file",
        )
      : msg.parts,
  }));
}

// Sanitize message IDs to prevent cross-provider ID conflicts.
// Anthropic IDs (msg_01...) sent to OpenAI's Responses API cause 404 errors
// because OpenAI tries to look them up as its own item references.
function sanitizeMessageIds(messages: UIMessage[]): UIMessage[] {
  return messages.map((msg) => ({
    ...msg,
    id: randomUUID(),
  }));
}

export async function POST(request: Request) {
  try {
    const headersList = await headers();
    const session = await auth.api.getSession({ headers: headersList });

    if (!session?.user) {
      return new Response("Unauthorized", { status: 401 });
    }

    const requestData = (await request.json()) as {
      id: string;
      message: UIMessage;
      files?: FileUIPart[];
      chatMode?: "internal" | "general";
    };
    const { id, message, files, chatMode = "internal" } = requestData;

    // Check if chat exists
    const existingChat = await getChatById(id);
    let titlePromise: Promise<string> | null = null;

    if (!existingChat) {
      // Create new chat with temporary title
      await createChat({
        id,
        userId: session.user.id,
        title: "New Chat",
      });

      // Generate title in background
      const userText =
        message.parts
          ?.filter(
            (p): p is { type: "text"; text: string } => p.type === "text",
          )
          .map((p) => p.text)
          .join(" ") || "";
      if (userText) {
        titlePromise = generateTitleFromMessage(userText);
      }
    }

    // Get existing messages (limit to last 30 messages to manage context window)
    const dbMessages = await getMessagesByChatId(id, 40);
    const previousMessages = convertToUIMessages(dbMessages);

    // Identify image files for processing (actual analysis happens inside stream)
    const imageFiles = (files ?? []).filter((f) => {
      const mimeType = f.mediaType ?? "";
      return IMAGE_MIME_TYPES.includes(mimeType);
    });

    // Identify document files for RAG processing
    const documentFiles = (files ?? []).filter((f) => {
      const mimeType = f.mediaType ?? "";
      return isSupportedRagFileType(mimeType);
    });

    // Message already contains file parts from frontend, no need to add them again
    // Add the new user message (with files already in parts for UI display)
    const allMessages: UIMessage[] = [...previousMessages, message];

    // Save user message to database (including file parts)
    await saveMessages([
      {
        id: message.id,
        chatId: id,
        role: "user",
        parts: message.parts,
      },
    ]);

    // Strip file parts from all messages before sending to model
    const messagesForModel = stripFilePartsFromMessages(allMessages);

    // Sanitize message IDs to avoid cross-provider conflicts (e.g. Anthropic IDs → OpenAI)
    const sanitizedMessages = sanitizeMessageIds(messagesForModel);

    // Convert to model messages (without file parts, with clean IDs)
    const modelMessages = await convertToModelMessages(sanitizedMessages);

    // Track library sources used in responses
    const librarySources: {
      documentId: string;
      fileName: string;
      pageNumber: string | null;
    }[] = [];

    // Create UI message stream
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Process images with vision model inside stream so we can show status
        let imageAnalysisResults: { fileName: string; analysis: string }[] = [];

        if (imageFiles.length > 0) {
          writer.write({
            type: "data-tool-status",
            data: `Analyzing ${imageFiles.length} image${imageFiles.length > 1 ? "s" : ""}...`,
            transient: true,
          });

          // Analyze all images in parallel
          imageAnalysisResults = await Promise.all(
            imageFiles
              .filter((f) => f.url)
              .map(async (imageFile, index) => {
                try {
                  // writer.write({
                  //   type: "data-tool-status",
                  //   data: `Analyzing image ${index + 1}/${imageFiles.length}: ${imageFile.filename ?? "image"}...`,
                  //   transient: true,
                  // });

                  // Presign the S3 URL so OpenAI can access it
                  const presignedUrl = await presignS3GetUrl(imageFile.url!, {
                    expiresInSeconds: 60 * 15, // 15 minutes
                  });
                  const analysis = await analyzeImageWithVision(presignedUrl);
                  const analysisId = randomUUID();
                  await saveImageAnalysis({
                    id: analysisId,
                    userId: session.user.id,
                    chatId: id,
                    messageId: message.id,
                    fileName: imageFile.filename ?? "image",
                    fileUrl: imageFile.url!,
                    mimeType: imageFile.mediaType,
                    analysis,
                    model: "gpt-5-mini",
                  });
                  return {
                    fileName: imageFile.filename ?? "image",
                    analysis,
                  };
                } catch (error) {
                  console.error("Image analysis error:", error);
                  return null;
                }
              }),
          ).then((results) =>
            results.filter(
              (r): r is { fileName: string; analysis: string } => r !== null,
            ),
          );
        }

        // Process document files for RAG (PDFs, DOCX, TXT) - in parallel
        let documentProcessingResults: {
          fileName: string;
          chunkCount: number;
          success: boolean;
          error?: string;
        }[] = [];

        if (documentFiles.length > 0) {
          // Prepare files for batch processing
          const filesToProcess = documentFiles
            .filter((docFile) => docFile.url)
            .map((docFile) => ({
              fileUrl: docFile.url!,
              fileName: docFile.filename ?? "document",
              fileKey: docFile.url!.split("/").pop() ?? "",
              mimeType: docFile.mediaType ?? "",
            }));

          // Process all documents in parallel
          const batchResult = await processRagDocumentsBatch({
            files: filesToProcess,
            userId: session.user.id,
            chatId: id,
            onProgress: (progressMessage) => {
              writer.write({
                type: "data-tool-status",
                data: progressMessage,
                transient: true,
              });
            },
          });

          // Map results back to the expected format
          documentProcessingResults = batchResult.results.map(
            (result, index) => ({
              fileName: filesToProcess[index].fileName,
              chunkCount: result.chunkCount,
              success: result.success,
              error: result.error,
            }),
          );
        }

        // Build dynamic system prompt with new image context only
        let dynamicSystemPrompt = systemPrompt;
        if (chatMode === "general") {
          dynamicSystemPrompt +=
            "\n\nGENERAL MODE OVERRIDE:\n- NEVER call the library_search tool.\n- Do not use internal knowledge base retrieval in this mode.\n- Use other available tools only when relevant (e.g., rag_search for user-uploaded documents, image/document tools for user files etc).\n- If the user asks for internal policy/library information, explain that General mode is active and ask whether they want to switch to Internal Knowledge mode.";
        }
        if (imageAnalysisResults.length > 0) {
          const imageContext = imageAnalysisResults
            .map((img) => `[Image: ${img.fileName}]\n${img.analysis}`)
            .join("\n\n");
          dynamicSystemPrompt += `\n\nIMAGE CONTEXT (User uploaded images analyzed via vision model):\n${imageContext}`;
        }

        // Add document processing context to system prompt
        if (documentProcessingResults.length > 0) {
          const successfulDocs = documentProcessingResults.filter(
            (d) => d.success,
          );
          const failedDocs = documentProcessingResults.filter(
            (d) => !d.success,
          );

          let docContext = "\n\nDOCUMENT UPLOAD STATUS:";
          if (successfulDocs.length > 0) {
            docContext += "\nDocuments ready for search:";
            for (const doc of successfulDocs) {
              docContext += `\n- ${doc.fileName}`;
            }
            docContext +=
              "\n\nIMPORTANT: Use the rag_search tool to find information from these documents.";
          }
          if (failedDocs.length > 0) {
            docContext += "\nFailed to process:";
            for (const doc of failedDocs) {
              docContext += `\n- ${doc.fileName}: ${doc.error}`;
            }
          }
          dynamicSystemPrompt += docContext;
        }

        // Check if we should force rag_search on first step
        const hasSuccessfulDocuments = documentProcessingResults.some(
          (d) => d.success,
        );

        const result = streamText({
          model: openai("gpt-4.1"),
          system: dynamicSystemPrompt,
          messages: modelMessages,
          stopWhen: stepCountIs(25), // Allow AI to continue after tool calls (max 25 steps)
          maxRetries: 5,

          // Force rag_search on first step if documents were uploaded
          prepareStep: hasSuccessfulDocuments
            ? ({ stepNumber }) => {
                if (stepNumber === 0) {
                  return {
                    toolChoice: { type: "tool", toolName: "rag_search" },
                  };
                }
                return {};
              }
            : undefined,

          tools: {
            rag_search: tool({
              description:
                "Search the user's uploaded documents using semantic search. IMPORTANT: Reformulate the user's question into an optimal semantic search query focusing on key concepts, medical/technical terms, and specific topics. Remove conversational phrases and focus on core information needs.",
              inputSchema: z.object({
                query: z
                  .string()
                  .min(1)
                  .describe(
                    "A reformulated semantic search query (3-10 words) focusing on key concepts and terms, not the original user question",
                  ),
                topK: z.number().min(1).max(20).optional(),
              }),
              // Explicitly type the tool input/output to satisfy TS
              execute: async ({
                query,
                topK = 5,
              }: {
                query: string;
                topK?: number;
              }) => {
                // console.log("RAG Input ", query, topK);
                writer.write({
                  type: "data-tool-status",
                  data: `Searching documents...`,
                  transient: true,
                });
                // console.log("rag search", query, "topk", topK);
                // Use internal RAG search implementation so the tool runs on-server
                try {
                  const results = await queryChatbotRagDocument({
                    query,
                    chatId: id, // chatId
                    userId: session.user.id,
                    topK,
                  });
                  // console.log("RAG search tool results:", results);
                  return results;
                } catch (error) {
                  console.error("RAG search error:", error);
                  return [];
                }
              },
            }),
            list_chat_images: tool({
              description:
                "List all images previously uploaded in this chat. Returns a lightweight summary with image ID, filename, upload date, and a brief preview of the analysis. Use this first to see what images are available before fetching full details.",
              inputSchema: z.object({}),
              execute: async () => {
                writer.write({
                  type: "data-tool-status",
                  data: "Loading image list...",
                  transient: true,
                });
                try {
                  const images = await getImageAnalysisSummaryByChatId(id);
                  if (images.length === 0) {
                    return {
                      message: "No images have been uploaded in this chat yet.",
                      images: [],
                    };
                  }
                  return {
                    message: `Found ${images.length} image(s) in this chat.`,
                    images: images.map((img) => ({
                      id: img.id,
                      fileName: img.fileName,
                      uploadedAt: img.createdAt,
                      preview: img.preview,
                    })),
                  };
                } catch (error) {
                  console.error("List images error:", error);
                  return { message: "Failed to list images.", images: [] };
                }
              },
            }),
            get_image_details: tool({
              description:
                "Get the full analysis details for specific image(s) by their ID(s). Use this after list_chat_images to fetch complete analysis for images the user is asking about. You can fetch multiple images at once by providing an array of IDs.",
              inputSchema: z.object({
                imageIds: z
                  .array(z.string())
                  .min(1)
                  .describe("Array of image IDs to fetch full analysis for"),
              }),
              execute: async ({ imageIds }: { imageIds: string[] }) => {
                writer.write({
                  type: "data-tool-status",
                  data: "Fetching image details...",
                  transient: true,
                });
                try {
                  const images = await getImageAnalysisByIds(imageIds);
                  if (images.length === 0) {
                    return {
                      message: "No images found with the provided IDs.",
                      images: [],
                    };
                  }
                  return {
                    message: `Retrieved ${images.length} image analysis(es).`,
                    images: images.map((img) => ({
                      id: img.id,
                      fileName: img.fileName,
                      fileUrl: img.fileUrl,
                      analysis: img.analysis,
                      uploadedAt: img.createdAt,
                    })),
                  };
                } catch (error) {
                  console.error("Get image details error:", error);
                  return {
                    message: "Failed to get image details.",
                    images: [],
                  };
                }
              },
            }),
            search_images: tool({
              description:
                "Search for images by filename. Use this when the user mentions a specific image name or wants to find images matching a pattern.",
              inputSchema: z.object({
                searchTerm: z
                  .string()
                  .min(1)
                  .describe("The filename or partial filename to search for"),
              }),
              execute: async ({ searchTerm }: { searchTerm: string }) => {
                writer.write({
                  type: "data-tool-status",
                  data: `Searching for "${searchTerm}"...`,
                  transient: true,
                });
                try {
                  const images = await searchImageAnalysisByFileName(
                    id,
                    searchTerm,
                  );
                  if (images.length === 0) {
                    return {
                      message: `No images found matching "${searchTerm}".`,
                      images: [],
                    };
                  }
                  return {
                    message: `Found ${images.length} image(s) matching "${searchTerm}".`,
                    images: images.map((img) => ({
                      id: img.id,
                      fileName: img.fileName,
                      fileUrl: img.fileUrl,
                      analysis: img.analysis,
                      uploadedAt: img.createdAt,
                    })),
                  };
                } catch (error) {
                  console.error("Search images error:", error);
                  return { message: "Failed to search images.", images: [] };
                }
              },
            }),
            // Document tools (similar to image tools)
            list_chat_documents: tool({
              description:
                "List all documents (PDFs, DOCX, TXT) uploaded in this chat. Returns filename, status, and upload date. Use this to see what documents are available before searching.",
              inputSchema: z.object({}),
              execute: async () => {
                writer.write({
                  type: "data-tool-status",
                  data: "Loading document list...",
                  transient: true,
                });
                try {
                  const documents = await getRagDocumentSummaryByChatId(id);
                  if (documents.length === 0) {
                    return {
                      message:
                        "No documents have been uploaded in this chat yet.",
                      documents: [],
                    };
                  }
                  const readyDocs = documents.filter(
                    (d) => d.status === "ready",
                  );
                  const processingDocs = documents.filter(
                    (d) => d.status === "processing",
                  );
                  const failedDocs = documents.filter(
                    (d) => d.status === "failed",
                  );

                  return {
                    message: `Found ${documents.length} document(s) in this chat.`,
                    summary: {
                      ready: readyDocs.length,
                      processing: processingDocs.length,
                      failed: failedDocs.length,
                    },
                    documents: documents.map((doc) => ({
                      id: doc.id,
                      fileName: doc.fileName,
                      status: doc.status,
                      uploadedAt: doc.createdAt,
                    })),
                  };
                } catch (error) {
                  console.error("List documents error:", error);
                  return {
                    message: "Failed to list documents.",
                    documents: [],
                  };
                }
              },
            }),
            get_document_preview: tool({
              description:
                "Get a preview of a document's content by its ID. Returns the first few text chunks to understand what the document is about. Use this to understand a document's content before doing a semantic search.",
              inputSchema: z.object({
                documentId: z
                  .string()
                  .describe("The document ID to get preview for"),
              }),
              execute: async ({ documentId }: { documentId: string }) => {
                writer.write({
                  type: "data-tool-status",
                  data: "Loading document preview...",
                  transient: true,
                });
                try {
                  const chunks = await getRagDocumentPreviewChunks(
                    documentId,
                    3,
                  );
                  if (chunks.length === 0) {
                    return {
                      message: "No content found for this document.",
                      preview: [],
                    };
                  }
                  return {
                    message: `Retrieved ${chunks.length} preview section(s).`,
                    preview: chunks.map((chunk) => ({
                      pageNumber: chunk.pageNumber,
                      text:
                        chunk.text.slice(0, 500) +
                        (chunk.text.length > 500 ? "..." : ""),
                    })),
                  };
                } catch (error) {
                  console.error("Get document preview error:", error);
                  return {
                    message: "Failed to get document preview.",
                    preview: [],
                  };
                }
              },
            }),
            search_documents_by_name: tool({
              description:
                "Search for documents by filename. Use when the user mentions a specific document name.",
              inputSchema: z.object({
                searchTerm: z
                  .string()
                  .min(1)
                  .describe("The filename or partial filename to search for"),
              }),
              execute: async ({ searchTerm }: { searchTerm: string }) => {
                writer.write({
                  type: "data-tool-status",
                  data: `Searching for "${searchTerm}"...`,
                  transient: true,
                });
                try {
                  const documents = await searchRagDocumentsByFileName(
                    id,
                    searchTerm,
                  );
                  if (documents.length === 0) {
                    return {
                      message: `No documents found matching "${searchTerm}".`,
                      documents: [],
                    };
                  }
                  return {
                    message: `Found ${documents.length} document(s) matching "${searchTerm}".`,
                    documents: documents.map((doc) => ({
                      id: doc.id,
                      fileName: doc.fileName,
                      status: doc.status,
                      uploadedAt: doc.createdAt,
                    })),
                  };
                } catch (error) {
                  console.error("Search documents error:", error);
                  return {
                    message: "Failed to search documents.",
                    documents: [],
                  };
                }
              },
            }),
            search_document_chunks: tool({
              description:
                "Search for specific text within document chunks. Use this for exact text/phrase matching, not semantic search. Good for finding specific mentions, quotes, or technical terms.",
              inputSchema: z.object({
                searchText: z
                  .string()
                  .min(1)
                  .describe(
                    "The exact text or phrase to search for in document chunks",
                  ),
                documentId: z
                  .string()
                  .optional()
                  .describe("Optional: Limit search to a specific document ID"),
                limit: z
                  .number()
                  .optional()
                  .default(10)
                  .describe("Maximum number of chunks to return (default: 10)"),
              }),
              execute: async ({
                searchText,
                documentId,
                limit = 10,
              }: {
                searchText: string;
                documentId?: string;
                limit?: number;
              }) => {
                writer.write({
                  type: "data-tool-status",
                  data: `Searching chunks for "${searchText}"...`,
                  transient: true,
                });
                try {
                  const chunks = await searchDocumentChunks({
                    chatId: id,
                    searchText,
                    documentId,
                    limit,
                  });
                  if (chunks.length === 0) {
                    return {
                      message: `No chunks found containing "${searchText}".`,
                      chunks: [],
                    };
                  }
                  return {
                    message: `Found ${chunks.length} chunk(s) containing "${searchText}".`,
                    chunks: chunks.map((chunk) => ({
                      id: chunk.id,
                      fileName: chunk.fileName,
                      chunkIndex: chunk.chunkIndex,
                      pageNumber: chunk.pageNumber,
                      text: chunk.text,
                    })),
                  };
                } catch (error) {
                  console.error("Search chunks error:", error);
                  return {
                    message: "Failed to search document chunks.",
                    chunks: [],
                  };
                }
              },
            }),
            ...(chatMode === "internal"
              ? {
                  library_search: tool({
                    description:
                      "PRIMARY TOOL — Search the organization's authoritative internal knowledge base using semantic search. This is the single source of truth for policies, procedures, HR manuals, clinical guidelines, operational workflows, compliance docs, training materials, and all institutional knowledge. Use this BY DEFAULT for any organizational, procedural, clinical, or policy question. Reformulate the user's question into an optimal semantic query with key concepts, domain-specific terminology, and related terms. For medical queries include clinical terminology; for HR include policy terms; for operations include workflow terms. Remove conversational language and focus on searchable concepts.",
                    inputSchema: z.object({
                      query: z
                        .string()
                        .min(1)
                        .describe(
                          "A reformulated semantic search query (3-15 words) with key terms, concepts, medical/technical terminology, and related synonyms - NOT the original user question",
                        ),
                      topK: z
                        .number()
                        .min(1)
                        .max(20)
                        .optional()
                        .describe("Number of results to return (default: 10)"),
                    }),
                    execute: async ({
                      query,
                      topK = 10,
                    }: {
                      query: string;
                      topK?: number;
                    }) => {
                      writer.write({
                        type: "data-tool-status",
                        data: "Searching knowledge library...",
                        transient: true,
                      });
                      try {
                        const { results } = await queryLibraryDocument({
                          query,
                          topK,
                        });

                        if (results.length === 0) {
                          return {
                            message:
                              "No relevant documents found in the knowledge library.",
                            results: [],
                          };
                        }

                        // Track unique sources for this response (deduplicate by documentId)
                        for (const r of results) {
                          if (
                            !librarySources.some(
                              (s) => s.documentId === r.documentId,
                            )
                          ) {
                            librarySources.push({
                              documentId: r.documentId,
                              fileName: r.fileName,
                              pageNumber: r.pageNumber,
                            });
                          }
                        }

                        // Send updated sources to frontend immediately
                        writer.write({
                          type: "data-library-sources",
                          data: librarySources,
                        });

                        return {
                          message: `Found ${results.length} relevant section(s) from the knowledge library.`,
                          results: results.map((r) => ({
                            documentId: r.documentId,
                            fileName: r.fileName,
                            pageNumber: r.pageNumber,
                            text: r.text,
                            relevanceScore: r.score,
                          })),
                        };
                      } catch (error) {
                        console.error("Library search error:", error);
                        return {
                          message: "Failed to search knowledge library.",
                          results: [],
                        };
                      }
                    },
                  }),
                }
              : {}),
          },
          // providerOptions: {
          //   openai: {
          //     // Enable reasoning/thinking if using a model that supports it
          //     reasoningEffort: "low",
          //   },
          // },
        });

        // Merge the stream without reasoning support
        writer.merge(result.toUIMessageStream({ sendReasoning: false }));

        // Update title if this is a new chat
        if (titlePromise) {
          const title = await titlePromise;
          writer.write({ type: "data-chat-title", data: title });
          writer.write({ type: "data-new-chat", data: { id, title } });
          await updateChatTitle({ id, title });
        }
      },
      onFinish: async ({ messages: finishedMessages }) => {
        // Save assistant messages to database
        const assistantMessages = finishedMessages.filter(
          (m) => m.role === "assistant",
        );
        if (assistantMessages.length > 0) {
          await saveMessages(
            assistantMessages.map((m) => {
              // Add library sources as a custom part if any were used
              const partsWithSources =
                librarySources.length > 0
                  ? [
                      ...(Array.isArray(m.parts) ? m.parts : []),
                      { type: "data-library-sources", data: librarySources },
                    ]
                  : m.parts;

              return {
                id: m.id,
                chatId: id,
                role: m.role,
                parts: partsWithSources,
              };
            }),
          );
        }
      },
    });
    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
