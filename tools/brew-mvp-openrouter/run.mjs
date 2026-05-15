/**
 * Brew MVP — layered pipeline: L0 ingest → L1 verbalize → L2 messages → L3 LLM (1- or 2-pass) → L4 parse → L5 envelope.
 *
 * Usage:
 *   export OPENAI_API_KEY=sk-...
 *   node run.mjs --out=../../output/wellness.json
 *
 * Batch (default trio: dataset.json, dataset-aiml.json, dataset-sales.json), one run after another:
 *   node run.mjs --batch --out-dir=../../output
 *
 * Custom list (comma-separated paths):
 *   node run.mjs --datasets=../../dataset.json,../../dataset-aiml.json --out-dir=../../output
 *
 * Env: BREW_MVP_DATASETS=…, BREW_MVP_TWO_PASS, BREW_MVP_MAX_TOKENS_*,
 * BREW_MVP_COMPLETION_TOKEN_CAP (default 1600; set 0 to disable).
 *
 * Layer debug JSON (optional): set BREW_MVP_LAYER_TRACE_DIR=/abs/path (base dir) or
 *   node run.mjs --layer-trace-dir=/abs/path …
 * Each run writes a subfolder named by traceId with files:
 *   L0_load_dataset.json, L1_verbalize.json, L2_passA_messages.json, L3_passA_completion.json, …
 * Optional: BREW_MVP_LAYER_TRACE_RAW_MAX_CHARS (default 1500000), BREW_MVP_LAYER_TRACE_MSG_MAX_CHARS (default 120000).
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import OpenAI from "openai";
import { runLayer0LoadDataset } from "./lib/layer0-load-dataset.mjs";
import { runLayer1Verbalize } from "./lib/layer1-verbalize.mjs";
import { runLayer2AssembleMessages, PROMPT_VERSION } from "./lib/layer2-build-messages.mjs";
import {
  runLayer2PassAMicroSubAnalyses,
  runLayer2PassASubAnalyses,
  runLayer2PassBSynthesis,
} from "./lib/layer2-two-pass.mjs";
import { runLayer3StreamCompletion } from "./lib/layer3-stream-completion.mjs";
import {
  parseJsonObject,
  runLayer4ParseValidate,
  runLayer4ParseValidateTwoPass,
  validateSubAnalysesShape,
} from "./lib/layer4-parse-results.mjs";
import { buildFallbackSubAnalyses } from "./lib/pass-a-fallback-subanalyses.mjs";
import { buildLayerOutputsEnvelope } from "./lib/layer-outputs-envelope.mjs";
import { applySlimEnvelope, isVerboseEnvelope } from "./lib/slim-envelope.mjs";
import { runLayer5BuildEnvelope } from "./lib/layer5-envelope.mjs";
import {
  isMongoPersistenceEnabled,
  persistRunToMongo,
  upsertPromptTemplate,
} from "./lib/mongodb-persistence.mjs";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveOpenAIBaseURL() {
  const raw = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE;
  if (!raw) return undefined;
  const trimmed = String(raw).trim().replace(/\/+$/, "");
  if (!trimmed) return undefined;
  if (/\/v\d+$/i.test(trimmed)) return trimmed;
  return `${trimmed}/v1`;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(join(__dirname, "..", ".."));
const runLogPath =
  process.env.BREW_MVP_RUN_LOG_FILE || join(repoRoot, "output", "brew-mvp-layer-runs.log");
let currentTraceId = null;

function logRun(message, meta = {}) {
  const payload = {
    ts: new Date().toISOString(),
    level: "info",
    trace_id: currentTraceId,
    message,
    ...meta,
  };
  const line = JSON.stringify(payload);
  process.stderr.write(`${line}\n`);
  try {
    mkdirSync(dirname(runLogPath), { recursive: true });
    appendFileSync(runLogPath, `${line}\n`, "utf8");
  } catch {
    // ignore log file errors; terminal logging still works
  }
}

async function runLayer3WithFallback(openai, messages, opts, fallbackModel) {
  try {
    return await runLayer3StreamCompletion(openai, messages, opts);
  } catch (e) {
    if (!fallbackModel || fallbackModel === opts.model) throw e;
    logRun("Primary model failed, retrying fallback model", {
      primary_model: opts.model,
      fallback_model: fallbackModel,
      layerTag: opts.layerTag,
      error: e?.message || String(e),
    });
    return await runLayer3StreamCompletion(openai, messages, {
      ...opts,
      model: fallbackModel,
    });
  }
}

/** One-word output `.json` basename per known dataset file; unknown stems → alphanumeric slug. */
const DATASET_STEM_TO_OUTPUT_WORD = {
  dataset: "wellness",
  "dataset-aiml": "aiml",
  "dataset-sales": "sales",
};

function outputWordFromDatasetPath(datasetPath) {
  const stem = basename(datasetPath, ".json");
  if (DATASET_STEM_TO_OUTPUT_WORD[stem]) return DATASET_STEM_TO_OUTPUT_WORD[stem];
  const slug = stem.replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
  return slug || "out";
}

function defaultDatasetPath() {
  const envPath = process.env.BREW_MVP_DATASET;
  if (envPath) return resolve(envPath);
  return join(repoRoot, "dataset.json");
}

function parseOutArg() {
  const raw = process.argv.find((a) => a.startsWith("--out="));
  if (!raw) return null;
  return resolve(raw.slice("--out=".length));
}

function parseOutDirArg() {
  const raw = process.argv.find((a) => a.startsWith("--out-dir="));
  if (!raw) return null;
  return resolve(raw.slice("--out-dir=".length));
}

function parseDatasetsArg() {
  const raw = process.argv.find((a) => a.startsWith("--datasets="));
  if (!raw) return null;
  return raw
    .slice("--datasets=".length)
    .split(",")
    .map((s) => resolve(s.trim()))
    .filter(Boolean);
}

/** Base directory for per-run layer JSON dumps (subfolder = traceId). */
function resolveLayerTraceBaseDir() {
  const cli = process.argv.find((a) => a.startsWith("--layer-trace-dir="));
  if (cli) return resolve(cli.slice("--layer-trace-dir=".length).trim());
  const e = process.env.BREW_MVP_LAYER_TRACE_DIR;
  return e && String(e).trim() ? resolve(String(e).trim()) : null;
}

function truncateTraceString(s, maxChars) {
  if (typeof s !== "string") return s;
  const n = Math.floor(Number(maxChars));
  const cap = Number.isFinite(n) && n > 1000 ? n : 1_500_000;
  if (s.length <= cap) return s;
  return `${s.slice(0, cap)}\n\n… [truncated: ${s.length - cap} chars omitted]`;
}

/**
 * @param {string | null} baseDir
 * @param {string} traceId
 * @param {string} datasetPath
 */
function createLayerTraceWriter(baseDir, traceId, datasetPath) {
  if (!baseDir || !traceId) return null;
  const runDir = join(baseDir, traceId);
  mkdirSync(runDir, { recursive: true });
  const rawMax = Number(process.env.BREW_MVP_LAYER_TRACE_RAW_MAX_CHARS || 1_500_000);
  const msgMax = Number(process.env.BREW_MVP_LAYER_TRACE_MSG_MAX_CHARS || 120_000);

  writeFileSync(
    join(runDir, "_trace_meta.json"),
    JSON.stringify(
      { traceId, datasetPath, startedAt: new Date().toISOString(), note: "Per-step pipeline dumps for debugging." },
      null,
      2
    ),
    "utf8"
  );

  return {
    runDir,
    rawMax,
    msgMax,
    /** @param {string} name file basename without .json */
    write(name, data) {
      const path = join(runDir, `${name}.json`);
      writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
      logRun(`[LayerTrace] wrote ${path}`);
    },
    /** @param {Record<string, unknown>|null|undefined} l3 */
    l3Snapshot(l3) {
      if (!l3 || typeof l3 !== "object") return l3;
      const o = /** @type {Record<string, unknown>} */ ({ ...l3 });
      if (typeof o.rawText === "string") o.rawText = truncateTraceString(o.rawText, rawMax);
      return o;
    },
    /** @param {unknown[]} messages */
    messagesSnapshot(messages) {
      if (!Array.isArray(messages)) return messages;
      return messages.map((m) => {
        if (!m || typeof m !== "object") return m;
        const r = /** @type {Record<string, unknown>} */ ({ ...m });
        if (typeof r.content === "string") r.content = truncateTraceString(r.content, msgMax);
        return r;
      });
    },
  };
}

async function registerBuiltInPromptsToMongo() {
  if (!isMongoPersistenceEnabled()) return;
  if (process.env.BREW_MVP_REGISTER_PROMPTS === "0") return;
  const promptsDir = join(__dirname, "lib", "prompts");
  const defs = [
    { promptType: "profile", file: "profile-analyzer-prd-system.txt", version: "1.0" },
    { promptType: "profile", file: "profile-analyzer-pass-a.txt", version: "1.0" },
    { promptType: "profile", file: "profile-analyzer-pass-b.txt", version: "1.0" },
    { promptType: "behavior", file: "behavior-analyzer-system.txt", version: "1.0" },
    { promptType: "content", file: "content-analyzer-system.txt", version: "1.0" },
    { promptType: "comparative", file: "comparative-intelligence-system.txt", version: "1.0" },
    { promptType: "reporting", file: "master-reporting-system.txt", version: "1.0" },
  ];
  for (const def of defs) {
    const absPath = join(promptsDir, def.file);
    try {
      const template = readFileSync(absPath, "utf8");
      await upsertPromptTemplate({
        promptType: def.promptType,
        version: def.version,
        template,
        variables: [],
        metadata: {
          path: `/prompts/${def.promptType}/v${def.version}`,
          source_file: absPath,
        },
      });
      logRun("[Prompt Registry] upserted template", { promptType: def.promptType, version: def.version });
    } catch (e) {
      logRun("[Prompt Registry] template upsert failed", {
        promptType: def.promptType,
        version: def.version,
        error: e?.message || String(e),
      });
    }
  }
}

function resolveDatasetPaths() {
  const fromCli = parseDatasetsArg();
  if (fromCli?.length) return fromCli;
  const fromEnv = process.env.BREW_MVP_DATASETS;
  if (fromEnv?.trim()) {
    return fromEnv
      .split(",")
      .map((s) => resolve(s.trim()))
      .filter(Boolean);
  }
  if (process.argv.includes("--batch")) {
    return [
      join(repoRoot, "dataset.json"),
      join(repoRoot, "dataset-aiml.json"),
      join(repoRoot, "dataset-sales.json"),
    ];
  }
  return [defaultDatasetPath()];
}

/**
 * @param {string} datasetPath
 * @param {{ total: number, singleOut: string | null, outDir: string | null }} opts
 */
function resolveOutFileFor(datasetPath, opts) {
  const { total, singleOut, outDir } = opts;
  const word = outputWordFromDatasetPath(datasetPath);
  if (total === 1 && singleOut) return singleOut;
  if (total === 1 && outDir) return join(outDir, `${word}.json`);
  if (total === 1) return null;
  const dir = outDir || (singleOut ? dirname(singleOut) : join(repoRoot, "output"));
  return join(dir, `${word}.json`);
}

function mergeUsage(a, b) {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;
  const ra = a.completionTokensDetails?.reasoningTokens ?? 0;
  const rb = b.completionTokensDetails?.reasoningTokens ?? 0;
  const rSum = ra + rb;
  return {
    promptTokens: (a.promptTokens || 0) + (b.promptTokens || 0),
    completionTokens: (a.completionTokens || 0) + (b.completionTokens || 0),
    totalTokens: (a.totalTokens || 0) + (b.totalTokens || 0),
    reasoningTokens: rSum > 0 ? rSum : null,
  };
}

function buildTraceTwoPass(l0, l1, l2a, l3a, l2b, l3b, l4) {
  return [
    { layerId: l0.layerId, ok: l0.ok, durationMs: l0.durationMs, errors: l0.errors },
    { layerId: l1.layerId, ok: l1.ok, durationMs: l1.durationMs, stats: l1.stats },
    {
      layerId: l2a.layerId,
      ok: l2a.ok,
      durationMs: l2a.durationMs,
      userMessageCharCount: l2a.userMessageCharCount,
    },
    {
      layerId: l3a.layerId,
      ok: l3a.ok,
      durationMs: l3a.durationMs,
      maxTokens: l3a.maxTokens,
      usage: l3a.usage
        ? {
            promptTokens: l3a.usage.promptTokens,
            completionTokens: l3a.usage.completionTokens,
            totalTokens: l3a.usage.totalTokens,
            reasoningTokens: l3a.usage.completionTokensDetails?.reasoningTokens ?? null,
          }
        : null,
    },
    {
      layerId: l2b.layerId,
      ok: l2b.ok,
      durationMs: l2b.durationMs,
      userMessageCharCount: l2b.userMessageCharCount,
    },
    {
      layerId: l3b.layerId,
      ok: l3b.ok,
      durationMs: l3b.durationMs,
      maxTokens: l3b.maxTokens,
      usage: l3b.usage
        ? {
            promptTokens: l3b.usage.promptTokens,
            completionTokens: l3b.usage.completionTokens,
            totalTokens: l3b.usage.totalTokens,
            reasoningTokens: l3b.usage.completionTokensDetails?.reasoningTokens ?? null,
          }
        : null,
    },
    {
      layerId: l4.layerId,
      ok: l4.ok,
      durationMs: l4.durationMs,
      parsedKeyCount: l4.parsedKeyCount,
      errors: l4.errors,
      passAErrors: l4.passAErrors,
      passBErrors: l4.passBErrors,
    },
  ];
}

function buildTraceSingle(l0, l1, l2, l3, l4) {
  return [
    { layerId: l0.layerId, ok: l0.ok, durationMs: l0.durationMs, errors: l0.errors },
    { layerId: l1.layerId, ok: l1.ok, durationMs: l1.durationMs, stats: l1.stats },
    {
      layerId: l2.layerId,
      ok: l2.ok,
      durationMs: l2.durationMs,
      userMessageCharCount: l2.userMessageCharCount,
    },
    {
      layerId: l3.layerId,
      ok: l3.ok,
      durationMs: l3.durationMs,
      maxTokens: l3.maxTokens,
      usage: l3.usage
        ? {
            promptTokens: l3.usage.promptTokens,
            completionTokens: l3.usage.completionTokens,
            totalTokens: l3.usage.totalTokens,
            reasoningTokens: l3.usage.completionTokensDetails?.reasoningTokens ?? null,
          }
        : null,
    },
    {
      layerId: l4.layerId,
      ok: l4.ok,
      durationMs: l4.durationMs,
      parsedKeyCount: l4.parsedKeyCount,
      errors: l4.errors,
    },
  ];
}

/** @param {any} openai OpenAI SDK client */
async function runPipelineOnce(datasetPath, outFile, openai) {
  currentTraceId = randomUUID();
  const layerTraceBase = resolveLayerTraceBaseDir();
  const LT = createLayerTraceWriter(layerTraceBase, currentTraceId, datasetPath);
  const quietStream = Boolean(outFile);
  const model = process.env.BREW_MVP_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini";
  const fallbackModel = process.env.BREW_MVP_FALLBACK_MODEL || "";
  const twoPass = process.env.BREW_MVP_TWO_PASS !== "0";

  logRun(`[START] dataset=${datasetPath} model=${model} twoPass=${twoPass}`, {
    datasetPath,
    model,
    fallbackModel: fallbackModel || null,
    twoPass,
  });
  logRun("[L0] load dataset");
  const l0 = runLayer0LoadDataset(datasetPath);
  logRun(`[L0] ok=${l0.ok} durationMs=${l0.durationMs}`);
  if (LT) LT.write("L0_load_dataset", l0);
  if (!l0.ok || !l0.dataset) {
    return {
      exitCode: 1,
      stderr: `Layer 0 failed (${datasetPath}): ${l0.errors.join("; ")}`,
      envelope: null,
    };
  }

  const dataset = l0.dataset;
  logRun("[L1] verbalize profile context");
  const l1 = runLayer1Verbalize(dataset);
  logRun(`[L1] ok=${l1.ok} durationMs=${l1.durationMs}`);
  if (LT) LT.write("L1_verbalize", l1);

  let l2;
  let l3;
  let l3a;
  let l3b;
  let l2a;
  let l2b;
  let l4;
  let mergedUsage;
  let layerTracePartial;
  let passAUsedStub = false;

  try {
    if (twoPass) {
      logRun("[L2A] build pass-A messages");
      l2a = runLayer2PassASubAnalyses(dataset, l1.verbalization);
      logRun(`[L2A] ok=${l2a.ok} userChars=${l2a.userMessageCharCount}`);
      if (LT) LT.write("L2_passA_messages", { ...l2a, messages: LT.messagesSnapshot(l2a.messages) });
      const mtA = Number(process.env.BREW_MVP_MAX_TOKENS_PASS_A || 4500);
      logRun(`[L3A] request completion maxTokens=${mtA}`);
      const passATemperature = (() => {
        const t = Number(process.env.BREW_MVP_PASS_A_TEMPERATURE);
        return Number.isFinite(t) ? Math.min(1.0, Math.max(0.15, t)) : 0.52;
      })();
      l3a = await runLayer3WithFallback(openai, l2a.messages, {
        model,
        quietStream,
        maxTokens: mtA,
        layerTag: "L3_passA_completion",
        temperature: passATemperature,
      }, fallbackModel);
      logRun(
        `[L3A] ok=${l3a.ok} durationMs=${l3a.durationMs} completionTokens=${l3a.usage?.completionTokens ?? "n/a"}`
      );
      if (LT) LT.write("L3_passA_completion", LT.l3Snapshot(l3a));

      let objA = parseJsonObject(l3a.rawText);
      let passAErr = validateSubAnalysesShape(objA.sub_analyses);
      if (passAErr.length) {
        logRun("Pass A validation failed (first attempt)", { errorCount: passAErr.length, sample: passAErr.slice(0, 10) });
      }
      const passACompletion = l3a.usage?.completionTokens ?? 0;
      const passACap = l3a.maxTokens ?? 0;
      const passASaturated = passACap > 0 && passACompletion >= passACap * 0.92;
      const microRetries = Number(process.env.BREW_MVP_PASS_A_MICRO_RETRIES ?? 1);
      // Retry compact Pass A on any validation failure (not only when max_tokens is saturated).
      if (passAErr.length && microRetries > 0) {
        logRun(
          passASaturated
            ? "Pass A likely truncated at max_tokens — retrying micro Pass A"
            : "Pass A validation failed — retrying micro Pass A (compact JSON)"
        );
        const l2aMicro = runLayer2PassAMicroSubAnalyses(dataset);
        const mtMicro = Number(process.env.BREW_MVP_MAX_TOKENS_PASS_A_MICRO || 2800);
        logRun(`[L3A_MICRO] request completion maxTokens=${mtMicro}`);
        const l3aMicro = await runLayer3WithFallback(openai, l2aMicro.messages, {
          model,
          quietStream,
          maxTokens: mtMicro,
          layerTag: "L3_passA_completion_micro",
          temperature: passATemperature,
        }, fallbackModel);
        logRun(
          `[L3A_MICRO] ok=${l3aMicro.ok} durationMs=${l3aMicro.durationMs} completionTokens=${l3aMicro.usage?.completionTokens ?? "n/a"}`
        );
        const objMicro = parseJsonObject(l3aMicro.rawText);
        const errMicro = validateSubAnalysesShape(objMicro.sub_analyses);
        if (!errMicro.length) {
          l2a = l2aMicro;
          l3a = l3aMicro;
          objA = objMicro;
          passAErr = errMicro;
          logRun("Pass A micro retry succeeded");
          if (LT) LT.write("L3_passA_micro_completion", LT.l3Snapshot(l3aMicro));
        } else {
          logRun("Pass A micro retry still invalid", { errorCount: errMicro.length, sample: errMicro.slice(0, 8) });
        }
      }

      const structRetries = Number(process.env.BREW_MVP_PASS_A_STRUCT_RETRIES ?? 1);
      if (passAErr.length && structRetries > 0) {
        const mtRepair = Math.max(mtA, Number(process.env.BREW_MVP_MAX_TOKENS_PASS_A_REPAIR || 5200));
        logRun("Pass A still invalid — full-context JSON repair attempt", {
          maxTokens: mtRepair,
          sampleErrors: passAErr.slice(0, 12),
        });
        const repairUser = [
          "Your previous Pass A output failed strict JSON validation.",
          "Return ONLY one JSON object whose single top-level key is \"sub_analyses\".",
          "No markdown fences, no commentary, no trailing commas.",
          "headline.rewrite_options and about.rewrite_options must each be an array of exactly 4 non-empty strings.",
          "All scores.* fields must be integers from 1 through 10 inclusive.",
          "Score spread (mandatory): fewer than 35% of all rubric integers across sub_analyses may be 6 or 7; each headline/about/skills/experience row must have at least one axis ≤5 and one ≥8 when that section has real text.",
          "Avoid uniform scores: vary 1–10 across axes where the profile evidence differs; do not set every axis to 6–7.",
          "",
          "Validation errors to fix:",
          ...passAErr.slice(0, 24).map((e) => `- ${e}`),
        ].join("\n");
        const repairMessages = [...l2a.messages, { role: "user", content: repairUser }];
        const l3aRepair = await runLayer3WithFallback(openai, repairMessages, {
          model,
          quietStream,
          maxTokens: mtRepair,
          layerTag: "L3_passA_completion_repair",
          temperature: passATemperature,
        }, fallbackModel);
        logRun(
          `[L3A_REPAIR] ok=${l3aRepair.ok} durationMs=${l3aRepair.durationMs} completionTokens=${l3aRepair.usage?.completionTokens ?? "n/a"}`
        );
        const objRepair = parseJsonObject(l3aRepair.rawText);
        const errRepair = validateSubAnalysesShape(objRepair.sub_analyses);
        if (!errRepair.length) {
          l3a = l3aRepair;
          objA = objRepair;
          passAErr = errRepair;
          logRun("Pass A JSON repair attempt succeeded");
          if (LT) LT.write("L3_passA_repair_completion", LT.l3Snapshot(l3aRepair));
        } else {
          logRun("Pass A JSON repair attempt still invalid", {
            errorCount: errRepair.length,
            sample: errRepair.slice(0, 10),
          });
          passAErr = errRepair;
        }
      }

      if (LT) {
        LT.write("L4_passA_validate", {
          passAValidationErrors: passAErr,
          sub_analyses: objA?.sub_analyses ?? null,
        });
      }

      // Opt-in stub only (default off): set BREW_MVP_PASS_A_STUB_ON_FAILURE=1 to restore old behavior.
      if (passAErr.length && process.env.BREW_MVP_PASS_A_STUB_ON_FAILURE === "1") {
        const stub = buildFallbackSubAnalyses(dataset);
        const stubErr = validateSubAnalysesShape(stub);
        if (!stubErr.length) {
          objA = { sub_analyses: stub };
          passAErr = [];
          passAUsedStub = true;
          l3a = { ...l3a, rawText: JSON.stringify(objA) };
          logRun("Pass A invalid JSON — using deterministic sub_analyses stub");
        }
      }

      if (passAErr.length) {
        if (LT) {
          LT.write("L4_passB_skipped", { reason: "Pass A validation failed", passAValidationErrors: passAErr });
        }
        l2b = null;
        l3b = { rawText: "", usage: null, layerId: "L3_passB_skipped", ok: false, durationMs: 0, maxTokens: 0 };
        l4 = {
          layerId: "L4_parse_validate",
          ok: false,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: 0,
          results: {},
          errors: [`passA: ${passAErr.join("; ")}`],
          parsedKeyCount: 0,
          passAErrors: passAErr,
          passBErrors: [],
        };
        mergedUsage = l3a.usage;
        layerTracePartial = buildTraceTwoPass(
          l0,
          l1,
          l2a,
          l3a,
          { layerId: "L2_passB_skipped", ok: false, durationMs: 0, userMessageCharCount: 0 },
          l3b,
          l4
        );
      } else {
        const passDelay = Number(process.env.BREW_MVP_PASS_DELAY_MS ?? 3000);
        if (passDelay > 0) {
          logRun(`[WAIT] ${passDelay}ms between Pass A and Pass B`);
          await sleep(passDelay);
        }
        logRun("[L2B] build pass-B synthesis messages");
        l2b = runLayer2PassBSynthesis(dataset, l1.verbalization, objA.sub_analyses);
        const mtB = Number(process.env.BREW_MVP_MAX_TOKENS_PASS_B || 1800);
        logRun(`[L3B] request completion maxTokens=${mtB}`);
        if (LT) LT.write("L2_passB_messages", { ...l2b, messages: LT.messagesSnapshot(l2b.messages) });
        l3b = await runLayer3WithFallback(openai, l2b.messages, {
          model,
          quietStream,
          maxTokens: mtB,
          layerTag: "L3_passB_completion",
        }, fallbackModel);
        logRun(
          `[L3B] ok=${l3b.ok} durationMs=${l3b.durationMs} completionTokens=${l3b.usage?.completionTokens ?? "n/a"}`
        );
        if (LT) LT.write("L3_passB_completion", LT.l3Snapshot(l3b));
        logRun("[L4] parse + validate two-pass outputs");
        l4 = runLayer4ParseValidateTwoPass(l3a.rawText, l3b.rawText);
        logRun(`[L4] ok=${l4.ok} parsedKeys=${l4.parsedKeyCount}`);
        if (LT) {
          LT.write("L4_parse_validate_two_pass", {
            ok: l4.ok,
            errors: l4.errors,
            passAErrors: l4.passAErrors,
            passBErrors: l4.passBErrors,
            parsedKeyCount: l4.parsedKeyCount,
            results: l4.results,
          });
        }
        mergedUsage = mergeUsage(l3a.usage, l3b.usage);
        layerTracePartial = buildTraceTwoPass(l0, l1, l2a, l3a, l2b, l3b, l4);
      }

      const ra = l3a.usage?.completionTokensDetails?.reasoningTokens ?? null;
      const rb = l3b.usage?.completionTokensDetails?.reasoningTokens ?? null;
      if (ra != null || rb != null) {
        process.stderr.write(`Reasoning tokens: passA=${ra ?? 0} passB=${rb ?? 0}\n`);
      }
      if (mergedUsage) {
        process.stderr.write(
          `Usage (merged): prompt=${mergedUsage.promptTokens} completion=${mergedUsage.completionTokens} total=${mergedUsage.totalTokens}\n`
        );
      }
    } else {
      logRun("[L2] build single-pass messages");
      l2 = runLayer2AssembleMessages(dataset, l1.verbalization);
      logRun(`[L2] ok=${l2.ok} userChars=${l2.userMessageCharCount}`);
      if (LT) LT.write("L2_messages", { ...l2, messages: LT.messagesSnapshot(l2.messages) });
      logRun("[L3] request single-pass completion");
      const maxTokensSingle = Number(process.env.BREW_MVP_MAX_TOKENS || 4000);
      l3 = await runLayer3WithFallback(openai, l2.messages, {
        model,
        quietStream,
        maxTokens: maxTokensSingle,
        layerTag: "L3_openai_completion",
      }, fallbackModel);
      logRun(
        `[L3] ok=${l3.ok} durationMs=${l3.durationMs} completionTokens=${l3.usage?.completionTokens ?? "n/a"}`
      );
      if (LT) LT.write("L3_completion", LT.l3Snapshot(l3));
      logRun("[L4] parse + validate single-pass output");
      l4 = runLayer4ParseValidate(l3.rawText);
      logRun(`[L4] ok=${l4.ok} parsedKeys=${l4.parsedKeyCount}`);
      if (LT) {
        LT.write("L4_parse_validate_single_pass_attempt1", {
          ok: l4.ok,
          errors: l4.errors,
          parsedKeyCount: l4.parsedKeyCount,
          results: l4.results,
        });
      }
      if (!l4.ok) {
        logRun("[L4] validation failed; retrying with strict JSON instruction");
        const retryMessages = [
          ...l2.messages,
          {
            role: "user",
            content:
              "Your previous response failed strict JSON schema validation. Return ONLY valid JSON with all required keys and enums exactly matching the schema. No markdown, no prose.",
          },
        ];
        const l3Retry = await runLayer3WithFallback(
          openai,
          retryMessages,
          {
            model,
            quietStream,
            maxTokens: maxTokensSingle,
            layerTag: "L3_openai_completion_retry_structured_output",
          },
          fallbackModel
        );
        if (LT) LT.write("L3_completion_retry", LT.l3Snapshot(l3Retry));
        const l4Retry = runLayer4ParseValidate(l3Retry.rawText);
        mergedUsage = mergeUsage(l3.usage, l3Retry.usage);
        if (l4Retry.ok) {
          logRun("[L4] structured-output retry succeeded");
          l3 = l3Retry;
          l4 = l4Retry;
        } else {
          logRun("[L4] structured-output retry failed; returning graceful validation error", {
            firstErrors: l4.errors.slice(0, 5),
            secondErrors: l4Retry.errors.slice(0, 5),
          });
          l3 = l3Retry;
          l4 = l4Retry;
        }
      }
      if (LT) {
        LT.write("L4_parse_validate_single_pass_final", {
          ok: l4.ok,
          errors: l4.errors,
          parsedKeyCount: l4.parsedKeyCount,
          results: l4.results,
        });
      }
      mergedUsage = mergedUsage || l3.usage;
      const reasoning = l3.usage?.completionTokensDetails?.reasoningTokens ?? null;
      if (reasoning != null) {
        process.stderr.write(`Reasoning tokens (usage.completionTokensDetails): ${reasoning}\n`);
      }
      if (l3.usage) {
        process.stderr.write(
          `Usage: prompt=${l3.usage.promptTokens} completion=${l3.usage.completionTokens} total=${l3.usage.totalTokens}\n`
        );
      }
      layerTracePartial = buildTraceSingle(l0, l1, l2, l3, l4);
    }
  } catch (err) {
    const msg = err?.message || String(err);
    logRun(`[ERROR] OpenAI / pipeline error: ${msg}`);
    const partialLayerOutputs = isVerboseEnvelope()
      ? buildLayerOutputsEnvelope({
          l0,
          dataset,
          l1,
          twoPass,
          l2a: typeof l2a !== "undefined" ? l2a : null,
          l2b: typeof l2b !== "undefined" ? l2b : null,
          l2: typeof l2 !== "undefined" ? l2 : null,
          l3a: typeof l3a !== "undefined" ? l3a : null,
          l3b: typeof l3b !== "undefined" ? l3b : null,
          l3: typeof l3 !== "undefined" ? l3 : null,
          l4: null,
        })
      : undefined;
    const failEnv = {
      buildInfo: {
        pipelineVersion: PROMPT_VERSION,
        note: "Run failed before a valid model JSON was produced (see apiError).",
      },
      run: {
        promptVersion: PROMPT_VERSION,
        model,
        datasetPath,
        traceId: currentTraceId,
        generatedAt: new Date().toISOString(),
        apiError: msg,
      },
      outputValidity: { ok: false, errors: [msg] },
      results: null,
      pipeline: {
        layerTrace: [],
        twoPass,
        ...(partialLayerOutputs ? { layerOutputs: partialLayerOutputs } : {}),
      },
    };
    if (LT) {
      try {
        failEnv.pipeline.layerTraceRunDir = LT.runDir;
        LT.write("L_pipeline_error", { apiError: msg, partial: true });
      } catch {
        /* ignore */
      }
    }
    if (outFile) {
      mkdirSync(dirname(outFile), { recursive: true });
      writeFileSync(outFile, JSON.stringify(failEnv, null, 2), "utf8");
      process.stderr.write(`Wrote error stub: ${outFile}\n`);
    }
    return { exitCode: 3, stderr: msg, envelope: failEnv };
  }

  process.stderr.write(`\nLayer 4 parsed keys: ${l4.parsedKeyCount}; ok=${l4.ok}\n`);
  if (l4.errors.length) {
    process.stderr.write(`Validation errors:\n${l4.errors.map((e) => `  - ${e}`).join("\n")}\n`);
  }

  const layerOutputs = isVerboseEnvelope()
    ? buildLayerOutputsEnvelope({
        l0,
        dataset,
        l1,
        twoPass,
        l2a: typeof l2a !== "undefined" ? l2a : null,
        l2b: typeof l2b !== "undefined" ? l2b : null,
        l2: typeof l2 !== "undefined" ? l2 : null,
        l3a: typeof l3a !== "undefined" ? l3a : null,
        l3b: typeof l3b !== "undefined" ? l3b : null,
        l3: typeof l3 !== "undefined" ? l3 : null,
        l4,
      })
    : undefined;

  const l5 = runLayer5BuildEnvelope({
    datasetPath,
    promptVersion: PROMPT_VERSION,
    model,
    usage: mergedUsage,
    results: l4.results,
    layerTrace: layerTracePartial,
    layerOutputs,
  });

  if (LT) {
    l5.envelope.pipeline.layerTraceRunDir = LT.runDir;
    try {
      LT.write("L5_envelope_preview", {
        outputValidity: { ok: l4.ok, errors: l4.errors },
        run: l5.envelope.run,
        resultsKeys: l5.envelope.results ? Object.keys(l5.envelope.results) : [],
        note: "Full envelope is the main --out file; this is a compact index for the trace folder.",
      });
    } catch {
      /* ignore */
    }
  }

  l5.envelope.outputValidity = {
    ok: l4.ok,
    errors: l4.errors,
  };
  l5.envelope.run.traceId = currentTraceId;
  l5.envelope.pipeline.twoPass = twoPass;
  if (passAUsedStub) {
    l5.envelope.pipeline.passAUsedStub = true;
  }
  if (twoPass && "passAErrors" in l4) {
    l5.envelope.pipeline.passAErrors = l4.passAErrors;
    l5.envelope.pipeline.passBErrors = l4.passBErrors;
  }

  if (!l4.ok) {
    l5.envelope.pipeline.promptNeedsReview = true;
    const prev =
      twoPass && l3a
        ? `passA_tail=${String(l3a.rawText || "").slice(-600)} passB_tail=${String(l3b?.rawText || "").slice(-600)}`
        : String((l3 && l3.rawText) || "").slice(0, 1200);
    l5.envelope.modelRawTextPreview = prev;
  }

  const slimOutForPersist = applySlimEnvelope(/** @type {any} */ (l5.envelope));
  if (outFile) {
    mkdirSync(dirname(outFile), { recursive: true });
    const toWrite = isVerboseEnvelope() ? l5.envelope : slimOutForPersist;
    writeFileSync(outFile, JSON.stringify(toWrite, null, 2), "utf8");
    logRun(`[L5] wrote output ${outFile}${isVerboseEnvelope() ? " (verbose)" : " (compact)"}`);
  }
  if (isMongoPersistenceEnabled()) {
    try {
      const persistRes = await persistRunToMongo({
        datasetPath,
        envelope: l5.envelope,
        slimOutput: slimOutForPersist,
      });
      logRun(`[MongoDB] persisted=${persistRes.persisted}${persistRes.analysisId ? ` analysisId=${persistRes.analysisId}` : ""}`);
    } catch (e) {
      logRun(`[MongoDB] persist failed: ${e?.message || e}`);
    }
  }

  logRun(`[END] dataset=${datasetPath} ok=${l4.ok} exitCode=${l4.ok ? 0 : 2}`);
  return { exitCode: l4.ok ? 0 : 2, envelope: l5.envelope };
}

const apiKey =
  process.env.OPENAI_API_KEY ||
  process.env.openai_api_key ||
  process.env.OUTSPARK_OPENAI_STAGING_API_KEY;
if (!apiKey) {
  console.error(
    "Set OPENAI_API_KEY (or openai_api_key / OUTSPARK_OPENAI_STAGING_API_KEY) in the environment."
  );
  process.exit(1);
}

const datasetPaths = resolveDatasetPaths();
const singleOut = parseOutArg();
const outDir = parseOutDirArg();
const resolvedBaseURL = resolveOpenAIBaseURL();
const openai = new OpenAI({
  apiKey,
  ...(resolvedBaseURL ? { baseURL: resolvedBaseURL } : {}),
});

await registerBuiltInPromptsToMongo();

let worstExit = 0;
const batchDelayMs = Number(process.env.BREW_MVP_BATCH_DELAY_MS ?? 12000);
for (let i = 0; i < datasetPaths.length; i++) {
  if (i > 0 && batchDelayMs > 0) {
    logRun(`[WAIT] ${batchDelayMs}ms before next dataset`);
    await sleep(batchDelayMs);
  }
  const datasetPath = datasetPaths[i];
  const outFile = resolveOutFileFor(datasetPath, {
    total: datasetPaths.length,
    singleOut,
    outDir,
  });
  process.stderr.write(
    `\n${"=".repeat(64)}\n[${i + 1}/${datasetPaths.length}] ${datasetPath}\n${outFile ? `→ ${outFile}` : "→ stdout (streamed)"}\n${"=".repeat(64)}\n`
  );
  const r = await runPipelineOnce(datasetPath, outFile, openai);
  worstExit = Math.max(worstExit, r.exitCode);
}

process.exit(worstExit);
