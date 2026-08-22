export type AiStatus = { enabled: boolean };

async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function getAiStatus(): Promise<AiStatus> {
  const response = await fetch("/api/ai/status", { method: "GET" });
  if (!response.ok) throw new Error("Unable to read AI status.");
  return readJson<AiStatus>(response);
}

export async function setAiStatus(enabled: boolean): Promise<AiStatus> {
  const response = await fetch("/api/ai/status", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
  const payload = await response.json() as AiStatus | { error?: string };
  if (!response.ok || !payload || "error" in payload) {
    throw new Error("error" in payload && payload.error ? payload.error : "Unable to update AI status.");
  }
  return payload;
}

export async function fetchAi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const status = await getAiStatus();
  if (!status.enabled) {
    throw new Error("AI generation is currently disabled.");
  }
  return fetch(input, init);
}
