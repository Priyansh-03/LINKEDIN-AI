/**
 * Optional scoring knobs (Profile Studio sends `dataset.scoringTuning`).
 * Defaults mirror previous hard-coded constants in content-analyzer-flow.mjs.
 */

function clampNum(min, v, max) {
  return Math.max(min, Math.min(max, v));
}

export const POST_TUNING_DEFAULTS = {
  coherence_identity_weight: 0.5,
  coherence_behavior_weight: 0.3,
  /** Added to coherence as: hookStrength (1–10) × this value (was 10 × 0.2 = 2). */
  coherence_hook_strength_scale: 2,
  demonstrated_behavior_score_weight: 0.6,
  demonstrated_behavior_niche_weight: 0.4,
  raw_coherence_multiplier: 0.45,
  raw_demonstrated_multiplier: 0.25,
  raw_saveability_multiplier: 6,
  raw_variety_multiplier: 2,
  killer_penalty_per_flag: 6,
  niche_mismatch_raw_multiplier: 0.52,
  niche_mismatch_raw_subtract: 12,
  severe_cap_niche_track_mismatch: 32,
  severe_cap_other_mismatch: 42,
};

export const PROFILE_TUNING_DEFAULTS = {
  headline_overall_multiplier: 1,
  headline_overall_bias: 0,
  about_overall_multiplier: 1,
  about_overall_bias: 0,
};

function mergeNumberDefaults(defaults, partial) {
  const o = { ...defaults };
  if (!partial || typeof partial !== "object") return o;
  for (const k of Object.keys(defaults)) {
    const v = partial[k];
    const n = Number(v);
    if (Number.isFinite(n)) o[k] = n;
  }
  return o;
}

/** @param {Record<string, unknown>|null|undefined} partial */
export function mergePostTuning(partial) {
  return mergeNumberDefaults(POST_TUNING_DEFAULTS, partial);
}

/** @param {Record<string, unknown>|null|undefined} partial */
export function mergeProfileTuning(partial) {
  return mergeNumberDefaults(PROFILE_TUNING_DEFAULTS, partial);
}

/**
 * After full slim pipeline, nudge displayed headline/about 0–100 scores (experiment / QA only).
 * @param {Record<string, unknown>} out
 * @param {Record<string, unknown>|null|undefined} tuningPartial
 */
export function applyProfileTuningToSlimOutput(out, tuningPartial) {
  if (!out || typeof out !== "object") return;
  const t = mergeProfileTuning(tuningPartial);
  const sa = out.sub_analyses;
  if (!sa || typeof sa !== "object") return;

  const tuneBlock = (block, mult, bias, scoreKey) => {
    if (!block || typeof block !== "object") return;
    const raw = Number(block[scoreKey]);
    if (!Number.isFinite(raw)) return;
    block[scoreKey] = clampNum(0, Math.round(raw * mult + bias), 100);
  };

  tuneBlock(sa.headline, t.headline_overall_multiplier, t.headline_overall_bias, "overall_headline_score");
  tuneBlock(sa.about, t.about_overall_multiplier, t.about_overall_bias, "overall_about_score");
}
