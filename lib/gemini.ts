import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set in environment variables.");
}

// Singleton client — created once per cold start
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Returns a GenerativeModel instance for the given model name.
 * Defaults to gemini-2.0-flash for fast, cost-effective responses.
 */
export function getGenerativeModel(modelName = "gemini-2.0-flash"): GenerativeModel {
  return genAI.getGenerativeModel({ model: modelName });
}

/**
 * Returns a GenerativeModel pre-configured for text embeddings.
 * Uses text-embedding-004 — Google's latest embedding model.
 */
export function getEmbeddingModel(): GenerativeModel {
  return genAI.getGenerativeModel({ model: "text-embedding-004" });
}

/**
 * Generates an embedding vector for the given text string.
 * Returns a number[] representing the semantic content of the text.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const model = getEmbeddingModel();
  const result = await model.embedContent(text);
  return result.embedding.values;
}

/**
 * Generates a chat response given a system prompt and user message.
 * Includes relevant memory context injected into the system instruction.
 */
export async function generateChatResponse(
  userMessage: string,
  systemPrompt: string
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(userMessage);
  const text = result.response.text();
  return text;
}
