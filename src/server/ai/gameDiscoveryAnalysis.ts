import { createServerFn } from "@tanstack/react-start";
import type {
  GameDiscoveryQuestion,
  GameDiscoveryUnderstanding,
} from "@/lib/gameDiscovery/gameDiscovery";

export interface GameDiscoveryAnalysisInput {
  gameName: string;
  originalConcept: string;
  questions: GameDiscoveryQuestion[];
  existingUnderstanding: GameDiscoveryUnderstanding;
}

function getOpenAiApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }

  return apiKey;
}

/**
 * Secure server-side boundary for future Game Discovery AI analysis.
 *
 * The function is intentionally not implemented as an AI analysis yet.
 * Its purpose is to establish a same-origin TanStack Start server function
 * where OPENAI_API_KEY can be read only during server execution.
 */
export const analyzeGameDiscovery = createServerFn({ method: "POST" })
  .inputValidator((data: GameDiscoveryAnalysisInput) => data)
  .handler(async ({ data }) => {
    void getOpenAiApiKey();
    void data;

    throw new Error(
      "Game Discovery AI analysis has not been implemented yet. STEP 56A only establishes the secure server boundary.",
    );
  });
