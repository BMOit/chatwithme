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
  console.log(`[memory] searchMemories called for query: "${query}", sessionId: ${sessionId}`);
  try {
    const embedding = await generateEmbedding(query);
    console.log(`[memory] Generated embedding vector for query (length: ${embedding.length})`);

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
    console.log(`[memory] Pinecone query returned ${results.matches?.length || 0} matches`);

    const relevant = (
      results.matches as ScoredPineconeRecord<MemoryMetadata>[]
    ).filter((match) => {
      const isRelevant = match.score !== undefined && match.score >= SCORE_THRESHOLD && match.metadata;
      if (!isRelevant) {
        console.log(`[memory] Discarding match (score: ${match.score}, ID: ${match.id})`);
      }
      return isRelevant;
    });

    console.log(`[memory] Filtered down to ${relevant.length} relevant memories >= threshold (${SCORE_THRESHOLD})`);

    if (relevant.length === 0) return "";

    const formatted = relevant
      .map((match) => {
        const { role, content } = match.metadata!;
        return `${role === "user" ? "User" : "Assistant"}: ${content}`;
      })
      .join("\n");
      
    console.log(`[memory] Constructed system prompt context block: \n${formatted}`);

    return `Relevant conversation history:\n${formatted}`;
  } catch (error) {
    console.error("[memory] searchMemories failed:", error);
    return "";
  }
}

// ─── saveMemory ───────────────────────────────────────────────────────────────

/**
 * Embeds both the user message and the assistant reply, then upserts them
 * into Pinecone as two separate records in a single batch call.
 */
export async function saveMemory(
  userMessage: string,
  assistantMessage: string,
  sessionId = "default"
): Promise<void> {
  console.log(`[memory] saveMemory called (sessionId: ${sessionId})`);
  try {
    const now = Date.now();

    const [userEmbedding, assistantEmbedding] = await Promise.all([
      generateEmbedding(userMessage),
      generateEmbedding(assistantMessage),
    ]);
    
    console.log(`[memory] Generated embeddings for both messages.`);

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
    console.log(`[memory] Pinecone upsert successful for IDs: ${userRecord.id}, ${assistantRecord.id}`);
  } catch (error) {
    console.error("[memory] saveMemory failed:", error);
  }
}
