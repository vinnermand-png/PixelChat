import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export type AiSettings = {
  enabled: boolean;
};

const DEFAULT_AI_ENABLED = parseBoolean(process.env.AI_ENABLED, true);
const SETTINGS_PATH = process.env.PIXELCHAT_AI_SETTINGS_FILE?.trim()
  || path.join(process.cwd(), ".pixelchat-ai-settings.json");

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "on", "yes"].includes(normalized)) return true;
  if (["0", "false", "off", "no"].includes(normalized)) return false;
  return fallback;
}

function isValidSettings(value: unknown): value is AiSettings {
  return Boolean(value) && typeof value === "object" && typeof (value as AiSettings).enabled === "boolean";
}

export async function getAiSettings(): Promise<AiSettings> {
  try {
    const raw = await readFile(SETTINGS_PATH, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return isValidSettings(parsed) ? parsed : { enabled: DEFAULT_AI_ENABLED };
  } catch {
    return { enabled: DEFAULT_AI_ENABLED };
  }
}

export async function isAiEnabled(): Promise<boolean> {
  return (await getAiSettings()).enabled;
}

export async function setAiEnabled(enabled: boolean): Promise<AiSettings> {
  const settings: AiSettings = { enabled };
  const tempPath = `${SETTINGS_PATH}.tmp`;
  await writeFile(tempPath, JSON.stringify(settings), "utf8");
  await rename(tempPath, SETTINGS_PATH);
  return settings;
}
