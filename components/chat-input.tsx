"use client";

import { useRef, useEffect, type KeyboardEvent } from "react";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea up to a max height
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [value]);

  const canSend = !disabled && value.trim().length > 0;

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  }

  function handleSendClick() {
    if (canSend) onSend();
  }

  return (
    <div
      className="w-full px-4 pb-6 pt-3"
      style={{ background: "var(--chat-bg)" }}
    >
      <div
        className="relative mx-auto max-w-3xl flex items-end gap-2 rounded-2xl px-4 py-3 shadow-lg"
        style={{
          background: "var(--chat-input-bg)",
          border: "1px solid var(--chat-border)",
        }}
      >
        <textarea
          ref={textareaRef}
          id="chat-input"
          rows={1}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="Message ChatWithMe…"
          className="flex-1 resize-none bg-transparent text-sm outline-none placeholder-zinc-500 text-[var(--text-primary)] leading-relaxed"
          style={{ minHeight: "24px", maxHeight: "180px" }}
          aria-label="Chat message input"
          autoComplete="off"
        />

        {/* Send button */}
        <button
          type="button"
          onClick={handleSendClick}
          id="chat-send-button"
          disabled={!canSend}
          aria-label="Send message"
          className="flex-shrink-0 mb-0.5 rounded-xl p-2 transition-all duration-150 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            background: canSend ? "var(--user-bubble)" : "var(--chat-border)",
          }}
        >
          {/* Send icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-4 h-4 text-white"
          >
            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
          </svg>
        </button>
      </div>

      <p className="mt-2 text-center text-xs text-zinc-600">
        Press <kbd className="font-mono">Enter</kbd> to send ·{" "}
        <kbd className="font-mono">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
