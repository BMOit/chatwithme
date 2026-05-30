"use client";

import { useState, useCallback, useId } from "react";
import ChatWindow from "@/components/chat-window";
import ChatInput from "@/components/chat-input";
import { type Message } from "@/components/message";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiSuccessResponse {
  reply: string;
}

interface ApiErrorResponse {
  error: string;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stable session ID for the lifetime of this page — scopes Pinecone memory
  // to this browser tab without requiring auth.
  const sessionId = useId();

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    // Optimistically append user message
    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
      });

      if (!res.ok) {
        const data: ApiErrorResponse = await res.json().catch(() => ({
          error: `Server error (${res.status})`,
        }));
        throw new Error(data.error ?? `Unexpected error (${res.status})`);
      }

      const data: ApiSuccessResponse = await res.json();

      const assistantMessage: Message = {
        id: `msg-${Date.now()}-assistant`,
        role: "assistant",
        content: data.reply,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setError(message);

      // Append a visible error bubble so the user doesn't see a silent failure
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-error`,
          role: "assistant",
          content: `⚠️ ${message}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, sessionId]);

  return (
    <div
      className="flex flex-col h-screen w-full"
      style={{ background: "var(--chat-bg)" }}
    >
      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{
          background: "var(--chat-surface)",
          borderBottom: "1px solid var(--chat-border)",
        }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: "var(--user-bubble)" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="white"
              className="w-4 h-4"
            >
              <path
                fillRule="evenodd"
                d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <span className="font-semibold text-[var(--text-primary)] text-sm">
            ChatWithMe
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: "var(--user-bubble)" }}
          />
          <span className="text-xs text-[var(--text-secondary)]">
            Memory active
          </span>
        </div>
      </header>

      {/* ── Message area ── */}
      <ChatWindow messages={messages} isLoading={isLoading} />

      {/* ── Error banner (non-fatal, above input) ── */}
      {error && (
        <div
          className="mx-auto mb-2 max-w-3xl w-full px-4"
          role="alert"
        >
          <p className="rounded-xl px-4 py-2 text-xs text-red-400 text-center"
            style={{ background: "#2d1515", border: "1px solid #7f1d1d" }}>
            {error}
          </p>
        </div>
      )}

      {/* ── Input ── */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        disabled={isLoading}
      />
    </div>
  );
}
