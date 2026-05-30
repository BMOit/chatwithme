"use client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
}

interface MessageProps {
  message: Message;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Very lightweight renderer: wraps fenced code blocks in <pre><code>. */
function renderContent(text: string): React.ReactNode {
  const codeBlockRegex = /```([a-z]*)\n?([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={key++} className="whitespace-pre-wrap break-words">
          {text.slice(lastIndex, match.index)}
        </span>
      );
    }
    parts.push(
      <pre key={key++}>
        <code>{match[2].trim()}</code>
      </pre>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={key++} className="whitespace-pre-wrap break-words">
        {text.slice(lastIndex)}
      </span>
    );
  }

  return parts.length > 0 ? parts : <span className="whitespace-pre-wrap break-words">{text}</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MessageBubble({ message }: MessageProps) {
  const isUser = message.role === "user";

  return (
    <div
      className={`flex w-full gap-3 px-4 py-2 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {/* Avatar — assistant only */}
      {!isUser && (
        <div className="flex-shrink-0 mt-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: "var(--user-bubble)" }}
          >
            AI
          </div>
        </div>
      )}

      {/* Bubble */}
      <div
        className={`message-content max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
          isUser
            ? "rounded-br-sm text-white"
            : "rounded-bl-sm text-[var(--text-primary)]"
        }`}
        style={{
          background: isUser ? "var(--user-bubble)" : "var(--asst-bubble)",
          border: isUser ? "none" : "1px solid var(--chat-border)",
        }}
      >
        {renderContent(message.content)}
      </div>

      {/* Avatar — user only */}
      {isUser && (
        <div className="flex-shrink-0 mt-1">
          <div className="w-8 h-8 rounded-full flex items-center justify-center bg-zinc-600 text-white text-xs font-bold">
            U
          </div>
        </div>
      )}
    </div>
  );
}
