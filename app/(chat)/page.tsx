"use client";

import { ChatGreeting, ChatInput } from "@/components/chat";
import type { ChatMode } from "@/components/chat/chat-mode-selector";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { TestTube, FileText, File, BookOpen, Lightbulb, Mail, X } from "lucide-react";
import { nanoid } from "nanoid";
import { useRouter } from "next/navigation";
import { useState } from "react";

const suggestions = [
  {
    text: "Interpret Results",
    icon: TestTube,
    color: "text-purple-500",
    expanded: [
      "Interpret lab results for patient X",
      "Analyze blood test results",
      "Explain MRI findings",
      "Review pathology report",
    ],
  },
  {
    text: "Medical Report",
    icon: FileText,
    color: "text-blue-500",
    expanded: [
      "Generate a medical report for patient Y",
      "Create discharge summary",
      "Write progress notes",
      "Prepare consultation report",
    ],
  },
  {
    text: "Pre-Auth Letter",
    icon: File,
    color: "text-green-500",
    expanded: [
      "Write a pre-authorization letter for procedure Z",
      "Draft insurance appeal letter",
      "Prepare prior authorization request",
      "Compose coverage determination letter",
    ],
  },
  {
    text: "Look Up Codes",
    icon: BookOpen,
    color: "text-orange-500",
    expanded: [
      "Look up ICD-10 codes for condition A",
      "Find CPT codes for procedure B",
      "Search for billing codes",
      "Identify diagnosis codes",
    ],
  },
  {
    text: "Treatment",
    icon: Lightbulb,
    color: "text-red-500",
    expanded: [
      "Suggest treatment options for symptom B",
      "Recommend medication for condition C",
      "Outline care plan",
      "Propose therapeutic interventions",
    ],
  },
  {
    text: "Reply to Email",
    icon: Mail,
    color: "text-indigo-500",
    expanded: [
      "Draft a reply to this patient email",
      "Compose response to colleague inquiry",
      "Write follow-up email to patient",
      "Prepare referral response",
    ],
  },
];

export default function HomePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [chatMode, setChatModeState] = useState<ChatMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chat-mode");
      if (saved === "internal" || saved === "general") return saved;
    }
    return "internal";
  });

  const setChatMode = (mode: ChatMode) => {
    setChatModeState(mode);
    localStorage.setItem("chat-mode", mode);
  };
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);

  // Filter suggestions based on input text
  const filteredSuggestions = text.trim().length >= 3
    ? suggestions
      .flatMap((category) => category.expanded)
      .filter((suggestion) =>
        suggestion.toLowerCase().includes(text.toLowerCase())
      )
    : [];

  const handleTranscription = (transcription: string) => {
    setText((prev) => prev + (prev ? " " : "") + transcription);
  };

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text.trim() && message.files.length === 0) {
      return;
    }

    const chatId = nanoid();

    // Pass the initial message (including file parts) to the chat page.
    // We can't safely put file URLs/metadata into the query string.
    sessionStorage.setItem(
      `pending-message:${chatId}`,
      JSON.stringify(message)
    );
    router.push(`/c/${chatId}`);
  };

  const handleSuggestionClick = (index: number) => {
    setExpandedCategory(index);
  };

  const handleExpandedSuggestionClick = (suggestionText: string) => {
    //   const chatId = nanoid();
    // router.push(`/c/${chatId}?query=${encodeURIComponent(suggestionText)}`);
    setText(suggestionText);
    setExpandedCategory(null);
  };

  const handleBack = () => {
    setExpandedCategory(null);
  };

  // Highlight matching text in suggestion
  const highlightMatch = (suggestion: string, query: string) => {
    if (!query) return suggestion;
    const index = suggestion.toLowerCase().indexOf(query.toLowerCase());
    if (index === -1) return suggestion;

    const before = suggestion.slice(0, index);
    const match = suggestion.slice(index, index + query.length);
    const after = suggestion.slice(index + query.length);

    return (
      <>
        {before}
        <span className="font-semibold text-foreground">{match}</span>
        <span className="text-muted-foreground">{after}</span>
      </>
    );
  };

  return (
    <div className="flex h-dvh flex-col">
      {/* Header with sidebar trigger */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
      </header>

      {/* Main content - centered */}
      <main className="flex flex-1 flex-col sm:items-center sm:justify-center px-4 pb-24 sm:pb-0 overflow-y-auto">
        <div className="flex w-full max-w-2xl flex-col items-center gap-8 py-8 sm:py-0">
          {/* Logo and greeting */}
          <ChatGreeting
            className="flex flex-col items-center text-center"
            subtitle=""
            title="How can I help you today?"
          />

          {/* Prompt input - shown here on desktop */}
          <div className="hidden sm:block w-full">
            <ChatInput
              chatMode={chatMode}
              onChatModeChange={setChatMode}
              clearOnSubmit={false}
              onChange={setText}
              onSubmit={handleSubmit}
              onTranscription={handleTranscription}
              placeholder="Type a clinical task, question, or paste an email..."
              value={text}
            />
          </div>

          {/* Suggestions */}
          <div className="w-full h-42.5 overflow-y-auto overflow-x-hidden">
            {/* Show filtered autocomplete when typing 3+ characters */}
            {text.trim().length >= 3 ? (
              <div className="space-y-1">
                {filteredSuggestions.map((item) => (
                  <button
                    key={item}
                    onClick={() => handleExpandedSuggestionClick(item)}
                    className="w-full text-left px-2 py-2 text-sm rounded-md hover:bg-accent transition-colors wrap-break-word"
                    type="button"
                  >
                    {highlightMatch(item, text)}
                  </button>
                ))}
              </div>
            ) : expandedCategory === null ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion.text}
                    onClick={() => handleSuggestionClick(index)}
                    className="flex items-center gap-3 rounded-full border bg-background px-4 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
                    type="button"
                  >
                    <suggestion.icon className={`size-5 shrink-0 ${suggestion.color}`} />
                    <span className="text-sm font-medium">{suggestion.text}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="relative pr-8">
                <button
                  onClick={handleBack}
                  className="absolute right-0 top-0 z-20 text-muted-foreground hover:text-foreground transition-colors"
                  type="button"
                >
                  <X className="size-4" />
                </button>
                <div className="space-y-1">
                  {suggestions[expandedCategory].expanded.map((item) => (
                    <button
                      key={item}
                      onClick={() => handleExpandedSuggestionClick(item)}
                      className="w-full text-left px-2 py-2 text-sm rounded-md hover:bg-accent transition-colors wrap-break-word pr-6"
                      type="button"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Prompt input - fixed at bottom on mobile, hidden on desktop (shown above suggestions) */}
      <div className="fixed bottom-0 left-0 right-0 sm:hidden border-t bg-background p-4">
        <div className="mx-auto w-full max-w-2xl">
          <ChatInput
            chatMode={chatMode}
            onChatModeChange={setChatMode}
            clearOnSubmit={false}
            onChange={setText}
            onSubmit={handleSubmit}
            onTranscription={handleTranscription}
            placeholder="Type a clinical task, question, or paste an email..."
            value={text}
          />
        </div>
      </div>

      {/* Footer - hidden on mobile */}
      <footer className="hidden sm:block shrink-0 py-4 text-center text-muted-foreground text-xs">
        Ask Linda can make mistakes. Consider checking important information.
      </footer>
    </div>
  );
}
