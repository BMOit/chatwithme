import { Pinecone, type Index } from "@pinecone-database/pinecone";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Metadata stored alongside every vector in Pinecone.
 * Keeping it flat so all fields can be used as metadata filters.
 */
export interface MemoryMetadata {
  [key: string]: string | number | boolean;

  role: string;
  content: string;
  timestamp: number;
  sessionId: string;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const apiKey = process.env.PINECONE_API_KEY;
const indexName = process.env.PINECONE_INDEX;

if (!apiKey) {
  throw new Error("PINECONE_API_KEY is not set in environment variables.");
}

if (!indexName) {
  throw new Error("PINECONE_INDEX is not set in environment variables.");
}

// ─── Singleton client ─────────────────────────────────────────────────────────

/**
 * Top-level Pinecone client.
 * The SDK constructor will also pick up PINECONE_API_KEY from env automatically,
 * but we pass it explicitly so the error above gives a clear message first.
 */
const pinecone = new Pinecone({ apiKey });

// ─── Typed Index ──────────────────────────────────────────────────────────────

/**
 * Pre-built Index instance targeting the project's memory index.
 * Typed with MemoryMetadata so TypeScript enforces metadata shape on upsert/query.
 *
 * Usage:
 *   import { memoryIndex } from "@/lib/pinecone";
 *   await memoryIndex.upsert({ records: [{ id, values, metadata }] });
 */
export const memoryIndex: Index<MemoryMetadata> =
  pinecone.index<MemoryMetadata>({ name: indexName });

/**
 * The raw Pinecone client — exported for any control-plane operations
 * (e.g. describeIndex, listIndexes) that don't go through the index directly.
 */
export { pinecone };

/**
 * The resolved index name, derived from the validated env var.
 * Useful for logging or building index-scoped namespaces at runtime.
 */
export { indexName as PINECONE_INDEX };
