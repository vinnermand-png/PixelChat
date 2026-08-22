import { isAiEnabled } from "./aiSettings";

export class AiDisabledError extends Error {
  constructor() {
    super("AI generation is currently disabled.");
    this.name = "AiDisabledError";
  }
}

export async function requireAiEnabled() {
  if (!(await isAiEnabled())) {
    throw new AiDisabledError();
  }
}
