import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import OpenAI from "openai";
import { runLayer1Verbalize } from "../lib/layer1-verbalize.mjs";
import {
  runLayer2PassASubAnalyses,
  runLayer2PassBSynthesis,
} from "../lib/layer2-two-pass.mjs";
import { runLayer3StreamCompletion } from "../lib/layer3-stream-completion.mjs";
import {
  parseJsonObject,
  runLayer4ParseValidateTwoPass,
  validateSubAnalysesShape,
} from "../lib/layer4-parse-results.mjs";
import { buildFallbackSubAnalyses } from "../lib/pass-a-fallback-subanalyses.mjs";
import { normalizeConfidenceKey, toClaimTypeFromConfidence } from "../lib/confidence-taxonomy.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(join(__dirname, ".."));
const casesPath = process.env.BREW_MVP_PROMPT_CASES || join(rootDir, "tests", "prompt-baseline-cases.json");
const outputDir = process.env.BREW_MVP_PROMPT_TEST_OUTPUT_DIR || join(rootDir, "..", "..", "output");
const model = process.env.BREW_MVP_MODEL || "gpt-4o-mini";
const baselinePath = process.env.BREW_MVP_PROMPT_PREVIOUS_METRICS || join(outputDir, "prompt-quality-latest.json");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const runOutPath = join(outputDir, `prompt-quality-${timestamp}.json`);
const latestOutPath = join(outputDir, "prompt-quality-latest.json");
const enabled = process.env.BREW_MVP_PROMPT_TEST_ENABLED === "1";
const maxCases = Math.max(1, Number(process.env.BREW_MVP_PROMPT_TEST_MAX_CASES || 3));
const maxTotalCalls = Math.max(1, Number(process.env.BREW_MVP_PROMPT_TEST_MAX_CALLS || maxCases));
const maxTokensPerCase = Math.max(300, Number(process.env.BREW_MVP_PROMPT_TEST_MAX_TOKENS || 900));
const maxTotalTokens = Math.max(maxTokensPerCase, Number(process.env.BREW_MVP_PROMPT_TEST_MAX_TOTAL_TOKENS || maxTokensPerCase * maxCases));
const timeoutMsPerCase = Math.max(5000, Number(process.env.BREW_MVP_PROMPT_TEST_TIMEOUT_MS || 45000));
const maxValidationRetries = Math.max(0, Number(process.env.BREW_MVP_PROMPT_TEST_MAX_VALIDATION_RETRIES || 1));
const maxTokensPassA = Math.max(400, Number(process.env.BREW_MVP_PROMPT_TEST_MAX_TOKENS_PASS_A || 2200));
const maxTokensPassB = Math.max(300, Number(process.env.BREW_MVP_PROMPT_TEST_MAX_TOKENS_PASS_B || 1800));
const allowPassAStub = process.env.BREW_MVP_PROMPT_TEST_ALLOW_PASS_A_STUB !== "0";

function resolveOpenAIBaseURL() {
  const raw = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE;
  if (!raw) return undefined;
  const trimmed = String(raw).trim().replace(/\/+$/, "");
  if (!trimmed) return undefined;
  return /\/v\d+$/i.test(trimmed) ? trimmed : `${trimmed}/v1`;
}

function loadCases() {
  const data = JSON.parse(readFileSync(casesPath, "utf8"));
  if (!Array.isArray(data) || data.length < 10 || data.length > 20) {
    throw new Error("Prompt baseline cases must be an array with 10-20 inputs.");
  }
  return data.slice(0, maxCases);
}

function countConfidenceAccuracy(results) {
  let total = 0;
  let consistent = 0;
  for (const r of results) {
    const rows = Array.isArray(r?.parsed?.top_issues) ? r.parsed.top_issues : [];
    for (const row of rows) {
      total += 1;
      const k = normalizeConfidenceKey(row?.confidence);
      if (!k) continue;
      if (!row?.claim_type || row.claim_type === toClaimTypeFromConfidence(row.confidence)) {
        consistent += 1;
      }
    }
  }
  return { total, consistent, pct: total ? Number(((consistent / total) * 100).toFixed(2)) : null };
}

function safeReadPreviousMetrics() {
  try {
    return JSON.parse(readFileSync(baselinePath, "utf8"));
  } catch {
    return null;
  }
}

function estimatePromptTokens(messages) {
  const text = (Array.isArray(messages) ? messages : [])
    .map((m) => `${m?.role || ""}\n${m?.content || ""}`)
    .join("\n");
  // Conservative heuristic: ~4 chars/token, padded by 20%
  return Math.ceil((text.length / 4) * 1.2);
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Case timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

async function main() {
  if (!enabled) {
    throw new Error(
      "Prompt quality test calls are disabled by default. Set BREW_MVP_PROMPT_TEST_ENABLED=1 to run paid API checks."
    );
  }
  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env.openai_api_key ||
    process.env.OUTSPARK_OPENAI_STAGING_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY (or compatible env var) for prompt quality tests.");
  }

  const openai = new OpenAI({
    apiKey,
    ...(resolveOpenAIBaseURL() ? { baseURL: resolveOpenAIBaseURL() } : {}),
  });
  const cases = loadCases();
  const perCase = [];
  let totalCalls = 0;
  let totalTokensUsed = 0;

  for (const c of cases) {
    if (totalCalls >= maxTotalCalls) {
      break;
    }
    if (totalTokensUsed >= maxTotalTokens) {
      perCase.push({
        id: c.id,
        ok: false,
        errors: [`Skipped due to max total token budget (${maxTotalTokens}) reached.`],
        parsed: null,
        usage: null,
        manual_review: {
          recommendation_actionability_score_1_to_5: null,
          confidence_tag_accuracy_score_1_to_5: null,
          user_satisfaction_score_1_to_5: null,
          reviewer_notes: "",
        },
      });
      continue;
    }
    const dataset = c.dataset;
    const l1 = runLayer1Verbalize(dataset);
    const l2a = runLayer2PassASubAnalyses(dataset, l1.verbalization);
    const projectedPassA = estimatePromptTokens(l2a.messages) + maxTokensPassA;
    if (totalTokensUsed + projectedPassA > maxTotalTokens) {
      perCase.push({
        id: c.id,
        ok: false,
        errors: [
          `Skipped: projected Pass A usage (${projectedPassA}) exceeds remaining budget (${Math.max(0, maxTotalTokens - totalTokensUsed)}).`,
        ],
        parsed: null,
        usage: null,
        manual_review: {
          recommendation_actionability_score_1_to_5: null,
          confidence_tag_accuracy_score_1_to_5: null,
          user_satisfaction_score_1_to_5: null,
          reviewer_notes: "",
        },
      });
      continue;
    }
    totalCalls += 1;
    /** @type {any} */ let l3a;
    /** @type {any} */ let l3b;
    /** @type {any} */ let l4;
    let retriesUsed = 0;
    let passAUsedStub = false;
    try {
      l3a = await withTimeout(
        runLayer3StreamCompletion(openai, l2a.messages, {
          model,
          quietStream: true,
          maxTokens: maxTokensPassA,
          layerTag: `prompt_quality_${c.id}_pass_a`,
        }),
        timeoutMsPerCase
      );
      totalTokensUsed += Number(l3a?.usage?.totalTokens || 0);
      const passAObj = parseJsonObject(l3a.rawText);
      const passAErrors = validateSubAnalysesShape(passAObj?.sub_analyses);
      if (passAErrors.length && allowPassAStub) {
        passAObj.sub_analyses = buildFallbackSubAnalyses(dataset);
        passAUsedStub = true;
      } else if (passAErrors.length) {
        throw new Error(`Pass A validation failed: ${passAErrors.slice(0, 8).join("; ")}`);
      }

      const l2b = runLayer2PassBSynthesis(dataset, l1.verbalization, passAObj.sub_analyses);
      const projectedPassB = estimatePromptTokens(l2b.messages) + maxTokensPassB;
      if (totalTokensUsed + projectedPassB > maxTotalTokens) {
        throw new Error(
          `Skipped: projected Pass B usage (${projectedPassB}) exceeds remaining budget (${Math.max(
            0,
            maxTotalTokens - totalTokensUsed
          )}).`
        );
      }
      if (totalCalls >= maxTotalCalls) {
        throw new Error(`Skipped: max total calls (${maxTotalCalls}) reached before Pass B.`);
      }
      totalCalls += 1;
      l3b = await withTimeout(
        runLayer3StreamCompletion(openai, l2b.messages, {
          model,
          quietStream: true,
          maxTokens: maxTokensPassB,
          layerTag: `prompt_quality_${c.id}_pass_b`,
        }),
        timeoutMsPerCase
      );
      totalTokensUsed += Number(l3b?.usage?.totalTokens || 0);
      const passATextForValidation = passAUsedStub
        ? JSON.stringify({ sub_analyses: passAObj.sub_analyses })
        : l3a.rawText;
      l4 = runLayer4ParseValidateTwoPass(passATextForValidation, l3b.rawText);

      while (!l4.ok && retriesUsed < maxValidationRetries && totalCalls < maxTotalCalls) {
        const retryMessages = [
          ...(l2b?.messages || []),
          {
            role: "user",
            content:
              "Your previous synthesis failed strict validation. Return ONLY valid JSON for pass-B synthesis with exact enums and required keys. No markdown.",
          },
        ];
        const retryProjected = estimatePromptTokens(retryMessages) + maxTokensPassB;
        if (totalTokensUsed + retryProjected > maxTotalTokens) break;
        totalCalls += 1;
        retriesUsed += 1;
        const l3bRetry = await withTimeout(
          runLayer3StreamCompletion(openai, retryMessages, {
            model,
            quietStream: true,
            maxTokens: maxTokensPassB,
            layerTag: `prompt_quality_${c.id}_pass_b_retry_${retriesUsed}`,
          }),
          timeoutMsPerCase
        );
        totalTokensUsed += Number(l3bRetry?.usage?.totalTokens || 0);
        const l4Retry = runLayer4ParseValidateTwoPass(passATextForValidation, l3bRetry.rawText);
        l3b = l3bRetry;
        l4 = l4Retry;
      }
    } catch (e) {
      perCase.push({
        id: c.id,
        ok: false,
        errors: [e?.message || String(e)],
        parsed: null,
        usage: null,
        manual_review: {
          recommendation_actionability_score_1_to_5: null,
          confidence_tag_accuracy_score_1_to_5: null,
          user_satisfaction_score_1_to_5: null,
          reviewer_notes: "",
        },
      });
      continue;
    }
    perCase.push({
      id: c.id,
      ok: l4.ok,
      errors: l4.errors || [],
      parsed: l4.results || null,
      usage: {
        pass_a: l3a?.usage || null,
        pass_b: l3b?.usage || null,
      },
      retries_used: retriesUsed,
      pass_a_used_stub: passAUsedStub,
      manual_review: {
        recommendation_actionability_score_1_to_5: null,
        confidence_tag_accuracy_score_1_to_5: null,
        user_satisfaction_score_1_to_5: null,
        reviewer_notes: "",
      },
    });
  }

  const evaluatedCases = perCase.filter((x) => !(x.errors || []).some((e) => String(e).startsWith("Skipped")));
  const skippedCases = perCase.length - evaluatedCases.length;
  const passed = evaluatedCases.filter((x) => x.ok).length;
  const schemaAdherence =
    evaluatedCases.length > 0 ? Number(((passed / evaluatedCases.length) * 100).toFixed(2)) : null;
  const confidence = countConfidenceAccuracy(perCase);
  const prev = safeReadPreviousMetrics();
  const regression = prev
    ? {
        schema_adherence_delta_pct: Number((schemaAdherence - Number(prev?.metrics?.schema_adherence_pct || 0)).toFixed(2)),
        confidence_accuracy_delta_pct: confidence.pct == null
          ? null
          : Number((confidence.pct - Number(prev?.metrics?.confidence_tag_accuracy_pct || 0)).toFixed(2)),
      }
    : null;

  const report = {
    run_meta: {
      generated_at: new Date().toISOString(),
      model,
      prompt_version: "v1.0",
      cases_count: perCase.length,
      target_schema_adherence_pct: 99,
      guardrails: {
        max_cases: maxCases,
        max_total_calls: maxTotalCalls,
        max_tokens_per_case: maxTokensPerCase,
        max_tokens_pass_a: maxTokensPassA,
        max_tokens_pass_b: maxTokensPassB,
        max_total_tokens: maxTotalTokens,
        timeout_ms_per_case: timeoutMsPerCase,
        max_validation_retries: maxValidationRetries,
      },
      usage: {
        total_calls_made: totalCalls,
        total_tokens_used: totalTokensUsed,
        evaluated_cases: evaluatedCases.length,
        skipped_cases: skippedCases,
      },
    },
    metrics: {
      schema_adherence_pct: schemaAdherence,
      confidence_tag_accuracy_pct: confidence.pct,
      confidence_tag_samples: confidence.total,
      actionability_manual_review_required: true,
      user_satisfaction_manual_review_required: true,
      meets_schema_target: schemaAdherence != null ? schemaAdherence >= 99 : false,
    },
    regression_vs_previous: regression,
    cases: perCase,
  };

  mkdirSync(dirname(runOutPath), { recursive: true });
  writeFileSync(runOutPath, JSON.stringify(report, null, 2), "utf8");
  writeFileSync(latestOutPath, JSON.stringify(report, null, 2), "utf8");

  const adherenceText = schemaAdherence == null ? "n/a (no evaluated cases)" : `${schemaAdherence}%`;
  process.stdout.write(
    `Prompt quality report written:\n- ${runOutPath}\n- ${latestOutPath}\nSchema adherence: ${adherenceText}\n`
  );
}

main().catch((e) => {
  process.stderr.write(`Prompt quality tests failed: ${e?.message || e}\n`);
  process.exit(1);
});
