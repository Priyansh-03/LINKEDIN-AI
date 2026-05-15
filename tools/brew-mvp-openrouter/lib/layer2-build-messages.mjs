/**
 * Layer 2 — PRD §7.4 Profile Analyzer: system prompt + user message (profile blocks + L1 verbalization + canonical JSON).
 */

import { PROFILE_ANALYZER_PRD_SYSTEM } from "./prompts/profile-analyzer-prd-system.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPromptPassport } from "./prompt-passport.mjs";

export const LAYER2_ID = "L2_assemble_messages";

/** Bump when PRD prompt file or assembly contract changes. */
export const PROMPT_VERSION = "brew_mvp_profile_analyzer_prd_v2_two_pass";

export const BREW_MVP_SYSTEM = PROFILE_ANALYZER_PRD_SYSTEM;
const _dir = dirname(fileURLToPath(import.meta.url));
const PROFILE_SYSTEM_PATH = join(_dir, "prompts/profile-analyzer-prd-system.txt");

function isRecord(x) {
  return x != null && typeof x === "object" && !Array.isArray(x);
}

function resolvedUserContext(dataset) {
  const u = isRecord(dataset.userContext) ? dataset.userContext : {};
  const p = isRecord(dataset.profile) ? dataset.profile : {};
  return {
    declared_niche:
      String(u.declared_niche || u.niche || "").trim() ||
      "(not declared — infer from headline/about/experience)",
    career_goal: String(u.career_goal || "Unknown").trim(),
    geography: String(u.geography || p.location || "Unknown").trim(),
    years_experience: String(u.years_experience || p.yearsExperienceHint || "Unknown").trim(),
    target_audience:
      String(u.target_audience || "").trim() || "(infer from profile and taskInstruction)",
  };
}

function truncStr(s, max) {
  const t = String(s || "");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function formatExperiencesPRD(profile, trim = {}) {
  const maxDesc = typeof trim.maxDescriptionChars === "number" ? trim.maxDescriptionChars : 8000;
  const items = Array.isArray(profile.experienceItems) ? profile.experienceItems : [];
  if (!items.length) return "(no experience entries)";
  return items
    .map((e, idx) => {
      if (!isRecord(e)) return "";
      const desc = truncStr(e.description || "", maxDesc);
      return [
        `ROLE ${idx + 1}: ${e.title || ""} at ${e.company || ""}`,
        `DURATION: ${e.duration || ""}`,
        `DESCRIPTION: ${desc}`,
      ].join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

function formatRecommendationsPRD(profile) {
  const recs = profile.recommendations;
  if (!Array.isArray(recs) || !recs.length) return "(none)";
  return recs
    .map((r, i) => {
      if (typeof r === "string") {
        return `RECOMMENDATION ${i + 1}\nFROM: Unknown\nTEXT: ${r}`;
      }
      if (!isRecord(r)) return "";
      return `RECOMMENDATION ${i + 1}\nFROM: ${r.name || r.from || "Unknown"}\nROLE: ${r.role || ""}\nTEXT: ${r.message || r.text || ""}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

function formatFeaturedPRD(profile) {
  const f = profile.featured;
  if (!Array.isArray(f) || !f.length) return "(empty — 0 featured items)";
  return f
    .map((it, i) => {
      if (!isRecord(it)) return `ITEM ${i + 1}: ${String(it)}`;
      return [
        `ITEM ${i + 1}`,
        `  title: ${it.title || it.text || ""}`,
        `  url: ${it.url || ""}`,
        `  type: ${it.type || it.format || "(unspecified)"}`,
        `  date_label: ${it.date_label || "(unknown recency)"}`,
      ].join("\n");
    })
    .join("\n\n");
}

/**
 * Shared PRD user context (Pass A / Pass B / optional single-pass).
 * @param {Record<string, unknown>} dataset
 * @param {{ profileBlock: string, metricsBlock: string, behaviorBlock: string, metaBlock: string }} verbalization
 * @param {{ passACompact?: boolean }} [opts]
 */
export function buildPrdUserContextMessage(dataset, verbalization, opts = {}) {
  const task = String(dataset.taskInstruction || "").trim();
  const uc = resolvedUserContext(dataset);
  const p = isRecord(dataset.profile) ? dataset.profile : {};

  const headline = String(p.headline || "").trim() || "(empty)";
  const rawAbout = String(p.about || "").trim() || "(empty)";
  const about =
    opts.passACompact === true ? truncStr(rawAbout, Number(process.env.BREW_MVP_PASS_A_ABOUT_MAX_CHARS || 720)) : rawAbout;
  const skills = Array.isArray(p.skills) ? p.skills.map(String) : [];
  const skillsForList = opts.passACompact === true ? skills.slice(0, 22) : skills;
  const skillsList = skillsForList.length ? skillsForList.join(", ") : "(none)";
  const expTrim =
    opts.passACompact === true
      ? { maxDescriptionChars: Number(process.env.BREW_MVP_PASS_A_EXP_DESC_MAX_CHARS || 160) }
      : {};

  const prdProfileBlock =
    opts.passACompact === true
      ? [
          "USER CONTEXT",
          `niche: ${uc.declared_niche}`,
          `goal: ${uc.career_goal} | geo: ${uc.geography} | yoe: ${uc.years_experience}`,
          `audience: ${uc.target_audience}`,
          "",
          "PROFILE",
          `HEADLINE: ${headline}`,
          "ABOUT:",
          about,
          "EXPERIENCE:",
          formatExperiencesPRD(p, expTrim),
          `SKILLS (${skills.length} total):`,
          skillsList,
          "RECS:",
          truncStr(formatRecommendationsPRD(p), Number(process.env.BREW_MVP_PASS_A_RECS_MAX_CHARS || 380)),
          "FEATURED:",
          truncStr(formatFeaturedPRD(p), Number(process.env.BREW_MVP_PASS_A_FEATURED_MAX_CHARS || 380)),
        ].join("\n")
      : [
          "═══════════════════════════════════════════════════════════",
          "USER CONTEXT PROVIDED [USER_CONTEXT_BLOCK] — PRD §7.4",
          "═══════════════════════════════════════════════════════════",
          `Declared niche: ${uc.declared_niche}`,
          `Career goal: ${uc.career_goal} (Growth / Job Seeking / Both)`,
          `Geographic focus: ${uc.geography}`,
          `Years of experience: ${uc.years_experience}`,
          `Target audience: ${uc.target_audience}`,
          "",
          "═══════════════════════════════════════════════════════════",
          "PROFILE DATA TO ANALYZE",
          "═══════════════════════════════════════════════════════════",
          `HEADLINE: ${headline}`,
          "",
          "ABOUT SECTION:",
          about,
          "",
          "EXPERIENCE ENTRIES:",
          formatExperiencesPRD(p, expTrim),
          "",
          `SKILLS LISTED (${skills.length} total):`,
          skillsList,
          "",
          `RECOMMENDATIONS RECEIVED (${Array.isArray(p.recommendations) ? p.recommendations.length : 0} total):`,
          formatRecommendationsPRD(p),
          "",
          "FEATURED SECTION:",
          formatFeaturedPRD(p),
        ].join("\n");

  const canonical =
    opts.passACompact === true
      ? [
          "### CANONICAL (Pass A compact)",
          "Full dataset JSON omitted to save prompt tokens; use PROFILE DATA TO ANALYZE + supplementary blocks. If a field is missing there, infer conservatively.",
        ].join("\n")
      : ["### CANONICAL DATASET JSON (lossless source of truth; minified)", JSON.stringify(dataset)].join("\n");

  const taskLine =
    opts.passACompact === true
      ? truncStr(task || "(none)", Number(process.env.BREW_MVP_PASS_A_TASK_MAX_CHARS || 360))
      : task || "(none)";
  const metaBlk =
    opts.passACompact === true
      ? truncStr(verbalization.metaBlock, Number(process.env.BREW_MVP_PASS_A_META_MAX_CHARS || 320))
      : verbalization.metaBlock;
  const metricsBlk =
    opts.passACompact === true
      ? truncStr(verbalization.metricsBlock, Number(process.env.BREW_MVP_PASS_A_METRICS_MAX_CHARS || 480))
      : verbalization.metricsBlock;
  const behaviorBlk =
    opts.passACompact === true
      ? truncStr(verbalization.behaviorBlock, Number(process.env.BREW_MVP_PASS_A_BEHAVIOR_MAX_CHARS || 480))
      : verbalization.behaviorBlock;
  const peerBlk =
    opts.passACompact === true
      ? truncStr(verbalization.peerBlock, Number(process.env.BREW_MVP_PASS_A_PEER_MAX_CHARS || 480))
      : verbalization.peerBlock;

  return [
    opts.passACompact === true
      ? "Use blocks in order. Pass A: PROFILE + supplementary (no full dataset JSON)."
      : "Use the blocks below in order; if anything conflicts, prefer CANONICAL DATASET JSON last.",
    "",
    "### Pipeline taskInstruction (operator context)",
    taskLine,
    "",
    prdProfileBlock,
    "",
    "### Supplementary: metrics, behavior, peer, dataset meta (Layer 1 verbalization)",
    metaBlk,
    "",
    metricsBlk,
    "",
    behaviorBlk,
    "",
    peerBlk,
    "",
    canonical,
  ].join("\n");
}

/**
 * Single-pass: full PRD system prompt + user context (large completion; set BREW_MVP_TWO_PASS=0).
 */
export function runLayer2AssembleMessages(dataset, verbalization) {
  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  const userMessage =
    buildPrdUserContextMessage(dataset, verbalization) +
    "\n\nReturn only the JSON object required by the system message (full PRD schema in system prompt).";

  const finishedAt = new Date().toISOString();
  return {
    layerId: LAYER2_ID,
    ok: true,
    startedAt,
    finishedAt,
    durationMs: Math.round(performance.now() - t0),
    messages: [
      { role: "system", content: BREW_MVP_SYSTEM },
      { role: "user", content: userMessage },
    ],
    userMessageCharCount: userMessage.length,
    prompt_passport: createPromptPassport({
      layer: LAYER2_ID,
      module: "profile_analyzer",
      promptPath: PROFILE_SYSTEM_PATH,
      promptText: BREW_MVP_SYSTEM,
      promptVersion: "v1.0",
    }),
  };
}
