/**
 * Layer 3 — model: OpenAI streaming completion.
 */

export const LAYER3_ID = "L3_openai_completion";

/**
 * Clamps requested `max_tokens` for budget control. Override with
 * `BREW_MVP_COMPLETION_TOKEN_CAP` (number), or set to `0` to disable clamping.
 * Default 1600 is conservative for two-pass JSON generations.
 * @param {number} requested
 */
export function applyCompletionTokenCap(requested) {
  const r = Math.floor(Number(requested));
  if (!Number.isFinite(r) || r < 1) return 1;
  const raw = process.env.BREW_MVP_COMPLETION_TOKEN_CAP;
  if (raw === "0" || raw === "off") return r;
  const cap = Number(raw ?? 4000);
  if (!Number.isFinite(cap) || cap < 1) return r;
  return Math.min(r, Math.floor(cap));
}

/**
 * @param {any} openai — OpenAI SDK client
 * @param {{ role: string, content: string }[]} messages
 * @param {{ model: string, quietStream: boolean, maxTokens?: number, layerTag?: string, temperature?: number }} opts
 */
export async function runLayer3StreamCompletion(openai, messages, opts) {
  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  const { model, quietStream, maxTokens: maxTokensOpt, layerTag, temperature: temperatureOpt } = opts;

  const maxTokens = applyCompletionTokenCap(
    Math.floor(maxTokensOpt ?? Number(process.env.BREW_MVP_MAX_TOKENS || 5600))
  );

  const rawTemp = temperatureOpt ?? process.env.BREW_MVP_TEMPERATURE;
  let temperature = 0.35;
  if (rawTemp !== undefined && rawTemp !== "") {
    const t = Number(rawTemp);
    if (Number.isFinite(t)) temperature = Math.min(1.2, Math.max(0, t));
  }

  let response = "";
  let lastUsage;

  const stream = await openai.chat.completions.create({
    model,
    messages,
    stream: true,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
    stream_options: { include_usage: true },
  });

  for await (const chunk of stream) {
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) {
      response += content;
      if (!quietStream) process.stdout.write(content);
    }
    if (chunk.usage) {
      lastUsage = {
        promptTokens: chunk.usage.prompt_tokens ?? null,
        completionTokens: chunk.usage.completion_tokens ?? null,
        totalTokens: chunk.usage.total_tokens ?? null,
        completionTokensDetails: null,
      };
    }
  }

  if (!quietStream) process.stdout.write("\n");

  const finishedAt = new Date().toISOString();
  return {
    layerId: layerTag || LAYER3_ID,
    ok: true,
    startedAt,
    finishedAt,
    durationMs: Math.round(performance.now() - t0),
    rawText: response,
    usage: lastUsage,
    maxTokens,
  };
}
