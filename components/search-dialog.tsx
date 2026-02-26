"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { nanoid } from "nanoid";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { MessageSquareIcon, SearchIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";

interface SearchResult {
  chats: Array<{
    id: string;
    title: string;
    createdAt: Date;
  }>;
  messages: Array<{
    messageId: string;
    chatId: string;
    chatTitle: string;
    role: string;
    parts: unknown;
    createdAt: Date;
  }>;
  query: string;
}

function highlightText(text: string, query: string) {
  if (!query) return text;
  
  const parts = text.split(new RegExp(`(${query})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/50">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

function getTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter(
      (p): p is { type: "text"; text: string } =>
        typeof p === "object" && p !== null && p.type === "text"
    )
    .map((p) => p.text)
    .join(" ");
}

function getMatchedSnippet(text: string, query: string, contextLength = 60): string {
  if (!query || text.length <= contextLength * 2) return text;
  
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerQuery);
  
  if (matchIndex === -1) return text.slice(0, contextLength * 2) + "...";
  
  // Calculate snippet boundaries around the match
  const start = Math.max(0, matchIndex - contextLength);
  const end = Math.min(text.length, matchIndex + query.length + contextLength);
  
  let snippet = text.slice(start, end);
  
  // Add ellipsis
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";
  
  return snippet;
}

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
      setSearchResults(null);
      setIsLoading(false);
    }
  }, [open]);

  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery || searchQuery.trim().length < 2) {
        setSearchResults(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setSearchResults(null); // Clear previous results immediately
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(searchQuery)}`
        );
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data);
        } else {
          setSearchResults(null);
        }
      } catch (error) {
        console.error("Search error:", error);
        toast.error("Failed to search");
        setSearchResults(null);
      } finally {
        setIsLoading(false);
      }
    };

    const debounce = setTimeout(performSearch, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  const handleNewChat = () => {
    const chatId = nanoid();
    router.push(`/c/${chatId}`);
    onOpenChange(false);
    setSearchQuery("");
  };

  const handleChatSelect = (chatId: string) => {
    router.push(`/c/${chatId}`);
    onOpenChange(false);
    setSearchQuery("");
  };

  const handleMessageSelect = (chatId: string, messageId: string) => {
    router.push(`/c/${chatId}#${messageId}`);
    onOpenChange(false);
    setSearchQuery("");
  };

  return (
    <CommandDialog className="md:max-w-[700px]" onOpenChange={onOpenChange} open={open}>
      <Command className="rounded-lg border shadow-md" shouldFilter={false}>
        <CommandInput
          onValueChange={setSearchQuery}
          placeholder="Search chats and messages..."
          value={searchQuery}
        />
        <CommandList className="min-h-96 max-h-125">
          {!searchQuery && (
            <>
              <CommandGroup heading="Actions">
                <CommandItem onSelect={handleNewChat}>
                  <PlusIcon className="mr-2 size-4" />
                  <span>New Chat</span>
                </CommandItem>
              </CommandGroup>
              <CommandEmpty>
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <SearchIcon className="mb-4 size-12 text-muted-foreground/40" />
                  <p className="text-muted-foreground text-sm">
                    Start typing to search through your chats and messages
                  </p>
                </div>
              </CommandEmpty>
            </>
          )}

          {searchQuery && !searchResults && isLoading && (
            <CommandEmpty>
              <div className="flex flex-col items-center justify-center py-8">
                <div className="mb-4 size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-muted-foreground text-sm">Searching...</p>
              </div>
            </CommandEmpty>
          )}

          {searchQuery &&
            searchResults &&
            searchResults.chats.length === 0 &&
            searchResults.messages.length === 0 && (
              <CommandEmpty>
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <SearchIcon className="mb-4 size-12 text-muted-foreground/40" />
                  <p className="mb-2 font-medium">No results found</p>
                  <p className="text-muted-foreground text-sm">
                    Try searching with different keywords
                  </p>
                </div>
              </CommandEmpty>
            )}

          {searchResults && searchResults.chats.length > 0 && (
            <>
              {!searchQuery && <CommandSeparator />}
              <CommandGroup heading="Chats">
                {searchResults.chats.map((chat) => (
                  <CommandItem
                    key={chat.id}
                    onSelect={() => handleChatSelect(chat.id)}
                  >
                    <MessageSquareIcon className="mr-2 size-4" />
                    <span>
                      {highlightText(chat.title, searchResults.query)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {searchResults && searchResults.messages.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Messages">
                {searchResults.messages.map((msg) => {
                  const text = getTextFromParts(msg.parts);
                  const snippet = getMatchedSnippet(text, searchResults.query);

                  return (
                    <CommandItem
                      key={msg.messageId}
                      onSelect={() =>
                        handleMessageSelect(msg.chatId, msg.messageId)
                      }
                    >
                      <SearchIcon className="mr-2 size-4" />
                      <div className="flex flex-col gap-1">
                        <span className="text-muted-foreground text-xs">
                          {msg.chatTitle}
                        </span>
                        <span className="text-sm">
                          {highlightText(snippet, searchResults.query)}
                        </span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
