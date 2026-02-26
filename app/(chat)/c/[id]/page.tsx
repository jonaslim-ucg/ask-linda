"use client";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageAttachment,
  MessageAttachments,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Sources,
  SourcesTrigger,
  SourcesContent,
  Source,
} from "@/components/ai-elements/sources";
import { ChatInput } from "@/components/chat";
import type { ChatMode } from "@/components/chat/chat-mode-selector";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { DocumentPreviewDialog } from "@/components/library";
import { useChat } from "@ai-sdk/react";
import type { FileUIPart, UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { CopyIcon, PencilIcon, RotateCwIcon, Download, FileText, FileSpreadsheet } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const chatId = params.id as string;
  const query = searchParams.get("query");

  const [input, setInput] = useState("");
  const [customChatTitle, setCustomChatTitle] = useState<string | null>(null);
  const hasAppendedQuery = useRef(false);
  const hasLoadedMessages = useRef(false);
  const hasSentPendingMessage = useRef(false);
  const [editingMessage, setEditingMessage] = useState<{
    id: string;
    content: string;
  } | null>(null);
  const [chatMode, setChatModeState] = useState<ChatMode>("internal");

  // Apply saved chat mode after mount to avoid hydration mismatch (localStorage only on client)
  useEffect(() => {
    const saved = localStorage.getItem("chat-mode");
    if (saved === "internal" || saved === "general") setChatModeState(saved);
  }, []);

  const setChatMode = (mode: ChatMode) => {
    setChatModeState(mode);
    localStorage.setItem("chat-mode", mode);
  };

  // Fetch existing chat and messages
  const { data: chatData } = useSWR<{
    chat: { id: string; title: string; userId: string };
    messages: Array<{
      id: string;
      chatId: string;
      role: string;
      parts: unknown;
      createdAt: Date;
    }>;
  }>(!query ? `/api/chats/${chatId}` : null, fetcher);

  const chatTitle = customChatTitle ?? chatData?.chat.title ?? "New Chat";
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [streamingLibrarySources, setStreamingLibrarySources] = useState<
    { documentId: string; fileName: string; pageNumber: string | null }[]
  >([]);
  
  // Source preview dialog state
  const [sourcePreviewOpen, setSourcePreviewOpen] = useState(false);
  const [previewingDocumentId, setPreviewingDocumentId] = useState<string | null>(null);
  const [previewingFileName, setPreviewingFileName] = useState<string | undefined>(undefined);

  // Handler to open source preview
  const handleSourcePreview = useCallback((documentId: string, fileName: string) => {
    setPreviewingDocumentId(documentId);
    setPreviewingFileName(fileName);
    setSourcePreviewOpen(true);
  }, []);

  // Global mutate for refreshing sidebar chats
  const { mutate: globalMutate } = useSWRConfig();

  const { messages, sendMessage, status, regenerate, setMessages } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: (request) => ({
        body: {
          id: chatId,
          message: request.messages.at(-1),
          ...(request.body ?? {}),
        },
      }),
    }),
    onData: (dataPart) => {
      // Handle custom data like chat title updates
      if (dataPart.type === "data-chat-title" && typeof dataPart.data === "string") {
        setCustomChatTitle(dataPart.data);
      }
      // Handle tool status updates
      if (dataPart.type === "data-tool-status" && typeof dataPart.data === "string") {
        setToolStatus(dataPart.data);
      }
      // Handle library sources
      if (dataPart.type === "data-library-sources" && Array.isArray(dataPart.data)) {
        setStreamingLibrarySources(dataPart.data as { documentId: string; fileName: string; pageNumber: string | null }[]);
      }
      // Handle new chat - refresh sidebar
      if (dataPart.type === "data-new-chat") {
        // Dispatch custom event to refresh sidebar
        window.dispatchEvent(new Event("refresh-sidebar-chats"));
        // Invalidate all chat list queries to refresh sidebar
        globalMutate((key: unknown) => typeof key === "string" && key.startsWith("/api/chats"));
      }
      // Clear tool status when text starts streaming
      // if (dataPart.type === "text-delta" || dataPart.type === "text-start") {
      //   setToolStatus(null);
      // }
    },
    onFinish: () => {
      // Clear tool status when response is complete
      setToolStatus(null);
      // Update the last message's parts to include streaming sources, then clear
      if (streamingLibrarySources.length > 0) {
        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.role === "assistant") {
            const existingParts = Array.isArray(lastMsg.parts) ? lastMsg.parts : [];
            lastMsg.parts = [
              ...existingParts,
              { type: "data-library-sources", data: streamingLibrarySources },
            ];
          }
          return updated;
        });
        setStreamingLibrarySources([]);
      }
    },
  });

  // Load existing messages when chat data is available
  useEffect(() => {
    if (chatData && !hasLoadedMessages.current && !query) {
      hasLoadedMessages.current = true;
      if (chatData.messages.length > 0) {
        setMessages(
          chatData.messages.map((msg) => ({
            id: msg.id,
            role: msg.role as "user" | "assistant",
            parts: msg.parts as UIMessage["parts"],
          }))
        );
      }
    }
  }, [chatData, setMessages, query]);

  // Auto-send the initial query from URL params
  useEffect(() => {
    // Read mode directly from localStorage to avoid stale state on first render
    const resolvedMode = localStorage.getItem("chat-mode") === "general" ? "general" : "internal";

    if (!hasSentPendingMessage.current) {
      hasSentPendingMessage.current = true;

      try {
        const raw = sessionStorage.getItem(`pending-message:${chatId}`);
        if (raw) {
          sessionStorage.removeItem(`pending-message:${chatId}`);
          const parsed = JSON.parse(raw) as { text: string; files?: FileUIPart[] };
          const files = Array.isArray(parsed.files) ? parsed.files : [];

          if (parsed.text?.trim() || files.length > 0) {
            sendMessage(
              {
                role: "user",
                parts: [{ type: "text", text: parsed.text ?? "" }, ...files],
              },
              {
                body: { files, chatMode: resolvedMode },
              },
            );
            return;
          }
        }
      } catch {
        // ignore invalid stored payload
      }
    }

    if (query && !hasAppendedQuery.current) {
      hasAppendedQuery.current = true;
      sendMessage(
        {
          role: "user",
          parts: [{ type: "text", text: query }],
        },
        {
          body: { chatMode: resolvedMode },
        },
      );
      // Clean up the URL
      window.history.replaceState({}, "", `/c/${chatId}`);
    }
  }, [query, sendMessage, chatId]);

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    toast.success("Copied to clipboard!");
  };

  const handleEdit = (messageId: string, content: string) => {
    setEditingMessage({ id: messageId, content });
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
  };

  const handleSaveEdit = () => {
    if (!editingMessage) return;
    toast.info("Edit and regenerate would be implemented here");
    setEditingMessage(null);
  };

  const handleRegenerate = () => {
    regenerate();
  };

  const handleExport = async (format: "docx" | "xlsx") => {
    try {
      toast.info(`Exporting to ${format.toUpperCase()}...`);
      const response = await fetch(`/api/export?chatId=${chatId}&format=${format}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${chatTitle.replace(/[^a-zA-Z0-9\s-]/g, "").trim() || "chat"}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      

      toast.success(`Exported to ${format.toUpperCase()} successfully!`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to export");
    }
  };

  const handleExportMessage = async (message: UIMessage, format: "docx" | "xlsx") => {
    try {
      toast.info(`Exporting message to ${format.toUpperCase()}...`);
      
      const response = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: chatTitle,
          messages: [{
            role: message.role,
            parts: message.parts,
            createdAt: new Date(), 
          }],
          format,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Export failed");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `message.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`Message exported to ${format.toUpperCase()} successfully!`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to export");
    }
  };

  const handleTranscription = (transcription: string) => {
    setInput((prev) => prev + (prev ? " " : "") + transcription);
  };

  const onSubmitMessage = (message: { text: string; files: FileUIPart[] }) => {
    if (!message.text.trim() && message.files.length === 0) {
      return;
    }
    sendMessage(
      {
        role: "user",
        parts: [{ type: "text", text: message.text }, ...message.files],
      },
      {
        body: { files: message.files, chatMode },
      },
    );
    setInput("");
  };

  const getFilesFromParts = (parts: unknown): FileUIPart[] => {
    if (!Array.isArray(parts)) return [];
    return parts.filter(
      (p): p is FileUIPart =>
        typeof p === "object" &&
        p !== null &&
        (p as { type?: unknown }).type === "file"
    );
  };

  // Helper to get text content from message parts
  const getTextFromParts = (parts: unknown): string => {
    if (!Array.isArray(parts)) return "";
    return parts
      .filter(
        (p): p is { type: "text"; text: string } =>
          typeof p === "object" && p !== null && p.type === "text"
      )
      .map((p) => p.text)
      .join("");
  };

  // Helper to get reasoning from message parts
  const getReasoningFromParts = (
    parts: unknown
  ): { content: string } | null => {
    if (!Array.isArray(parts)) return null;
    const reasoningPart = parts.find(
      (p): p is { type: "reasoning"; reasoning: string } =>
        typeof p === "object" && p !== null && p.type === "reasoning"
    );
    return reasoningPart ? { content: reasoningPart.reasoning } : null;
  };

  // Helper to get library sources from message parts
  const getLibrarySourcesFromParts = (
    parts: unknown
  ): { documentId: string; fileName: string; pageNumber: string | null }[] => {
    if (!Array.isArray(parts)) return [];
    const sourcesPart = parts.find(
      (p): p is { type: "data-library-sources"; data: { documentId: string; fileName: string; pageNumber: string | null }[] } =>
        typeof p === "object" && p !== null && (p as { type?: unknown }).type === "data-library-sources"
    );
    return sourcesPart?.data ?? [];
  };

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
        <div className="flex items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <span className="font-medium text-sm">{chatTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" disabled={messages.length === 0}>
                <Download className="size-4 mr-1" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("docx")}>
                <FileText className="size-4 mr-2" />
                Export as Word (.docx)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                <FileSpreadsheet className="size-4 mr-2" />
                Export as Excel (.xlsx)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Chat conversation */}
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto max-w-3xl">
          {messages.map((message: UIMessage, index: number) => {
            const isEditing = editingMessage?.id === message.id;
            const textContent = getTextFromParts(message.parts);
            const reasoning = getReasoningFromParts(message.parts);
            const files = getFilesFromParts(message.parts);
            const isLastMessage = index === messages.length - 1;
            const isMessageStreaming = isLastMessage && (status === "streaming" || status === "submitted");
            
            // Get library sources - only show after streaming completes
            const savedSources = getLibrarySourcesFromParts(message.parts);
            const librarySources = savedSources;

            return (
              <Message
                className="group/message"
                from={message.role}
                key={message.id}
              >
                {isEditing && editingMessage ? (
                  <InputGroup className="w-full ring-0! has-[[data-slot=input-group-control]:focus-visible]:ring-0! has-[[data-slot=input-group-control]:focus-visible]:border-input!">
                    <InputGroupTextarea
                      onChange={(e) =>
                        setEditingMessage({
                          id: editingMessage.id,
                          content: e.target.value,
                        })
                      }
                      rows={3}
                      value={editingMessage.content}
                    />
                    <InputGroupAddon align="block-end" className="justify-end">
                      <InputGroupButton
                        onClick={handleCancelEdit}
                        size="sm"
                        variant="ghost"
                      >
                        Cancel
                      </InputGroupButton>
                      <InputGroupButton
                        onClick={handleSaveEdit}
                        size="sm"
                        variant="default"
                      >
                        Send
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                ) : (
                  <>
                    <div>
                      {/* Show spinner while waiting for reasoning to start */}

                      {isMessageStreaming && message.role === "assistant" && !textContent ? (
                        toolStatus ? (
                          <div className="flex items-center gap-2">
                            <Loader />
                            <Shimmer className="text-sm">
                              {toolStatus}
                            </Shimmer>
                          </div>
                        ) : (
                          <Reasoning isStreaming>
                            <ReasoningTrigger />
                            <ReasoningContent>{reasoning?.content ?? ""}</ReasoningContent>
                          </Reasoning>
                        )
                      ) : reasoning ? (
                        <Reasoning>
                          <ReasoningTrigger />
                          <ReasoningContent>{reasoning.content}</ReasoningContent>
                        </Reasoning>
                      ) : null}
                      {files.length > 0 && (
                        <MessageAttachments
                          className={
                            message.role === "user" ? "mb-2" : "mb-2 ml-0"
                          }
                        >
                          {files.map((file) => (
                            <MessageAttachment
                              data={file}
                              key={`${message.id}-${file.filename ?? file.url}`}
                            />
                          ))}
                        </MessageAttachments>
                      )}

                      <MessageContent>

                        <MessageResponse>{textContent}</MessageResponse>
                      </MessageContent>
                      
                      {/* Show library sources for assistant messages - only after streaming completes */}
                      {message.role === "assistant" && !isMessageStreaming && librarySources.length > 0 && (
                        <Sources className="mt-3">
                          <SourcesTrigger count={librarySources.length} />
                          <SourcesContent>
                            {librarySources.map((source) => (
                              <Source
                                key={source.documentId}
                                title={source.fileName}
                                onClick={() => handleSourcePreview(source.documentId, source.fileName)}
                              />
                            ))}
                          </SourcesContent>
                        </Sources>
                      )}
                    </div>
                    <MessageActions
                      className={`opacity-0 transition-opacity group-hover/message:opacity-100 ${message.role === "user"
                          ? "justify-end"
                          : "justify-start"
                        }`}
                    >
                      <MessageAction
                        onClick={() => handleCopy(textContent)}
                        tooltip="Copy"
                      >
                        <CopyIcon className="size-4" />
                      </MessageAction>

                      {message.role === "assistant" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" className="h-6 w-6">
                              <Download className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => handleExportMessage(message, "docx")}>
                              <FileText className="size-4 mr-2" />
                              Export as Word
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportMessage(message, "xlsx")}>
                              <FileSpreadsheet className="size-4 mr-2" />
                              Export to Excel
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      {/* {message.role === "user" && (
                        <MessageAction
                          onClick={() => handleEdit(message.id, textContent)}
                          tooltip="Edit"
                        >
                          <PencilIcon className="size-4" />
                        </MessageAction>
                      )} */}
                      {/* {message.role === "assistant" && (
                        <MessageAction
                          onClick={handleRegenerate}
                          tooltip="Regenerate"
                        >
                          <RotateCwIcon className="size-4" />
                        </MessageAction>
                      )} */}
                    </MessageActions>
                  </>
                )}
              </Message>
            );
          })}

          {/* Show loading indicator when submitted but no assistant response yet */}
          {(status === "submitted" || status === "streaming") &&
            messages.length > 0 &&
            messages[messages.length - 1]?.role === "user" && (
              <Message from="assistant">
                <div className="flex items-center gap-2 text-muted-foreground py-2">
                  <Loader />
                  {toolStatus && (
                    <span className="animate-pulse text-sm">{toolStatus}</span>
                  )}
                </div>
              </Message>
            )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Input area */}
      <div className="grid shrink-0 gap-4 bg-background pt-4">
        <div className="mx-auto w-full max-w-3xl px-4 pb-4">
          <ChatInput
            chatMode={chatMode}
            onChatModeChange={setChatMode}
            onChange={setInput}
            onSubmit={onSubmitMessage}
            onTranscription={handleTranscription}
            status={status === "streaming" ? "streaming" : "ready"}
            value={input}
          />
        </div>
      </div>

      {/* Source Preview Dialog */}
      <DocumentPreviewDialog
        open={sourcePreviewOpen}
        onOpenChange={setSourcePreviewOpen}
        documentId={previewingDocumentId}
        fileName={previewingFileName}
      />
    </div>
  );
}
