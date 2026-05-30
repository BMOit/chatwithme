"use client";

import { useEffect, useRef } from "react";
import MessageBubble, { type Message } from "@/components/message";

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex w-full justify-start gap-3 px-4 py-2">
      {/* Avatar */}
      <div className="flex-shrink-0 mt-1">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
          style={{ background: "var(--user-bubble)" }}
        >
          AI
        </div>
      </div>

      {/* Dots */}
      <div
        className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm"
        style={{
          background: "var(--asst-bubble)",
          border: "1px solid var(--chat-border)",
        }}
        aria-label="Assistant is typing"
      >
        <span className="dot-bounce">
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center select-none">
      {/* Logo mark */}
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg"
        style={{ background: "var(--user-bubble)" }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="white"
          className="w-8 h-8"
        >
          <path
            fillRule="evenodd"
            d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      <div>
        <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
          ChatWithMe
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          An AI assistant that remembers your conversations.
        </p>
      </div>

      {/* Suggestion chips */}
      <div className="mt-4 flex flex-wrap justify-center gap-2 max-w-md">
        {[
          "What can you help me with?",
          "Tell me something interesting",
          "How does your memory work?",
        ].map((suggestion) => (
          <span
            key={suggestion}
            className="rounded-full px-4 py-2 text-xs text-[var(--text-secondary)] cursor-default"
            style={{ border: "1px solid var(--chat-border)", background: "var(--chat-surface)" }}
          >
            {suggestion}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── ChatWindow ───────────────────────────────────────────────────────────────

interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
}

export default function ChatWindow({ messages, isLoading }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const isEmpty = messages.length === 0 && !isLoading;

  return (
    <div
      className="flex flex-1 flex-col overflow-y-auto"
      style={{ background: "var(--chat-bg)" }}
      aria-live="polite"
      aria-label="Chat messages"
    >
      {isEmpty ? (
        <EmptyState />
      ) : (
        <div className="mx-auto w-full max-w-3xl py-4">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  );
}
