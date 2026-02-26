"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Building2, Globe, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChatMode = "internal" | "general";

const chatModes = [
  {
    value: "internal" as const,
    label: "Internal Knowledge",
    description: "Search organization's knowledge base first",
    icon: Building2,
  },
  {
    value: "general" as const,
    label: "General Assistant",
    description: "Use general AI knowledge directly",
    icon: Globe,
  },
];

type ChatModeSelectorProps = {
  value: ChatMode;
  onChange: (mode: ChatMode) => void;
  disabled?: boolean;
  className?: string;
};

export function ChatModeSelector({
  value,
  onChange,
  disabled = false,
  className,
}: ChatModeSelectorProps) {
  const selectedMode = chatModes.find((m) => m.value === value) ?? chatModes[0];
  const Icon = selectedMode.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            "gap-1.5 text-muted-foreground hover:text-foreground font-medium",
            className
          )}
        >
          <Icon className="size-4" />
          <span className="hidden sm:inline text-xs">{selectedMode.label}</span>
          <ChevronDown className="size-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {chatModes.map((mode) => (
          <DropdownMenuItem
            key={mode.value}
            onSelect={() => onChange(mode.value)}
            className="flex items-start gap-3 py-2.5"
          >
            <mode.icon className="size-4 mt-0.5 shrink-0" />
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium">{mode.label}</span>
              <span className="text-xs text-muted-foreground">
                {mode.description}
              </span>
            </div>
            {value === mode.value && (
              <Check className="size-4 ml-auto shrink-0 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
