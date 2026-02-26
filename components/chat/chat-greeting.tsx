"use client";

import Image from "next/image";

export type ChatGreetingProps = {
  title?: string;
  subtitle?: string;
  className?: string;
};

export function ChatGreeting({
  title = "Hello there!",
  subtitle = "How can I help you today?",
  className,
}: ChatGreetingProps) {
  return (
    <div className={className}>
      <div className="mb-4 flex h-16 w-16 items-center justify-center">
        <Image src="/stethoscope.svg" alt="Stethoscope" width={48} height={48} className="h-12 w-12" />
      </div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{subtitle}</p>
    </div>
  );
}
