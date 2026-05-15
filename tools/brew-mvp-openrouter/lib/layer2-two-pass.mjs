/**
 * Layer 2 — two-pass PRD assembly (Pass A: sub_analyses; Pass B: synthesis JSON).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPrdUserContextMessage } from "./layer2-build-messages.mjs";
import { createPromptPassport } from "./prompt-passport.mjs";

const _dir = dirname(fileURLToPath(import.meta.url));

const PASS_A_SYSTEM = readFileSync(join(_dir, "prompts/profile-analyzer-pass-a.txt"), "utf8");
const PASS_A_MICRO_SYSTEM = readFileSync(join(_dir, "prompts/profile-analyzer-pass-a-micro.txt"), "utf8");
const PASS_B_SYSTEM = readFileSync(join(_dir, "prompts/profile-analyzer-pass-b.txt"), "utf8");
const PASS_A_PATH = join(_dir, "prompts/profile-analyzer-pass-a.txt");
const PASS_A_MICRO_PATH = join(_dir, "prompts/profile-analyzer-pass-a-micro.txt");
const PASS_B_PATH = join(_dir, "prompts/profile-analyzer-pass-b.txt");

function clipPassAUserMessage(text) {
  const max = Number(process.env.BREW_MVP_PASS_A_USER_MSG_MAX_CHARS || 4200);
  if (!Number.isFinite(max) || max < 2000) return text;
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[USER MESSAGE TRUNCATED — analyze from visible profile + metrics + behavior only.]`;
}

/**
 * Minimal token footprint — used when Pass A hits max_tokens and JSON truncates.
 * Keeps user message small so low-credit accounts stay under OpenRouter prompt limits.
 * @param {Record<string, unknown>} dataset
 */
export function runLayer2PassAMicroSubAnalyses(dataset) {
  const t0 = performance.now();
  const p = dataset.profile || {};
  const mini = {
    headline: String(p.headline || "").trim().slice(0, 220),
    about: String(p.about || "").trim().slice(0, 335),
    skills: (Array.isArray(p.skills) ? p.skills : []).slice(0, 14).map(String),
    experienceItems: (Array.isArray(p.experienceItems) ? p.experienceItems : []).slice(0, 3).map((e) => ({
      title: String(e?.title || "").slice(0, 72),
      company: String(e?.company || "").slice(0, 56),
      duration: String(e?.duration || "").slice(0, 40),
    })),
    featured: (Array.isArray(p.featured) ? p.featured : []).slice(0, 4).map((f) => ({
      title: String(f?.title || f?.text || "").slice(0, 72),
      type: String(f?.type || f?.format || "").slice(0, 24),
    })),
    recommendations: (Array.isArray(p.recommendations) ? p.recommendations : []).slice(0, 3).map((r) => ({
      name: String(r?.name || r?.from || "").slice(0, 56),
      text: String(r?.message || r?.text || "").slice(0, 140),
    })),
  };
  let blob = JSON.stringify(mini);
  const maxBlob = Number(process.env.BREW_MVP_PASS_A_MICRO_JSON_MAX_CHARS || 2200);
  if (blob.length > maxBlob) {
    mini.about = String(mini.about || "").slice(0, 160);
    mini.skills = mini.skills.slice(0, 10);
    blob = JSON.stringify(mini).slice(0, maxBlob);
  }
  const user = `Profile JSON (analyze factually):\n${blob}\n\nReturn one JSON object with only key "sub_analyses".`;

  return {
    layerId: "L2_passA_sub_analyses_micro",
    ok: true,
    durationMs: Math.round(performance.now() - t0),
    messages: [
      { role: "system", content: PASS_A_MICRO_SYSTEM },
      { role: "user", content: user },
    ],
    userMessageCharCount: user.length,
    prompt_passport: createPromptPassport({
      layer: "L2_passA_sub_analyses_micro",
      module: "profile_analyzer",
      promptPath: PASS_A_MICRO_PATH,
      promptText: PASS_A_MICRO_SYSTEM,
      promptVersion: "v1.0",
    }),
  };
}

export function runLayer2PassASubAnalyses(dataset, verbalization) {
  const t0 = performance.now();
  const ctx = clipPassAUserMessage(buildPrdUserContextMessage(dataset, verbalization, { passACompact: true }));
  const user = `${ctx}\n\nReturn JSON with only the key "sub_analyses" as specified in the system message.`;
  return {
    layerId: "L2_passA_sub_analyses",
    ok: true,
    durationMs: Math.round(performance.now() - t0),
    messages: [
      { role: "system", content: PASS_A_SYSTEM },
      { role: "user", content: user },
    ],
    userMessageCharCount: user.length,
    prompt_passport: createPromptPassport({
      layer: "L2_passA_sub_analyses",
      module: "profile_analyzer",
      promptPath: PASS_A_PATH,
      promptText: PASS_A_SYSTEM,
      promptVersion: "v1.0",
    }),
  };
}

export function runLayer2PassBSynthesis(dataset, verbalization, subAnalyses) {
  const t0 = performance.now();
  const ctx = buildPrdUserContextMessage(dataset, verbalization);
  const user = [
    ctx,
    "",
    "### PASS A sub_analyses (authoritative for sections A–F)",
    JSON.stringify({ sub_analyses: subAnalyses }),
    "",
    "Return JSON with exactly the keys specified in the system message (no sub_analyses key).",
  ].join("\n");
  return {
    layerId: "L2_passB_synthesis",
    ok: true,
    durationMs: Math.round(performance.now() - t0),
    messages: [
      { role: "system", content: PASS_B_SYSTEM },
      { role: "user", content: user },
    ],
    userMessageCharCount: user.length,
    prompt_passport: createPromptPassport({
      layer: "L2_passB_synthesis",
      module: "profile_analyzer",
      promptPath: PASS_B_PATH,
      promptText: PASS_B_SYSTEM,
      promptVersion: "v1.0",
    }),
  };
}
