"use client";

import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputFooter,
  PromptInputHeader,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { SpeechInput } from "@/components/ai-elements/speech-input";
import { Spinner } from "@/components/ui/spinner";
import { ChatModeSelector, type ChatMode } from "@/components/chat/chat-mode-selector";
import { useS3MultiFileUpload } from "@/hooks/useS3MultiFileUpload";
import type { ChatStatus } from "ai";
import type { ChangeEvent } from "react";
import { useMemo, useEffect, useCallback } from "react";
import { toast } from "sonner";

export type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (message: PromptInputMessage) => void;
  onTranscription?: (transcription: string) => void;
  placeholder?: string;
  status?: ChatStatus;
  disabled?: boolean;
  className?: string;
  clearOnSubmit?: boolean;
  chatMode?: ChatMode;
  onChatModeChange?: (mode: ChatMode) => void;
};

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onTranscription,
  placeholder = "Message Ask Linda...",
  status = "ready",
  disabled = false,
  className,
  clearOnSubmit = true,
  chatMode = "internal",
  onChatModeChange,
}: ChatInputProps) {
  const maxUploadSizeMB = 10;
  const maxUploadFiles = 5;
  const allowedUploadTypes = [
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  const { handleFileSelect, files: uploadFiles, removeFile } = useS3MultiFileUpload({
    maxSizeMB: maxUploadSizeMB,
    allowedTypes: allowedUploadTypes,
    maxFiles: maxUploadFiles,
  });

  // Create a map of file names to upload state and index
  const uploadingFiles = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const file of uploadFiles) {
      map.set(file.name, file.isUploading ?? false);
    }
    return map;
  }, [uploadFiles]);

  const handleTranscription = (transcription: string) => {
    onTranscription?.(transcription);
  };

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  const isDisabled = disabled || !value.trim() || status === "streaming" || uploadFiles.some((f) => f.isUploading);

  const handleFilesAdded = useCallback((files: File[]) => {
    for (const file of files) {
      void handleFileSelect(file);
    }
  }, [handleFileSelect]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file") {
          const file = items[i].getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        handleFilesAdded(files);
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [handleFilesAdded]);

  const handleRemoveAttachment = (_id: string, filename?: string) => {
    if (!filename) return;
    const index = uploadFiles.findIndex((f) => f.name === filename);
    if (index !== -1) {
      void removeFile(index);
    }
  };

  const handleSubmitMessage = (message: PromptInputMessage) => {
    const isAnyUploading = uploadFiles.some((f) => f.isUploading);
    if (isAnyUploading) {
      toast.error("Please wait for file uploads to finish");
      return;
    }

    const filesWithS3Urls = message.files.map((file) => {
      const filename = file.filename ?? "";
      const uploaded = uploadFiles.find((f) => f.name === filename);
      if (!uploaded?.url) {
        return null;
      }
      return {
        ...file,
        url: uploaded.url,
      };
    });

    if (message.files.length > 0 && filesWithS3Urls.some((f) => f === null)) {
      toast.error("One or more files are not uploaded yet");
      return;
    }

    onSubmit({
      text: message.text,
      files: filesWithS3Urls.filter((f) => f !== null),
    });
  };

  return (
    <PromptInput
      className={className}
      accept={allowedUploadTypes.join(",")}
      globalDrop
      maxFileSize={maxUploadSizeMB * 1024 * 1024}
      maxFiles={maxUploadFiles}
      multiple
      clearOnSubmit={clearOnSubmit}
      onError={(err) => {
        toast.error(err.message);
      }}
      onFilesAdded={handleFilesAdded}
      onSubmit={handleSubmitMessage}
    >
      <PromptInputHeader>
        <PromptInputAttachments>
          {(attachment) => {
            const isUploading = attachment.filename ? uploadingFiles.get(attachment.filename) ?? false : false;
            return (
              <PromptInputAttachment 
                data={attachment}
                onRemove={handleRemoveAttachment}
              >
                {isUploading && (
                  <Spinner className="size-4" />
                )}
              </PromptInputAttachment>
            );
          }}
        </PromptInputAttachments>
      </PromptInputHeader>
      <PromptInputBody>
        <PromptInputTextarea
          className="min-h-12 py-0"
          onChange={handleTextChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && uploadFiles.some((f) => f.isUploading)) {
              e.preventDefault();
            }
          }}
          placeholder={placeholder}
          value={value}
        />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputTools>
          <PromptInputActionMenu>
            <PromptInputActionMenuTrigger />
            <PromptInputActionMenuContent>
              <PromptInputActionAddAttachments />
            </PromptInputActionMenuContent>
          </PromptInputActionMenu>
          {onChatModeChange && (
            <ChatModeSelector
              value={chatMode}
              onChange={onChatModeChange}
              disabled={status === "streaming"}
            />
          )}
        </PromptInputTools>
        <div className="flex items-center gap-1">
          <SpeechInput
            onTranscriptionChange={handleTranscription}
            size="icon-sm"
            variant="ghost"
          />
          <PromptInputSubmit disabled={isDisabled} status={status} />
        </div>
      </PromptInputFooter>
    </PromptInput>
  );
}
