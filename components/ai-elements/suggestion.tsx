"use client";

import { Button } from "@/components/ui/button";
import {
  ScrollArea,
  ScrollBar,
} from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";

export type SuggestionsProps = ComponentProps<typeof ScrollArea>;

export const Suggestions = ({
  className,
  children,
  ...props
}: SuggestionsProps) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollPosition = () => {
    const element = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (element) {
      const { scrollLeft, scrollWidth, clientWidth } = element;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  const scrollLeft = () => {
    const element = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (element) {
      element.scrollBy({ left: -200, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    const element = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (element) {
      element.scrollBy({ left: 200, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const element = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (element) {
      element.addEventListener('scroll', checkScrollPosition);
      // Initial check
      checkScrollPosition();
      return () => element.removeEventListener('scroll', checkScrollPosition);
    }
  }, [children]);

  return (
    <div className="relative w-full">
      {canScrollLeft && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm shadow-sm"
          onClick={scrollLeft}
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
      )}
      <ScrollArea ref={scrollAreaRef} className="w-full overflow-x-auto whitespace-nowrap" {...props}>
        <div className={cn("flex w-max flex-nowrap items-center gap-2", className)}>
          {children}
        </div>
        <ScrollBar className="hidden" orientation="horizontal" />
      </ScrollArea>
      {canScrollRight && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-8 w-8 rounded-full bg-background/80 backdrop-blur-sm shadow-sm"
          onClick={scrollRight}
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

export const Suggestion = ({
  suggestion,
  onClick,
  className,
  variant = "outline",
  size = "sm",
  children,
  ...props
}: SuggestionProps) => {
  const handleClick = () => {
    onClick?.(suggestion);
  };

  return (
    <Button
      className={cn("cursor-pointer rounded-full px-4", className)}
      onClick={handleClick}
      size={size}
      type="button"
      variant={variant}
      {...props}
    >
      {children || suggestion}
    </Button>
  );
};
