"use client";

import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";

export function ImpersonationBanner() {
  const { data: session } = authClient.useSession();
  const [isMinimized, setIsMinimized] = useState(false);

  // Check if session has impersonatedBy field (indicates impersonation)
  const sessionData = session?.session as { impersonatedBy?: string } | undefined;
  const isImpersonating = Boolean(sessionData?.impersonatedBy);

  if (!isImpersonating) {
    return null;
  }

  async function handleStopImpersonating() {
    try {
      const response = await authClient.admin.stopImpersonating();

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast.success("Stopped impersonating. Returning to admin account...");
      window.location.href = "/admin/users";
    } catch {
      toast.error("Failed to stop impersonating");
    }
  }

  return (
    <div className="fixed right-4 top-12 z-50">
      {isMinimized ? (
        <div className="flex items-center gap-2 rounded-full border border-amber-600 bg-amber-500 px-3 py-2 text-amber-950 shadow-lg">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs font-semibold">Impersonating</span>
          <Button
            aria-label="Maximize impersonation panel"
            className="h-6 w-6 p-0 text-amber-950 hover:bg-amber-400"
            onClick={() => setIsMinimized(false)}
            size="icon"
            variant="ghost"
          >
            <ChevronDown className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="min-w-70 max-w-90 rounded-lg border border-amber-600 bg-amber-500 text-amber-950 shadow-lg">
          <div className="flex items-center justify-between border-b border-amber-600 px-3 py-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-semibold">Impersonating</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                aria-label="Minimize impersonation panel"
                className="h-6 w-6 p-0 text-amber-950 hover:bg-amber-400"
                onClick={() => setIsMinimized(true)}
                size="icon"
                variant="ghost"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                aria-label="Dismiss panel"
                className="h-6 w-6 p-0 text-amber-950 hover:bg-amber-400"
                onClick={() => setIsMinimized(true)}
                size="icon"
                variant="ghost"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="space-y-3 px-3 py-3">
            <p className="text-sm">
              You are impersonating <strong>{session?.user?.email}</strong>.
            </p>
            <Button
              className="w-full bg-amber-950 text-amber-500 hover:bg-amber-900"
              onClick={handleStopImpersonating}
              size="sm"
            >
              Stop Impersonating
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
