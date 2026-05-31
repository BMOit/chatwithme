import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("GEMINI_API_KEY is not set in environment variables.");
}

// Singleton client — created once per cold start
const genAI = new GoogleGenerativeAI(apiKey);

/**
 * Returns a GenerativeModel instance for the given model name.
 * Defaults to gemini-3.5-flash for fast, cost-effective responses.
 */
export function getGenerativeModel(modelName = "gemini-3.5-flash"): GenerativeModel {
  return genAI.getGenerativeModel({ model: modelName });
}

/**
 * Retrieves an embedding vector for the given text.
 * Switches to gemini-embedding-2 to replace the deprecated embedding-004.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
    const result = await model.embedContent({
      content: { parts: [{ text }] },
      outputDimensionality: 1024,
    });
    return result.embedding.values;
  } catch (e: any) {
    console.warn("gemini-embedding-2 failed, trying fallback...", e);
    const fallback = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const result = await fallback.embedContent({
      content: { parts: [{ text }] },
      outputDimensionality: 1024,
    });
    return result.embedding.values;
  }
}

/**
 * Generates a chat response given a system prompt and user message.
 * Includes relevant memory context injected into the system instruction.
 * Fallback handles 429 and 503 limits dynamically.
 */
export async function generateChatResponse(
  userMessage: string,
  systemPrompt: string
): Promise<string> {
  const modelsToTry = [
    "gemini-2.5-flash", // Stable & available
    "gemini-3.5-flash", // Current but often 503
    "gemini-flash-latest" // Catch-all fast endpoint
  ];

  let lastError: any = null;

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemPrompt,
      });
      const result = await model.generateContent(userMessage);
      return result.response.text();
    } catch (err: any) {
      console.warn(`[gemini] Model ${modelName} failed:`, err?.message);
      lastError = err;
      
      // Only retry on quota (429) or unavailability (503/404)
      const msg = err?.message || "";
      if (!msg.includes("429") && !msg.includes("503") && !msg.includes("404") && !msg.includes("quota")) {
        // If it's a structural error (e.g. 400 bad request), throw immediately
        throw err;
      }
    }
  }

  throw lastError || new Error("All chat models failed.");
}
