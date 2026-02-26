"use client";

import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "@/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { FileUIPart, UIMessage } from "ai";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FileArchiveIcon,
  FileAudioIcon,
  FileCode2Icon,
  FileIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileVideoIcon,
  XIcon,
} from "lucide-react";
import type { ComponentProps, HTMLAttributes, ReactElement } from "react";
import Image from "next/image";
import { createContext, memo, useContext, useEffect, useMemo, useState } from "react";
import { Streamdown } from "streamdown";
import useSWR from "swr";

const truncateFilename = (name: string, maxChars: number): string => {
  if (name.length <= maxChars) {
    return name;
  }

  const dotIndex = name.lastIndexOf(".");
  const hasExtension = dotIndex > 0 && dotIndex < name.length - 1;
  const extension = hasExtension ? name.slice(dotIndex) : "";
  const ellipsis = "...";

  if (extension && extension.length < maxChars - ellipsis.length) {
    const keep = Math.max(1, maxChars - ellipsis.length - extension.length);
    return `${name.slice(0, keep)}${ellipsis}${extension}`;
  }

  return `${name.slice(0, Math.max(1, maxChars - ellipsis.length))}${ellipsis}`;
};

const isS3ObjectUrl = (rawUrl: string): boolean => {
  try {
    const url = new URL(rawUrl);
    return url.hostname.includes("amazonaws.com");
  } catch {
    return false;
  }
};

const isAlreadySignedUrl = (rawUrl: string): boolean =>
  rawUrl.includes("X-Amz-Signature=") || rawUrl.includes("x-amz-signature=");

const presignFetcher = async (url: string): Promise<{ url: string }> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to presign URL");
  }
  const json = (await response.json()) as { url?: unknown };
  if (typeof json.url !== "string") {
    throw new Error("Invalid presign response");
  }
  return { url: json.url };
};

const getAttachmentIcon = (
  filename: string,
  mediaType?: string
): ReactElement => {
  if (mediaType?.startsWith("audio/")) return <FileAudioIcon className="size-5" />;
  if (mediaType?.startsWith("video/")) return <FileVideoIcon className="size-5" />;
  if (mediaType?.startsWith("image/")) return <FileImageIcon className="size-5" />;

  if (mediaType === "application/pdf") return <FileTextIcon className="size-5" />;
  if (mediaType === "text/csv") return <FileSpreadsheetIcon className="size-5" />;
  if (mediaType?.includes("spreadsheet")) return <FileSpreadsheetIcon className="size-5" />;
  if (mediaType?.includes("presentation")) return <FileTextIcon className="size-5" />;
  if (mediaType?.includes("zip") || mediaType?.includes("compressed")) {
    return <FileArchiveIcon className="size-5" />;
  }

  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["pdf", "doc", "docx", "rtf", "txt", "md"].includes(extension)) {
    return <FileTextIcon className="size-5" />;
  }
  if (["xls", "xlsx", "csv"].includes(extension)) {
    return <FileSpreadsheetIcon className="size-5" />;
  }
  if (["ppt", "pptx"].includes(extension)) {
    return <FileTextIcon className="size-5" />;
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(extension)) {
    return <FileArchiveIcon className="size-5" />;
  }
  if (
    [
      "js",
      "jsx",
      "ts",
      "tsx",
      "py",
      "rb",
      "go",
      "java",
      "c",
      "cpp",
      "cs",
      "php",
      "sql",
      "json",
      "yaml",
      "yml",
      "toml",
    ].includes(extension)
  ) {
    return <FileCode2Icon className="size-5" />;
  }

  return <FileIcon className="size-5" />;
};

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const Message = ({ className, from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full max-w-[95%] flex-col gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className
    )}
    {...props}
  />
);

export type MessageContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps) => (
  <div
    className={cn(
      "is-user:dark flex w-fit max-w-full min-w-0 flex-col gap-2 overflow-hidden",
      "group-[.is-user]:ml-auto group-[.is-user]:rounded-2xl group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground",
      "group-[.is-assistant]:text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageActionsProps = ComponentProps<"div">;

export const MessageActions = ({
  className,
  children,
  ...props
}: MessageActionsProps) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

export type MessageActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

export const MessageAction = ({
  tooltip,
  children,
  label,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: MessageActionProps) => {
  const button = (
    <Button size={size} type="button" variant={variant} {...props}>
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

type MessageBranchContextType = {
  currentBranch: number;
  totalBranches: number;
  goToPrevious: () => void;
  goToNext: () => void;
  branches: ReactElement[];
  setBranches: (branches: ReactElement[]) => void;
};

const MessageBranchContext = createContext<MessageBranchContextType | null>(
  null
);

const useMessageBranch = () => {
  const context = useContext(MessageBranchContext);

  if (!context) {
    throw new Error(
      "MessageBranch components must be used within MessageBranch"
    );
  }

  return context;
};

export type MessageBranchProps = HTMLAttributes<HTMLDivElement> & {
  defaultBranch?: number;
  onBranchChange?: (branchIndex: number) => void;
};

export const MessageBranch = ({
  defaultBranch = 0,
  onBranchChange,
  className,
  ...props
}: MessageBranchProps) => {
  const [currentBranch, setCurrentBranch] = useState(defaultBranch);
  const [branches, setBranches] = useState<ReactElement[]>([]);

  const handleBranchChange = (newBranch: number) => {
    setCurrentBranch(newBranch);
    onBranchChange?.(newBranch);
  };

  const goToPrevious = () => {
    const newBranch =
      currentBranch > 0 ? currentBranch - 1 : branches.length - 1;
    handleBranchChange(newBranch);
  };

  const goToNext = () => {
    const newBranch =
      currentBranch < branches.length - 1 ? currentBranch + 1 : 0;
    handleBranchChange(newBranch);
  };

  const contextValue: MessageBranchContextType = {
    currentBranch,
    totalBranches: branches.length,
    goToPrevious,
    goToNext,
    branches,
    setBranches,
  };

  return (
    <MessageBranchContext.Provider value={contextValue}>
      <div
        className={cn("grid w-full gap-2 [&>div]:pb-0", className)}
        {...props}
      />
    </MessageBranchContext.Provider>
  );
};

export type MessageBranchContentProps = HTMLAttributes<HTMLDivElement>;

export const MessageBranchContent = ({
  children,
  ...props
}: MessageBranchContentProps) => {
  const { currentBranch, setBranches, branches } = useMessageBranch();
  const childrenArray = useMemo(
    () => (Array.isArray(children) ? children : [children]),
    [children]
  );

  // Use useEffect to update branches when they change
  useEffect(() => {
    if (branches.length !== childrenArray.length) {
      setBranches(childrenArray);
    }
  }, [childrenArray, branches, setBranches]);

  return childrenArray.map((branch, index) => (
    <div
      className={cn(
        "grid gap-2 overflow-hidden [&>div]:pb-0",
        index === currentBranch ? "block" : "hidden"
      )}
      key={branch.key}
      {...props}
    >
      {branch}
    </div>
  ));
};

export type MessageBranchSelectorProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export const MessageBranchSelector = ({
  className,
  from,
  ...props
}: MessageBranchSelectorProps) => {
  const { totalBranches } = useMessageBranch();

  // Don't render if there's only one branch
  if (totalBranches <= 1) {
    return null;
  }

  return (
    <ButtonGroup
      className={cn(
        "[&>*:not(:first-child)]:rounded-l-md [&>*:not(:last-child)]:rounded-r-md",
        from === "user" ? "ml-auto" : "mr-auto",
        className
      )}
      orientation="horizontal"
      {...props}
    />
  );
};

export type MessageBranchPreviousProps = ComponentProps<typeof Button>;

export const MessageBranchPrevious = ({
  children,
  ...props
}: MessageBranchPreviousProps) => {
  const { goToPrevious, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label="Previous branch"
      disabled={totalBranches <= 1}
      onClick={goToPrevious}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronLeftIcon size={14} />}
    </Button>
  );
};

export type MessageBranchNextProps = ComponentProps<typeof Button>;

export const MessageBranchNext = ({
  children,
  className,
  ...props
}: MessageBranchNextProps) => {
  const { goToNext, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label="Next branch"
      className={className}
      disabled={totalBranches <= 1}
      onClick={goToNext}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronRightIcon size={14} />}
    </Button>
  );
};

export type MessageBranchPageProps = HTMLAttributes<HTMLSpanElement>;

export const MessageBranchPage = ({
  className,
  ...props
}: MessageBranchPageProps) => {
  const { currentBranch, totalBranches } = useMessageBranch();

  return (
    <ButtonGroupText
      className={cn(
        "border-none bg-transparent text-muted-foreground shadow-none",
        className
      )}
      {...props}
    >
      {currentBranch + 1} of {totalBranches}
    </ButtonGroupText>
  );
};

export type MessageResponseProps = ComponentProps<typeof Streamdown>;

export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn(
        "prose prose-slate dark:prose-invert max-w-none",
        "prose-p:leading-relaxed prose-p:my-2 prose-p:text-base",
        "prose-pre:my-3 prose-pre:rounded-lg",
        "prose-code:text-sm",
        "prose-ul:my-2 prose-ol:my-2",
        "prose-li:my-1",
        "prose-headings:font-semibold prose-headings:tracking-tight",
        "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

MessageResponse.displayName = "MessageResponse";

export type MessageAttachmentProps = HTMLAttributes<HTMLDivElement> & {
  data: FileUIPart;
  className?: string;
  onRemove?: () => void;
};

export function MessageAttachment({
  data,
  className,
  onRemove,
  ...props
}: MessageAttachmentProps) {
  const filename = data.filename || "";

  const shouldPresign = Boolean(
    data.url && isS3ObjectUrl(data.url) && !isAlreadySignedUrl(data.url)
  );

  const presignKey = useMemo(() => {
    if (!shouldPresign || !data.url) {
      return null;
    }
    return `/api/s3-presign?url=${encodeURIComponent(data.url)}`;
  }, [data.url, shouldPresign]);

  const { data: presigned, error: presignError } = useSWR(
    presignKey,
    presignFetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  const resolvedUrl = presignError ? data.url : (presigned?.url ?? data.url);

  const mediaType =
    data.mediaType?.startsWith("image/") && resolvedUrl ? "image" : "file";
  const isImage = mediaType === "image";
  const attachmentLabel = filename || (isImage ? "Image" : "Attachment");
  const truncatedLabel = filename
    ? truncateFilename(filename, 26)
    : attachmentLabel;
  const attachmentIcon = getAttachmentIcon(filename, data.mediaType);

  return (
    <div
      className={cn(
        "group w-24",
        className
      )}
      {...props}
    >
      <div className="group relative size-24 overflow-hidden rounded-lg">
        {isImage ? (
          <Image
            alt={filename || "attachment"}
            className="size-full object-cover"
            src={resolvedUrl}
            height={100}
            unoptimized
            width={100}
          />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                className="flex size-full shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                href={resolvedUrl}
                rel="noopener"
                target="_blank"
              >
                {attachmentIcon}
              </a>
            </TooltipTrigger>
            <TooltipContent>
              <p>{attachmentLabel}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {onRemove && (
          <Button
            aria-label="Remove attachment"
            className="absolute top-2 right-2 size-6 rounded-full bg-background/80 p-0 opacity-0 backdrop-blur-sm transition-opacity hover:bg-background group-hover:opacity-100 [&>svg]:size-3"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            type="button"
            variant="ghost"
          >
            <XIcon />
            <span className="sr-only">Remove</span>
          </Button>
        )}
      </div>

      <div className="mt-1 max-w-24">
        <p
          className="truncate text-muted-foreground text-xs"
          title={filename || undefined}
        >
          {truncatedLabel}
        </p>
      </div>
    </div>
  );
}

export type MessageAttachmentsProps = ComponentProps<"div">;

export function MessageAttachments({
  children,
  className,
  ...props
}: MessageAttachmentsProps) {
  if (!children) {
    return null;
  }

  return (
    <div
      className={cn(
        "ml-auto flex w-fit flex-wrap items-start gap-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export type MessageToolbarProps = ComponentProps<"div">;

export const MessageToolbar = ({
  className,
  children,
  ...props
}: MessageToolbarProps) => (
  <div
    className={cn(
      "mt-4 flex w-full items-center justify-between gap-4",
      className
    )}
    {...props}
  >
    {children}
  </div>
);
