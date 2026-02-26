"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Eye } from "lucide-react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { DataTable } from "@/components/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { toast } from "sonner";

interface Chat {
  id: string;
  title: string;
  userId: string;
  userName: string;
  userEmail: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface AdminMessage {
  id: string;
  role: string;
  parts: unknown;
  createdAt: string;
}

const extractMessageText = (parts: unknown): string => {
  if (typeof parts === "string") {
    return parts;
  }

  if (Array.isArray(parts)) {
    const textParts = parts
      .filter(
        (part): part is { type: "text"; text: string } =>
          typeof part === "object" &&
          part !== null &&
          "type" in part &&
          part.type === "text" &&
          "text" in part &&
          typeof part.text === "string"
      )
      .map((part) => part.text.trim())
      .filter((text) => text.length > 0);

    if (textParts.length > 0) {
      return textParts.join("\n");
    }
  }

  return "";
};

export default function AdminChatsPage() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
  });
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId")?.trim();
  const [messageDialog, setMessageDialog] = useState<{
    open: boolean;
    chat: Chat | null;
  }>({ open: false, chat: null });
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPagination((prev) => ({ ...prev, offset: 0 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(pagination.limit),
      offset: String(pagination.offset),
    });

    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }

    if (userId) {
      params.set("userId", userId);
    }

    return params.toString();
  }, [pagination.limit, pagination.offset, debouncedSearch, userId]);

  const fetcher = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Failed to fetch chats");
    }
    return response.json() as Promise<{
      chats: Chat[];
      total: number;
      limit: number;
      offset: number;
    }>;
  };

  const { data, error, isLoading } = useSWR(
    `/api/admin/chats?${queryParams}`,
    fetcher
  );

  useEffect(() => {
    if (data?.chats) {
      setChats(data.chats);
    }
  }, [data]);

  useEffect(() => {
    if (error) {
      console.error("Failed to fetch chats:", error);
      toast.error("Failed to fetch chats");
    }
  }, [error]);

  async function handleViewMessages(chat: Chat) {
    setMessageDialog({ open: true, chat });
    setIsMessagesLoading(true);
    setMessages([]);

    try {
      const response = await fetch(`/api/admin/chats/${chat.id}/messages`);
      if (!response.ok) {
        throw new Error("Failed to fetch messages");
      }

      const data = (await response.json()) as { messages: AdminMessage[] };
      setMessages(data.messages ?? []);
    } catch (fetchError) {
      console.error("Failed to fetch chat messages:", fetchError);
      toast.error("Failed to load chat messages");
    } finally {
      setIsMessagesLoading(false);
    }
  }

  const columns = [
    {
      key: "title",
      header: "Title",
      render: (chat: Chat) => (
        <span className="font-medium truncate max-w-50 block">
          {chat.title}
        </span>
      ),
    },
    {
      key: "userName",
      header: "User",
      render: (chat: Chat) => (
        <div>
          <p className="text-sm font-medium">{chat.userName}</p>
          <p className="text-xs text-muted-foreground">{chat.userEmail}</p>
        </div>
      ),
    },
    {
      key: "messageCount",
      header: "Messages",
    },
    {
      key: "createdAt",
      header: "Created",
      render: (chat: Chat) => new Date(chat.createdAt).toLocaleDateString(),
    },
    {
      key: "actions",
      header: "",
      render: (chat: Chat) => (
        <div className="flex items-center gap-2">
          <Button
            onClick={() => handleViewMessages(chat)}
            size="icon"
            variant="ghost"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Chats</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            View and manage all conversations
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats..."
            value={searchQuery}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={chats}
        emptyMessage="No chats found"
        isLoading={isLoading}
      />

      {(data?.total ?? 0) > pagination.limit && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground text-center sm:text-left">
            Page {Math.floor(pagination.offset / pagination.limit) + 1} of{" "}
            {Math.max(
              1,
              Math.ceil((data?.total ?? 0) / pagination.limit)
            )}
          </p>
          <div className="flex gap-2 justify-center sm:justify-end">
            <Button
              disabled={pagination.offset === 0}
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  offset: Math.max(0, prev.offset - prev.limit),
                }))
              }
              size="sm"
              variant="outline"
            >
              Previous
            </Button>
            <Button
              disabled={
                pagination.offset + pagination.limit >= (data?.total ?? 0)
              }
              onClick={() =>
                setPagination((prev) => ({
                  ...prev,
                  offset: prev.offset + prev.limit,
                }))
              }
              size="sm"
              variant="outline"
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setMessageDialog({ open: false, chat: null });
            setMessages([]);
            setIsMessagesLoading(false);
          }
        }}
        open={messageDialog.open}
      >
        <DialogContent className="h-[90vh] w-[95vw] max-w-[95vw] flex flex-col p-0 gap-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>Chat Messages</DialogTitle>
            <DialogDescription>
              {messageDialog.chat?.title ?? "Untitled Chat"} •{" "}
              {messageDialog.chat?.userName ?? "Unknown user"}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-6 pt-0">
            {isMessagesLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, index) => (
                  <div
                    className="h-10 w-full animate-pulse rounded bg-muted"
                    key={index}
                  />
                ))}
              </div>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No messages found for this chat.
              </p>
            ) : (
              messages.map((msg) => {
                const messageText = extractMessageText(msg.parts);
                const displayText =
                  messageText.length > 0
                    ? messageText
                    : "[Non-text content]";

                return (
                  <Message
                    className="max-w-full mb-4"
                    from={msg.role as "user" | "assistant"}
                    key={msg.id}
                  >
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      <span className="uppercase tracking-wide">{msg.role}</span>
                      <span>{new Date(msg.createdAt).toLocaleString()}</span>
                    </div>
                    <MessageContent>
                      <MessageResponse>{displayText}</MessageResponse>
                    </MessageContent>
                  </Message>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
