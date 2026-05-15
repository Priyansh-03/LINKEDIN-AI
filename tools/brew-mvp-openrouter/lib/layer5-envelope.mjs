/**
 * Layer 5 — output envelope: PRD scope flags + run metadata + layer trace + results.
 */

export const LAYER5_ID = "L5_write_envelope";

/**
 * @param {object} params
 * @param {object[]} params.layerTrace — L0..L4 rows; L5 row appended here
 */
export function runLayer5BuildEnvelope({
  datasetPath,
  promptVersion,
  model,
  usage,
  results,
  layerTrace,
  layerOutputs,
}) {
  const startedAt = new Date().toISOString();
  const t0 = performance.now();

  const layer5Row = {
    layerId: LAYER5_ID,
    ok: true,
    durationMs: 0,
  };

  const envelope = {
    buildInfo: {
      pipelineVersion: promptVersion,
      layersImplementedInRepo: [
        "L0_ingest_dataset — read + validate dataset.json",
        "L1_verbalize_context — deterministic verbalization (retrieval analog)",
        "L2/L3 default: two-pass PRD — Pass A sub_analyses (A–F) + Pass B synthesis (G + metadata + projections)",
        "L2/L3 optional single-pass — BREW_MVP_TWO_PASS=0 + higher BREW_MVP_MAX_TOKENS",
        "L4_parse_validate — JSON parse + PRD §7 shape validation (merge when two-pass)",
        "L5_envelope — this file shape + optional write",
      ],
      interpretScopeFlags:
        "linkedInRetrieval_layer1=false: LinkedIn's internal retrieval is not run in-repo. prdBehaviorModule/prdContentModule=false: separate PRD modules 2–3 not implemented as standalone analyzers; behavior JSON may still inform the Profile prompt. Profile output follows PRD §7 JSON shape (validated at L4).",
      linkedInRetrieval_layer1: false,
      rankingAnalog_llm_layer2: true,
      prdProfileModule_fullJsonSchema: true,
      prdBehaviorModule: false,
      prdContentModule: false,
      note: "Profile Analyzer output: analysis_metadata, sub_analyses (A–F), composite_classification (G), top_issues, improvement_projection, paper_grounded_disclaimer — see PRD §7.4–7.5 and lib/prompts/profile-analyzer-prd-system.txt.",
    },
    prdReference: "360Brew_Analyzer_PRD_v1.md — Profile Analyzer JSON (§7.x OUTPUT FORMAT) + MVP.md module table",
    pipeline: {
      layerTrace: [...(layerTrace || []), { ...layer5Row, durationMs: 0 }],
      ...(layerOutputs ? { layerOutputs } : {}),
    },
    run: {
      promptVersion,
      model,
      datasetPath,
      generatedAt: new Date().toISOString(),
      usage: usage
        ? {
            promptTokens: usage.promptTokens,
            completionTokens: usage.completionTokens,
            totalTokens: usage.totalTokens,
            reasoningTokens: usage.completionTokensDetails?.reasoningTokens ?? null,
          }
        : null,
    },
    results,
  };

  const finishedAt = new Date().toISOString();
  const durationMs = Math.round(performance.now() - t0);
  layer5Row.durationMs = durationMs;
  envelope.pipeline.layerTrace[envelope.pipeline.layerTrace.length - 1] = { ...layer5Row };

  return {
    layerId: LAYER5_ID,
    ok: true,
    startedAt,
    finishedAt,
    durationMs,
    envelope,
  };
}
