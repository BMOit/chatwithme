import { generateEmbedding } from "@/lib/gemini";
import { memoryIndex, type MemoryMetadata } from "@/lib/pinecone";
import type { ScoredPineconeRecord } from "@pinecone-database/pinecone";

// ─── Constants ────────────────────────────────────────────────────────────────

/** How many past messages to retrieve when searching for context. */
const TOP_K = 5;

/** Minimum similarity score (cosine) to include a result as context. */
const SCORE_THRESHOLD = 0.75;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemorySearchResult {
  role: string;
  content: string;
  score: number;
}

// ─── searchMemories ───────────────────────────────────────────────────────────

/**
 * Embeds `query` and retrieves the most semantically similar past messages
 * from Pinecone. Returns them formatted as a context string ready to inject
 * into Gemini's system prompt.
 *
 * @param query       - The current user message to match against memory.
 * @param sessionId   - Optional session scope. When provided, only memories
 *                      from that session are considered.
 * @returns A formatted context string, or an empty string if nothing relevant
 *          was found.
 */
export async function searchMemories(
  query: string,
  sessionId?: string
): Promise<string> {
  try {
    const embedding = await generateEmbedding(query);

    const queryOptions = sessionId
      ? {
          vector: embedding,
          topK: TOP_K,
          includeMetadata: true,
          filter: { sessionId },
        }
      : {
          vector: embedding,
          topK: TOP_K,
          includeMetadata: true,
        };

    const results = await memoryIndex.query(queryOptions);

    const relevant = (
      results.matches as ScoredPineconeRecord<MemoryMetadata>[]
    ).filter(
      (match) =>
        match.score !== undefined &&
        match.score >= SCORE_THRESHOLD &&
        match.metadata
    );

    if (relevant.length === 0) return "";

    const formatted = relevant
      .map((match) => {
        const { role, content } = match.metadata!;
        return `${role === "user" ? "User" : "Assistant"}: ${content}`;
      })
      .join("\n");

    return `Relevant conversation history:\n${formatted}`;
  } catch (error) {
    // Memory retrieval failure is non-fatal — continue without context.
    console.error("[memory] searchMemories failed:", error);
    return "";
  }
}

// ─── saveMemory ───────────────────────────────────────────────────────────────

/**
 * Embeds both the user message and the assistant reply, then upserts them
 * into Pinecone as two separate records in a single batch call.
 *
 * Records are keyed by a timestamp-based ID, so re-runs never overwrite
 * existing memories.
 *
 * @param userMessage       - The raw user message text.
 * @param assistantMessage  - The assistant's reply text.
 * @param sessionId         - Optional session identifier stored as metadata.
 */
export async function saveMemory(
  userMessage: string,
  assistantMessage: string,
  sessionId = "default"
): Promise<void> {
  try {
    const now = Date.now();

    // Embed both messages in parallel to minimise latency.
    const [userEmbedding, assistantEmbedding] = await Promise.all([
      generateEmbedding(userMessage),
      generateEmbedding(assistantMessage),
    ]);

    const userRecord = {
      id: `mem-user-${now}`,
      values: userEmbedding,
      metadata: {
        role: "user",
        content: userMessage,
        timestamp: now,
        sessionId,
      } satisfies MemoryMetadata,
    };

    const assistantRecord = {
      id: `mem-assistant-${now + 1}`,
      values: assistantEmbedding,
      metadata: {
        role: "assistant",
        content: assistantMessage,
        timestamp: now + 1,
        sessionId,
      } satisfies MemoryMetadata,
    };

    await memoryIndex.upsert({ records: [userRecord, assistantRecord] });
  } catch (error) {
    // Memory persistence failure is non-fatal — the user still gets a reply.
    console.error("[memory] saveMemory failed:", error);
  }
}
