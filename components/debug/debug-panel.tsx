"use client";

import { useState } from "react";

const isDebug =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("debug") === "1"
    : false;

export function useDebugMode(): boolean {
  return isDebug;
}

type DebugPanelProps = {
  title?: string;
  entries: Record<string, string | number | boolean | null | undefined>;
};

export function DebugPanel({ title = "Debug", entries }: DebugPanelProps) {
  const [open, setOpen] = useState(false);

  if (!isDebug) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-muted/95 backdrop-blur text-xs font-mono">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-3 py-1.5 text-left text-muted-foreground hover:text-foreground flex items-center justify-between"
      >
        <span>{title} (click to {open ? "collapse" : "expand"})</span>
        <span className="text-[10px]">?debug=1</span>
      </button>
      {open && (
        <div className="px-3 py-2 space-y-1 max-h-48 overflow-y-auto border-t">
          {Object.entries(entries).map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <span className="text-muted-foreground shrink-0">{key}:</span>
              <span className="break-all">
                {value === undefined
                  ? "undefined"
                  : value === null
                    ? "null"
                    : String(value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
