import { generateEmbedding } from "@/lib/gemini";
import { memoryIndex, type MemoryMetadata } from "@/lib/pinecone";
import type { ScoredPineconeRecord } from "@pinecone-database/pinecone";

// ─── Constants ────────────────────────────────────────────────────────────────

/** How many past messages to retrieve when searching for context. */
const TOP_K = 5;

/** Minimum similarity score (cosine) to include a result as context. */
const SCORE_THRESHOLD = 0.65;

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
  console.log(`[memory] >>> searchMemories called <<<`);
  console.log(`[memory] Query: "${query}"`);
  console.log(`[memory] Session ID (Retrieval): "${sessionId}"`);
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

    console.log(`[memory] Querying Pinecone index... Options:`, JSON.stringify({ ...queryOptions, vector: `[Vector length ${embedding.length}]` }, null, 2));
    const results = await memoryIndex.query(queryOptions);
    console.log(`[memory] Pinecone query returned ${results.matches?.length || 0} matches`);

    if (results.matches && results.matches.length > 0) {
      results.matches.forEach((match, index) => {
        const meta = match.metadata;
        console.log(`[memory] Match #${index + 1}:`);
        console.log(`  ID: ${match.id}`);
        console.log(`  Score: ${match.score}`);
        console.log(`  Role: ${meta?.role}`);
        console.log(`  Session ID: ${meta?.sessionId}`);
        console.log(`  Content: "${meta?.content}"`);
      });
    }

    const relevant = (
      results.matches as ScoredPineconeRecord<MemoryMetadata>[]
    ).filter((match) => {
      const isRelevant = match.score !== undefined && match.score >= SCORE_THRESHOLD && match.metadata;
      if (!isRelevant) {
        console.log(`[memory] Discarding match ${match.id} (Score ${match.score} < Threshold ${SCORE_THRESHOLD} or missing metadata)`);
      } else {
        console.log(`[memory] Retaining match ${match.id} (Score ${match.score} >= Threshold ${SCORE_THRESHOLD})`);
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
  console.log(`[memory] >>> saveMemory called <<<`);
  console.log(`[memory] User Message: "${userMessage}"`);
  console.log(`[memory] Assistant Message: "${assistantMessage}"`);
  console.log(`[memory] Session ID (Save): "${sessionId}"`);
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

    console.log(`[memory] Upserting to Pinecone for session: "${sessionId}"`);
    console.log(`  User Record ID: ${userRecord.id}`);
    console.log(`  Assistant Record ID: ${assistantRecord.id}`);

    await memoryIndex.upsert({ records: [userRecord, assistantRecord] });
    console.log(`[memory] Pinecone upsert successful for IDs: ${userRecord.id}, ${assistantRecord.id}`);
  } catch (error) {
    console.error("[memory] saveMemory failed:", error);
  }
}
