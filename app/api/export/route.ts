import { auth } from "@/lib/auth";
import { getMessagesByChatId, getChatById } from "@/db/queries";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
  AlignmentType,
} from "docx";
import * as XLSX from "xlsx";

// Extract text content from message parts
function getTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter(
      (p): p is { type: "text"; text: string } =>
        typeof p === "object" && p !== null && p.type === "text"
    )
    .map((p) => p.text)
    .join("");
}

// Helper to strip markdown for Excel
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1") // Bold
    .replace(/\*(.*?)\*/g, "$1")     // Italic
    .replace(/`(.*?)`/g, "$1")       // Code
    .replace(/\[(.*?)\]\(.*?\)/g, "$1") // Links
    .replace(/^\s*#+\s/gm, "")       // Headers
    .replace(/^\s*[-*]\s/gm, "• ")     // List items (replace with bullet char)
    .replace(/^\s*\d+\.\s/gm, "")    // Numbered list prefixes (approx)
    .replace(/\n{3,}/g, "\n\n");     // Excessive newlines
}

// Helper to parse markdown line into TextRuns for Docx
function parseInlineMarkdown(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // Split by bold, italic, code markers
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`[^`]+`)/g);

  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(new TextRun({ text: part.slice(2, -2), bold: true, size: 22 }));
    } else if (part.startsWith("*") && part.endsWith("*")) {
      runs.push(new TextRun({ text: part.slice(1, -1), italics: true, size: 22 }));
    } else if (part.startsWith("`") && part.endsWith("`")) {
      runs.push(new TextRun({ text: part.slice(1, -1), font: "Courier New", size: 20 }));
    } else {
      runs.push(new TextRun({ text: part, size: 22 }));
    }
  }
  return runs;
}

// Helper to process markdown blocks for Docx
function convertMarkdownToParagraphs(text: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    // Headers
    if (line.match(/^\s*#{1,6}\s/)) {
      const match = line.match(/^\s*#{1,6}/);
      const level = match ? match[0].trim().length : 1;
      const content = line.replace(/^\s*#{1,6}\s/, "");
      
      let heading = HeadingLevel.HEADING_1 as (typeof HeadingLevel)[keyof typeof HeadingLevel];
      if (level === 2) heading = HeadingLevel.HEADING_2;
      if (level === 3) heading = HeadingLevel.HEADING_3;
      if (level >= 4) heading = HeadingLevel.HEADING_4;

      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: content, size: 24 + (4-level)*2, bold: true })], // Add explicit styling as fallback
          heading: heading,
          spacing: { before: 240, after: 120 },
        })
      );
      continue;
    }

    // List items (Bullets)
    if (line.match(/^\s*[-*]\s/)) {
      const content = line.replace(/^\s*[-*]\s/, "");
      paragraphs.push(
        new Paragraph({
          children: parseInlineMarkdown(content),
          bullet: { level: 0 }, 
          spacing: { after: 100 },
        })
      );
      continue;
    }
    
    // Numbered lists (Simple handling mostly for visual)
    if (line.match(/^\s*\d+\.\s/)) {
        const content = line.replace(/^\s*\d+\.\s/, "");
        // Using bullet with index is complex without config, so simulate or just indent
        paragraphs.push(
          new Paragraph({
              children: [new TextRun({ text: line.match(/^\s*\d+\./)![0] + " " }), ...parseInlineMarkdown(content)],
              indent: { left: 720, hanging: 360 },
              spacing: { after: 100 },
          })
        );
        continue;
    }

    // Normal paragraph
    paragraphs.push(
      new Paragraph({
        children: parseInlineMarkdown(line),
        spacing: { after: 200 },
      })
    );
  }

  return paragraphs;
}

// Export to Word (.docx) format
async function exportToWord(
  chatTitle: string,
  messages: Array<{ role: string; parts: unknown; createdAt: Date }>
): Promise<Buffer> {
  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      text: chatTitle,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    })
  );

  // Export date
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Exported on: ${new Date().toLocaleString()}`,
          italics: true,
          size: 20,
          color: "666666",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
    })
  );

  // Separator
  children.push(
    new Paragraph({
      border: {
        bottom: {
          color: "CCCCCC",
          space: 1,
          style: BorderStyle.SINGLE,
          size: 6,
        },
      },
      spacing: { after: 400 },
    })
  );

  // Messages
  for (const message of messages) {
    const textContent = getTextFromParts(message.parts);
    if (!textContent.trim()) continue;

    const isUser = message.role === "user";
    const roleLabel = isUser ? "You" : "Ask Linda";
    const timestamp = new Date(message.createdAt).toLocaleString();

    // Role header
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: roleLabel,
            bold: true,
            size: 24,
            color: isUser ? "2563EB" : "16A34A",
          }),
          new TextRun({
            text: `  •  ${timestamp}`,
            size: 18,
            color: "999999",
          }),
        ],
        spacing: { before: 300, after: 100 },
      })
    );

    // Message content - processed from markdown
    const formattedParagraphs = convertMarkdownToParagraphs(textContent);
    children.push(...formattedParagraphs);
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

// Export to Excel (.xlsx) format
function exportToExcel(
  chatTitle: string,
  messages: Array<{ role: string; parts: unknown; createdAt: Date }>
): Buffer {
  const data: (string | Date)[][] = [
    ["Chat Export: " + chatTitle],
    ["Exported on: " + new Date().toLocaleString()],
    [], // Empty row
    ["Role", "Message", "Timestamp"],
  ];

  for (const message of messages) {
    const textContent = getTextFromParts(message.parts);
    if (!textContent.trim()) continue;

    const roleLabel = message.role === "user" ? "You" : "Ask Linda";
    
    // Strip markdown for Excel readability
    const plainText = stripMarkdown(textContent);
    
    data.push([roleLabel, plainText, new Date(message.createdAt).toLocaleString()]);
  }

  const worksheet = XLSX.utils.aoa_to_sheet(data);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 15 }, // Role
    { wch: 100 }, // Message
    { wch: 25 }, // Timestamp
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Chat");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return buffer;
}


export async function POST(request: NextRequest) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { title, messages, format = "docx" } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: "No messages to export" }, { status: 400 });
    }

    const chatTitle = title || "Chat Export";
    const sanitizedTitle = chatTitle.replace(/[^a-zA-Z0-9\s-]/g, "").trim() || "chat";

    if (format === "xlsx") {
      const buffer = exportToExcel(chatTitle, messages);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${sanitizedTitle}.xlsx"`,
        },
      });
    }

    // Default to Word
    const buffer = await exportToWord(chatTitle, messages);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${sanitizedTitle}.docx"`,
      },
    });

  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to generate export" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("chatId");
  const format = searchParams.get("format") || "docx";

  if (!chatId) {
    return NextResponse.json({ error: "Chat ID is required" }, { status: 400 });
  }

  // Verify chat belongs to user
  const chat = await getChatById(chatId);
  if (!chat || chat.userId !== session.user.id) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  // Get messages
  const messages = await getMessagesByChatId(chatId);

  if (messages.length === 0) {
    return NextResponse.json({ error: "No messages to export" }, { status: 400 });
  }

  const chatTitle = chat.title || "Chat Export";
  const sanitizedTitle = chatTitle.replace(/[^a-zA-Z0-9\s-]/g, "").trim() || "chat";

  try {
    if (format === "xlsx") {
      const buffer = exportToExcel(chatTitle, messages);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${sanitizedTitle}.xlsx"`,
        },
      });
    }
    // Default to Word
    const buffer = await exportToWord(chatTitle, messages);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${sanitizedTitle}.docx"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to generate export" },
      { status: 500 }
    );
  }
}
