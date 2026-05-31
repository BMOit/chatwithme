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
  console.log(`[api/chat] memoryContext length: ${memoryContext.length} chars`);
  if (memoryContext) {
    console.log(`[api/chat] Memory context injected:\n${memoryContext}`);
  } else {
    console.log(`[api/chat] No memory context — running without history.`);
  }

  // ── 3. Build system prompt & generate Gemini response ─────────────────────
  let reply: string;

  try {
    const systemPrompt = buildSystemPrompt(memoryContext);
    console.log(`[api/chat] System prompt sent to Gemini (first 300 chars):\n${systemPrompt.slice(0, 300)}...`);
    reply = await generateChatResponse(trimmedMessage, systemPrompt);
  } catch (error: any) {
    console.error("[api/chat] Gemini generation failed:", error);
    
    // Default fallback message
    let errorMessage = "Failed to generate a response. Please try again.";
    
    // Check if it's a structural Google API error and extract details
    if (error?.message) {
      if (error.message.includes("429") || error.message.toLowerCase().includes("quota")) {
        errorMessage = "We're experiencing high demand right now (quota exceeded). Please try again in a few minutes, or upgrade your plan.";
      } else if (error.message.includes("404")) {
        errorMessage = "The selected AI model is currently unavailable or deprecated. Please contact support.";
      } else {
        errorMessage = "Our AI system is temporarily facing issues: " + (error.message.substring(0, 50) + "...");
      }
    }

    return Response.json(
      { error: errorMessage } satisfies ChatErrorResponse,
      { status: error?.status === 429 ? 429 : 502 }
    );
  }

  // ── 4. Persist this exchange to Pinecone ────────────────
  // We MUST await here because in Next.js Serverless/Edge functions,
  // returning the HTTP response instantly tears down the execution context,
  // killing any pending background promises.
  try {
    console.log("[api/chat] Awaiting saveMemory...");
    await saveMemory(trimmedMessage, reply, sessionId ?? "default");
    console.log("[api/chat] Successfully saved memory.");
  } catch (err) {
    console.error("[api/chat] saveMemory failed:", err);
  }

  // ── 5. Return reply ────────────────────────────────────────────────────────
  return Response.json(
    { reply } satisfies ChatSuccessResponse,
    { status: 200 }
  );
}
