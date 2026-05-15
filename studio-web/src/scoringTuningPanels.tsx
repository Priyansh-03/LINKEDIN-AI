/**
 * Profile Studio — expose brew MVP scoring knobs for local QA (values sent as dataset.scoringTuning).
 * Defaults must match tools/brew-mvp-openrouter/lib/scoring-tuning.mjs
 */

export const LS_SCORING_TUNING = "studio_scoring_tuning_v1";

export type PostTuningKey = keyof typeof POST_TUNING_DEFAULTS;
export type ProfileTuningKey = keyof typeof PROFILE_TUNING_DEFAULTS;

export const POST_TUNING_DEFAULTS = {
  coherence_identity_weight: 0.5,
  coherence_behavior_weight: 0.3,
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
} as const;

export const PROFILE_TUNING_DEFAULTS = {
  headline_overall_multiplier: 1,
  headline_overall_bias: 0,
  about_overall_multiplier: 1,
  about_overall_bias: 0,
} as const;

export type ScoringTuningState = {
  post: Record<string, number>;
  profile: Record<string, number>;
};

export const POST_TUNING_HELP: Record<
  keyof typeof POST_TUNING_DEFAULTS,
  { title: string; line: string; example: string }
> = {
  coherence_identity_weight: {
    title: "Coherence — niche overlap",
    line: "How much your declared niche matching the draft text affects the internal coherence score.",
    example: "Raise toward 0.7 if niche fit should dominate; lower if you want behavior to matter more.",
  },
  coherence_behavior_weight: {
    title: "Coherence — behavior score",
    line: "Blend weight for your logged behavior strength (0–100) inside coherence.",
    example: "Bump to 0.45 if comments/reactions history should steer the draft score more.",
  },
  coherence_hook_strength_scale: {
    title: "Coherence — hook strength scale",
    line: "Each hook-strength point (1–10) is multiplied by this before blending into coherence.",
    example: "Default 2 equals old 10×0.2; try 3 to reward a punchy opener harder.",
  },
  demonstrated_behavior_score_weight: {
    title: "Behavior blend — overall behavior score",
    line: "Weight on the analyzer’s 0–100 behavior score when building “demonstrated alignment”.",
    example: "0.7 vs 0.6 shifts how much your activity score pulls the draft.",
  },
  demonstrated_behavior_niche_weight: {
    title: "Behavior blend — niche coherence ratio",
    line: "Weight on in-niche vs off-niche activity ratio blended with behavior score.",
    example: "Raise to 0.5 if off-niche comments should punish the draft more.",
  },
  raw_coherence_multiplier: {
    title: "Composite — coherence term",
    line: "Multiplier on coherence (0–100) inside the draft quality raw sum before caps.",
    example: "Try 0.55 to make niche+hook coherence move the big number more.",
  },
  raw_demonstrated_multiplier: {
    title: "Composite — demonstrated alignment term",
    line: "Multiplier on the 0–100 demonstrated alignment inside the raw draft score.",
    example: "Lower to 0.15 if you want saves/variety to matter more than behavior fit.",
  },
  raw_saveability_multiplier: {
    title: "Composite — saveability term",
    line: "Each save-pattern point (1–10) is multiplied by this in the raw sum (big lever).",
    example: "Default 6: raising to 8 makes checklists/lists swing the score faster.",
  },
  raw_variety_multiplier: {
    title: "Composite — variety term",
    line: "Multiplier on the 1–10 variety score (hook/format repetition vs history).",
    example: "Try 3 if repeating the same hook archetype should hurt more.",
  },
  killer_penalty_per_flag: {
    title: "Composite — reach-killer penalty",
    line: "Points subtracted per reach-killer flag (links in body, bait phrases, etc.).",
    example: "Increase to 10 to slam posts that trip hygiene rules.",
  },
  niche_mismatch_raw_multiplier: {
    title: "Niche track mismatch — shrink raw",
    line: "When sales-vs-ML track clashes with declared niche, raw score is multiplied by this.",
    example: "0.4 makes off-track drafts collapse faster before caps.",
  },
  niche_mismatch_raw_subtract: {
    title: "Niche track mismatch — extra subtract",
    line: "Flat points removed after the mismatch multiplier on raw score.",
    example: "Raise to 18 for harsher punishment on GTM drafts under an AIML niche.",
  },
  severe_cap_niche_track_mismatch: {
    title: "Cap — niche track mismatch",
    line: "Hard ceiling on the 0–100 composite when track mismatch fires.",
    example: "Lower to 25 so bad-track posts never show a mid score.",
  },
  severe_cap_other_mismatch: {
    title: "Cap — other strong mismatch",
    line: "Ceiling when niche text overlap is very low but not the sales/ML track flag.",
    example: "Use 35 to keep weak-but-not-sales posts below a visible bar.",
  },
};

export const PROFILE_TUNING_HELP: Record<
  keyof typeof PROFILE_TUNING_DEFAULTS,
  { title: string; line: string; example: string }
> = {
  headline_overall_multiplier: {
    title: "Headline overall score multiplier",
    line: "After the LLM returns the headline 0–100 score, multiply it by this (then add bias).",
    example: "1.1 boosts every headline audit run by ~10% for sensitivity testing.",
  },
  headline_overall_bias: {
    title: "Headline overall score bias",
    line: "Flat points added after the multiplier (clamped 0–100).",
    example: "+5 nudges every headline score up five points to see UI thresholds.",
  },
  about_overall_multiplier: {
    title: "About overall score multiplier",
    line: "Same as headline, applied to the About section’s overall 0–100 score after the model run.",
    example: "0.9 simulates stricter grading without re-calling the LLM.",
  },
  about_overall_bias: {
    title: "About overall score bias",
    line: "Flat shift on About overall after multiplier.",
    example: "-3 to see how Results cards look when About is slightly penalized.",
  },
};

export function defaultScoringTuningState(): ScoringTuningState {
  return {
    post: { ...POST_TUNING_DEFAULTS } as Record<string, number>,
    profile: { ...PROFILE_TUNING_DEFAULTS } as Record<string, number>,
  };
}

export function loadScoringTuningState(): ScoringTuningState {
  try {
    const raw = localStorage.getItem(LS_SCORING_TUNING);
    if (!raw) return defaultScoringTuningState();
    const j = JSON.parse(raw) as Partial<ScoringTuningState>;
    const base = defaultScoringTuningState();
    if (j.post && typeof j.post === "object") {
      for (const k of Object.keys(base.post)) {
        const n = Number((j.post as Record<string, unknown>)[k]);
        if (Number.isFinite(n)) base.post[k] = n;
      }
    }
    if (j.profile && typeof j.profile === "object") {
      for (const k of Object.keys(base.profile)) {
        const n = Number((j.profile as Record<string, unknown>)[k]);
        if (Number.isFinite(n)) base.profile[k] = n;
      }
    }
    return base;
  } catch {
    return defaultScoringTuningState();
  }
}

export function saveScoringTuningState(s: ScoringTuningState) {
  try {
    localStorage.setItem(LS_SCORING_TUNING, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

function TuningRow({
  label,
  value,
  onChange,
  help,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  help: { title: string; line: string; example: string };
}) {
  return (
    <div className="scoringTuningRow">
      <div className="scoringTuningRowHead">
        <label className="scoringTuningLab">{help.title}</label>
        <input
          className="scoringTuningNum"
          type="number"
          step="any"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
      <p className="scoringTuningMeta">
        <strong>{label}</strong> — {help.line} <em>Example: {help.example}</em>
      </p>
    </div>
  );
}

export function PostScoringTuningPanel({
  value,
  onChange,
  onReset,
}: {
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  onReset: () => void;
}) {
  const set = (key: string, n: number) => onChange({ ...value, [key]: n });
  const postKeys = Object.keys(POST_TUNING_DEFAULTS) as PostTuningKey[];
  return (
    <section className="liSectionCard scoringTuningCard" style={{ gridColumn: "1 / -1" }}>
      <div className="liSectionHead">
        <h3>Draft post — scoring weights (QA)</h3>
        <button type="button" className="btn btnGhost" onClick={onReset}>
          Reset to defaults
        </button>
      </div>
      <p className="mutedSmall" style={{ marginTop: 0 }}>
        These numbers are sent as <code>scoringTuning.post</code> with your draft run. They change the deterministic draft scorer only (not the LLM profile pass). Adjust, hit <strong>Analyze draft</strong>, compare Results.
      </p>
      <div className="scoringTuningGrid">
        {postKeys.map((key) => (
          <TuningRow
            key={key}
            label={key}
            value={value[key] ?? (POST_TUNING_DEFAULTS as Record<string, number>)[key]}
            onChange={(n) => set(key, n)}
            help={POST_TUNING_HELP[key]}
          />
        ))}
      </div>
    </section>
  );
}

export function ProfileScoringTuningPanel({
  value,
  onChange,
  onReset,
}: {
  value: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  onReset: () => void;
}) {
  const set = (key: string, n: number) => onChange({ ...value, [key]: n });
  const profileKeys = Object.keys(PROFILE_TUNING_DEFAULTS) as ProfileTuningKey[];
  return (
    <section className="liSectionCard scoringTuningCard" style={{ gridColumn: "1 / -1" }}>
      <div className="liSectionHead">
        <h3>Headline &amp; About — display tuning (QA)</h3>
        <button type="button" className="btn btnGhost" onClick={onReset}>
          Reset to defaults
        </button>
      </div>
      <p className="mutedSmall" style={{ marginTop: 0 }}>
        Applied <strong>after</strong> the model returns headline/about scores: multiplier then bias (0–100 clamp). Sent as <code>scoringTuning.profile</code> on <strong>Run profile analysis</strong> (and on draft runs with the same saved values).
      </p>
      <div className="scoringTuningGrid">
        {profileKeys.map((key) => (
          <TuningRow
            key={key}
            label={key}
            value={value[key] ?? (PROFILE_TUNING_DEFAULTS as Record<string, number>)[key]}
            onChange={(n) => set(key, n)}
            help={PROFILE_TUNING_HELP[key]}
          />
        ))}
      </div>
    </section>
  );
}
