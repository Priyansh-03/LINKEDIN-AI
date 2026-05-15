/**
 * Build `pipeline.layerOutputs` for the result envelope — one object per pipeline stage with full layer payloads.
 */

function safeMessages(messages) {
  if (!Array.isArray(messages)) return null;
  return messages.map((m) => ({
    role: m.role,
    charCount: String(m.content || "").length,
    content: String(m.content || ""),
  }));
}

/**
 * @param {object} p
 */
export function buildLayerOutputsEnvelope(p) {
  const {
    l0,
    dataset,
    l1,
    twoPass,
    l2a,
    l2b,
    l2,
    l3a,
    l3b,
    l3,
    l4,
  } = p;

  const L0 = {
    layerId: l0.layerId,
    ok: l0.ok,
    durationMs: l0.durationMs,
    errors: l0.errors,
    output: {
      schemaVersion: dataset?.schemaVersion,
      description: dataset?.description,
      topLevelKeys: dataset ? Object.keys(dataset) : [],
      profile: dataset?.profile
        ? {
            name: dataset.profile.name,
            headline: dataset.profile.headline,
            location: dataset.profile.location,
          }
        : null,
      hasMetricsSummary: Boolean(dataset?.metricsSummary),
      hasBehaviorSignals: Boolean(dataset?.behaviorSignals),
    },
  };

  const L1 = {
    layerId: l1.layerId,
    ok: l1.ok,
    durationMs: l1.durationMs,
    output: {
      stats: l1.stats,
      verbalization: l1.verbalization,
    },
  };

  let L2_prompt_assembly;
  let L3_model_completion;

  if (twoPass) {
    L2_prompt_assembly = {
      mode: "two_pass",
      passA: l2a
        ? {
            layerId: l2a.layerId,
            durationMs: l2a.durationMs,
            messages: safeMessages(l2a.messages),
          }
        : null,
      passB: l2b
        ? {
            layerId: l2b.layerId,
            durationMs: l2b.durationMs,
            messages: safeMessages(l2b.messages),
          }
        : null,
    };
    L3_model_completion = {
      mode: "two_pass",
      passA: l3a
        ? {
            layerId: l3a.layerId,
            ok: l3a.ok,
            durationMs: l3a.durationMs,
            maxTokens: l3a.maxTokens,
            usage: l3a.usage || null,
            output: { rawResponseText: l3a.rawText ?? "" },
          }
        : null,
      passB: l3b
        ? {
            layerId: l3b.layerId,
            ok: l3b.ok,
            durationMs: l3b.durationMs,
            maxTokens: l3b.maxTokens,
            usage: l3b.usage || null,
            output: { rawResponseText: l3b.rawText ?? "" },
          }
        : null,
    };
  } else {
    L2_prompt_assembly = {
      mode: "single_pass",
      messages: l2 ? safeMessages(l2.messages) : null,
    };
    L3_model_completion = {
      mode: "single_pass",
      layerId: l3?.layerId,
      ok: l3?.ok,
      durationMs: l3?.durationMs,
      maxTokens: l3?.maxTokens,
      usage: l3?.usage || null,
      output: { rawResponseText: l3?.rawText ?? "" },
    };
  }

  const base = {
    L0_ingest_dataset: L0,
    L1_verbalize_context: L1,
    L2_prompt_assembly: L2_prompt_assembly,
    L3_model_completion: L3_model_completion,
  };

  if (!l4) return base;

  const L4 = {
    layerId: l4.layerId,
    ok: l4.ok,
    durationMs: l4.durationMs,
    output: {
      parsedKeyCount: l4.parsedKeyCount,
      validationErrors: l4.errors,
      passAErrors: l4.passAErrors ?? [],
      passBErrors: l4.passBErrors ?? [],
      resultsTopLevelKeys: l4.results && typeof l4.results === "object" ? Object.keys(l4.results) : [],
    },
  };

  return {
    ...base,
    L4_parse_validate: L4,
  };
}
