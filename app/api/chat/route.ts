import { generateChatResponse } from "@/lib/gemini";
import { searchMemories, saveMemory } from "@/lib/memory";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatRequestBody {
  message: string;
  /** Optional session ID to scope memory retrieval to one conversation thread. */
  sessionId?: string;
}

interface ChatSuccessResponse {
  reply: string;
}

interface ChatErrorResponse {
  error: string;
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(memoryContext: string): string {
  const base = `You are ChatWithMe, a helpful and friendly AI assistant with persistent memory.
You remember past conversations and use that context to give more relevant, personalised responses.
Be concise, clear, and conversational. Use markdown formatting when helpful (code blocks, lists, etc).`;

  if (!memoryContext) return base;

  return `${base}

${memoryContext}

Use the above history only when it is directly relevant to the current message. Do not force references to past topics.`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(
  request: Request
): Promise<Response> {
  // ── 1. Parse & validate request body ──────────────────────────────────────
  let body: ChatRequestBody;

  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON in request body." } satisfies ChatErrorResponse,
      { status: 400 }
    );
  }

  const { message, sessionId } = body;

  if (!message || typeof message !== "string" || message.trim() === "") {
    return Response.json(
      { error: "\"message\" must be a non-empty string." } satisfies ChatErrorResponse,
      { status: 400 }
    );
  }

  const trimmedMessage = message.trim();

  // ── 2. Retrieve relevant memories from Pinecone ───────────────────────────
  const memoryContext = await searchMemories(trimmedMessage, sessionId);

  // ── 3. Build system prompt & generate Gemini response ─────────────────────
  let reply: string;

  try {
    const systemPrompt = buildSystemPrompt(memoryContext);
    reply = await generateChatResponse(trimmedMessage, systemPrompt);
  } catch (error) {
    console.error("[api/chat] Gemini generation failed:", error);
    return Response.json(
      { error: "Failed to generate a response. Please try again." } satisfies ChatErrorResponse,
      { status: 502 }
    );
  }

  // ── 4. Persist this exchange to Pinecone (fire-and-forget) ────────────────
  // We do NOT await here — memory saving is best-effort and should never
  // block or fail the response the user is waiting for.
  saveMemory(trimmedMessage, reply, sessionId ?? "default").catch((err) => {
    console.error("[api/chat] saveMemory failed silently:", err);
  });

  // ── 5. Return reply ────────────────────────────────────────────────────────
  return Response.json(
    { reply } satisfies ChatSuccessResponse,
    { status: 200 }
  );
}
