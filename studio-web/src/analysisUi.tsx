/** Structured rendering for analyzer output and saved run snapshots (no raw JSON in main view). */

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function isEmptySnapshot(s: unknown): boolean {
  if (s == null) return true;
  if (typeof s !== "object" || Array.isArray(s)) return true;
  return Object.keys(s as Record<string, unknown>).length === 0;
}

function formatAxisLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function toConfidenceEmoji(c: unknown): string {
  const s = String(c || "").toLowerCase();
  if (s === "high" || s === "green") return "🟢";
  if (s === "medium" || s === "yellow") return "🟡";
  if (s === "low" || s === "red") return "🔴";
  return "⚪";
}

const FIELD_TOOLTIPS: Record<string, string> = {
  composite: "Overall profile strength score. Higher is better for search visibility.",
  topic_clarity: "How clear is your main job or expertise? e.g. 'AI Developer' is better than 'Explorer'. (Higher is better)",
  seniority_signal: "Does it show your experience level? e.g. using 'Senior' or 'Lead'. (Higher is better)",
  outcome_specificity: "Using numbers to show what you achieved. e.g. 'Increased speed by 20%'. (Higher is better)",
  keyword_density: "Using words people type in search (like 'Python' or 'Marketing'). (Higher is better)",
  differentiation: "What makes you different from others in your field? (Higher is better)",
  character_efficiency: "How well you use the character limit without wasting words. (Higher is better)",
  first_275_hook: "The first few lines people see before clicking 'See more'. Must be catchy. (Higher is better)",
  topic_coherence: "Do all parts of your profile talk about the same professional focus? (Higher is better)",
  specificity_density: "Using specific facts instead of vague 'worked hard' statements. (Higher is better)",
  pillar_definition: "How well you show the 2-3 main things you are known for. (Higher is better)",
  voice_authenticity: "Does it sound like a real person? Avoid 'corporate robot' language. (Higher is better)",
  cta_presence: "Giving readers a clear next step (e.g. 'Follow for tips' or 'Comment below'). (Higher is better)",
  length_optimization: "Is the text too long or too short? Aim for a balanced reading time. (Higher is better)",
  top_3_alignment: "Are your top skills the ones that actually matter for your job? (Higher is better)",
  total_skill_count: "Number of skills you have. 25-50 is the 'sweet spot' for search. (Higher is better)",
  niche_aligned_skills_present: "Do you have specific skills needed for your niche field? (Higher is better)",
  boring_filter_skills: "Removing common skills like 'Word' to make room for expert skills. (Higher is better)",
  endorsement_distribution: "How many people have vouched for your top skills. (Higher is better)",
  skill_to_experience_coherence: "Do your skills match the work you actually did in your jobs? (Higher is better)",
  count: "Number of recommendations. Even 2-3 specific ones help a lot. (Higher is better)",
  recency: "How new your latest recommendation is. Aim for something from the last year. (Higher is better)",
  specificity: "Do people give real details about you or just say 'good job'? (Higher is better)",
  senior_source_quality: "Recommendations from bosses or seniors carry more weight. (Higher is better)",
  item_count: "Number of links or posts in your Featured section. Aim for 3-5. (Higher is better)",
  niche_alignment: "Do your featured items match what you do professionally? (Higher is better)",
  content_mix: "variety of links, images, and posts in your featured area. (Higher is better)",
  overall_score: "Total score for this section based on all fields above. (Higher is better)",
  scope_clarity: "How well you describe the size of your role (e.g. 'Led 5 people'). (Higher is better)",
  outcome_density: "How many real results you mention in your job description. (Higher is better)",
  strategic_tactical_balance: "Balancing big-picture impact with daily tasks. (Higher is better)",
  strategic_vs_tactical_balance: "Balancing big-picture impact with daily tasks. (Higher is better)",
  verb_strength: "Using strong words like 'Managed' or 'Built' instead of 'Helped'. (Higher is better)",
  skill_tagging_coherence: "Are the skills tagged correctly for your job? (Higher is better)",
  recency_treatment: "Giving more detail to your current job than your old ones. (Higher is better)",
  hook_strength: "Does the first line of your post stop someone from scrolling? (Higher is better)",
  profile_content_coherence: "How well this post fits your professional background. (Higher is better)",
  behavior_content_coherence: "Consistency with the topics you usually talk about. (Higher is better)",
  format_optimization: "Is the post layout easy to read on mobile and desktop? (Higher is better)",
  saveability: "Is this post useful enough for someone to 'Save' for later? (Higher is better)",
  reach_killer_hygiene: "Checking for things that hurt reach, like links in the main text. (Higher is better)",
  variety: "Is this post different from your last few? (Higher is better)",
  predicted_performance: "AI estimate of how many people will see and like this post. (Higher is better)"
};

export function ScoreBar({ label, value }: { label: string; value: unknown }) {
  const raw = typeof value === "number" ? value : Number(value);
  const v = Number.isFinite(raw) ? Math.max(1, Math.min(10, Math.round(raw))) : null;
  
  const lowLabel = label.toLowerCase();
  // Aggressive normalization: remove ALL leading prefixes like "A. ", "1. ", "Sub-A: " etc.
  const cleanKey = lowLabel
    .replace(/^[^a-z]+/, "") // remove starting non-alpha (numbers, icons)
    .replace(/^[a-z][\s.:-]+\s*/, "") // remove "a ", "b. ", "c: "
    .trim()
    .replace(/\s+/g, "_");

  const foundKey = Object.keys(FIELD_TOOLTIPS).find(k => cleanKey.includes(k) || k.includes(cleanKey));
  const tooltip = FIELD_TOOLTIPS[cleanKey] || 
                  FIELD_TOOLTIPS[lowLabel] || 
                  (foundKey ? FIELD_TOOLTIPS[foundKey] : null) ||
                  "Score from 1 to 10 based on PRD methodology. (Higher is better)";
  
  if (v == null) {
    return (
      <div className="scoreRow" title={tooltip}>
        <div className="scoreRowLabel">{formatAxisLabel(label)}</div>
        <div className="scoreRowTrack scoreRowTrackEmpty" />
        <div className="scoreRowVal">—</div>
      </div>
    );
  }
  const pct = (v / 10) * 100;
  const color = v >= 8 ? "#057642" : v >= 5 ? "#b28500" : "#d11124";
  
  return (
    <div className="scoreRow" title={tooltip}>
      <div className="scoreRowLabel">{formatAxisLabel(label)}</div>
      <div className="scoreRowTrack" role="meter" aria-valuenow={v} aria-valuemin={1} aria-valuemax={10}>
        <div className="scoreRowFill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <div className="scoreRowVal">{v}</div>
    </div>
  );
}

function pickPrimaryText(o: Record<string, unknown>): string | null {
  for (const k of ["headline_text", "about_text", "summary"]) {
    const t = o[k];
    if (typeof t === "string" && t.trim()) return t.trim();
  }
  return null;
}

export function SubAnalysisCard({ title, block }: { title: string; block: unknown }) {
  const o = asRecord(block);
  if (!o) return null;
  const scores = asRecord(o.scores);
  const issues = Array.isArray(o.issues_found) ? o.issues_found : [];
  const rewrites = Array.isArray(o.rewrite_options) ? o.rewrite_options : [];
  const primary = pickPrimaryText(o);
  let overall: number | null = null;
  for (const key of [
    "overall_headline_score",
    "overall_about_score",
    "overall_skills_score",
    "overall_experience_score",
    "overall_recommendations_score",
    "overall_featured_score",
    "featured_composite_0_to_100",
  ]) {
    const v = o[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      overall = v;
      break;
    }
  }

  return (
    <div className="insightCard insightCardElevated">
      <div className="insightCardHead">
        <h3>{title}</h3>
        {overall != null && Number.isFinite(overall) && (
          <span className="overallPill" title="Section score 0–100">
            {Math.round(overall)}
            <span className="overallPillSub">/100</span>
          </span>
        )}
      </div>
      {primary && (
        <div className="primaryQuote">
          <span className="primaryQuoteLabel">{title === "About" ? "About (as analyzed)" : title === "Headline" ? "Headline (as analyzed)" : "Text"}</span>
          <p>{primary.length > 420 ? `${primary.slice(0, 417)}…` : primary}</p>
        </div>
      )}
      {scores && Object.keys(scores).length > 0 && (
        <div className="scoreBlock">
          {Object.entries(scores).map(([k, v]) => (
            <ScoreBar key={k} label={k} value={v} />
          ))}
        </div>
      )}
      {issues.length > 0 && (
        <div className="issuesBlock">
          {issues.map((it, i) => {
            const row = asRecord(it);
            const sev = String(row?.severity ?? "");
            const cls = sev === "high" || sev === "critical" ? "sev-high" : "sev-medium";
            return (
              <div key={i} className="issue">
                <span className={cls}>{sev}</span>
                {toConfidenceEmoji(row?.confidence)} {String(row?.issue ?? "")}
                {row?.fix != null && (
                  <div className="issueFix">Fix: {String(row.fix)}</div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {rewrites.length > 0 && (
        <div className="rewriteBlock">
          <div className="rewriteBlockTitle">Rewrite options</div>
          <ol className="rewriteList">
            {rewrites.map((r, i) => (
              <li key={i}>{String(r)}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function SkillsExtraCard({ block, currentProfile }: { block: unknown; currentProfile?: Record<string, unknown> | null }) {
  const o = asRecord(block);
  if (!o) return null;
  
  const existingSkills = new Set((Array.isArray(asRecord(currentProfile)?.skills) ? 
    (asRecord(currentProfile)?.skills as string[]) : []).map(s => s.toLowerCase()));

  const addRaw = Array.isArray(o.skills_to_add) ? o.skills_to_add.map(String) : [];
  // Filter out any skills the user already has
  const add = addRaw.filter(s => !existingSkills.has(s.toLowerCase()));

  const rem = Array.isArray(o.skills_to_remove) ? o.skills_to_remove.map(String) : [];
  const top3 = Array.isArray(o.recommended_top_3_order) ? o.recommended_top_3_order.map(String) : [];
  if (!add.length && !rem.length && !top3.length) return null;
  return (
    <div className="insightCard insightCardElevated" style={{ marginTop: 12 }}>
      <h3>Skills actions</h3>
      {top3.length > 0 && (
        <div className="miniSection">
          <div className="miniSectionTitle">Recommended top 3 order</div>
          <div className="pillRow">
            {top3.map((s, i) => (
              <span key={i} className="pill pillAccent">
                {i + 1}. {s}
              </span>
            ))}
          </div>
        </div>
      )}
      {add.length > 0 && (
        <div className="miniSection">
          <div className="miniSectionTitle">Add</div>
          <div className="pillRow">
            {add.slice(0, 8).map((s, i) => (
              <span key={i} className="pill">
                + {s}
              </span>
            ))}
          </div>
        </div>
      )}
      {rem.length > 0 && (
        <div className="miniSection">
          <div className="miniSectionTitle">Remove / deprioritize</div>
          <div className="pillRow">
            {rem.slice(0, 8).map((s, i) => (
              <span key={i} className="pill pillMuted">
                − {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ExperienceCard({ block }: { block: unknown }) {
  const o = asRecord(block);
  if (!o) return null;
  const roles = Array.isArray(o.roles) ? o.roles : [];
  if (!roles.length) return null;
  return (
    <div className="insightCard insightCardElevated" style={{ marginTop: 12 }}>
      <div className="insightCardHead">
        <h3>Experience</h3>
        {typeof o.overall_experience_score === "number" && Number.isFinite(o.overall_experience_score) && (
          <span className="overallPill" title="Section score 0–100">
            {Math.round(o.overall_experience_score)}
            <span className="overallPillSub">/100</span>
          </span>
        )}
      </div>
      {roles.map((raw, idx) => {
        const r = asRecord(raw);
        if (!r) return null;
        const scores = asRecord(r.scores);
        const issues = Array.isArray(r.issues_found) ? r.issues_found : [];
        return (
          <div key={idx} className="roleCard">
            <div className="roleCardTitle">
              {String(r.role ?? "Role")} <span className="roleCo">@ {String(r.company ?? "")}</span>
            </div>
            {scores && (
              <div className="scoreBlock scoreBlockCompact">
                {Object.entries(scores).map(([k, v]) => (
                  <ScoreBar key={k} label={k} value={v} />
                ))}
              </div>
            )}
            {issues.length > 0 && (
              <ul className="roleIssues">
                {issues.slice(0, 2).map((it, i) => (
                  <li key={i}>{String(asRecord(it)?.issue ?? it)}</li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function InputSnapshotView({ snapshot }: { snapshot: unknown }) {
  if (isEmptySnapshot(snapshot)) {
    return (
      <div className="insightCard snapshotEmpty">
        <h3>Saved profile input</h3>
        <p className="snapshotEmptyText">
          No snapshot stored for this run. New analyses save the full dataset here; older Mongo documents may not have this field.
        </p>
      </div>
    );
  }
  const s = asRecord(snapshot) ?? {};
  const profile = asRecord(s.profile) ?? {};
  const ctx = asRecord(s.userContext) ?? {};
  const metrics = asRecord(s.metricsSummary);
  const draft = asRecord(s.contentDraft);

  return (
    <div className="insightCard snapshotCard">
      <h3>Saved profile input</h3>
      <div className="snapshotGrid">
        <div className="snapshotCol">
          <div className="miniSectionTitle">Profile</div>
          <dl className="snapshotDl">
            <dt>Name</dt>
            <dd>{String(profile.name ?? "—")}</dd>
            <dt>Headline</dt>
            <dd>{String(profile.headline ?? "—")}</dd>
            <dt>Location</dt>
            <dd>{String(profile.location ?? "—")}</dd>
          </dl>
          {typeof profile.about === "string" && profile.about.trim() && (
            <div className="snapshotAbout">
              <div className="miniSectionTitle">About</div>
              <p>
                {profile.about.length > 335 ? `${String(profile.about).slice(0, 335)}…` : String(profile.about)}
              </p>
            </div>
          )}
        </div>
        <div className="snapshotCol">
          <div className="miniSectionTitle">Context</div>
          <dl className="snapshotDl">
            {["declared_niche", "career_goal", "target_audience", "years_experience", "geography"].map((k) => (
              <div key={k}>
                <dt>{formatAxisLabel(k)}</dt>
                <dd>{String(ctx[k] ?? "—")}</dd>
              </div>
            ))}
          </dl>
          {metrics && Object.keys(metrics).length > 0 && (
            <>
              <div className="miniSectionTitle" style={{ marginTop: "0.75rem" }}>
                Metrics
              </div>
              <div className="pillRow">
                {Object.entries(metrics).map(([k, v]) => (
                  <span key={k} className="pill">
                    {formatAxisLabel(k)}: {String(v)}
                  </span>
                ))}
              </div>
            </>
          )}
          {draft && Object.keys(draft).length > 0 && (
            <div className="snapshotDraft">
              <div className="miniSectionTitle">Draft post (if any)</div>
              <p className="draftPreview">{String(draft.postText ?? "").slice(0, 400) || "—"}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DeveloperJsonDetails({ label, data }: { label: string; data: unknown }) {
  return (
    <details className="devJson">
      <summary>{label}</summary>
      <pre className="devJsonPre">{JSON.stringify(data ?? {}, null, 2)}</pre>
    </details>
  );
}

function hasDraftContentAnalysis(contentMod: Record<string, unknown> | null): boolean {
  if (!contentMod) return false;
  if (contentMod.status === "implemented_basic") return true;
  const qc = contentMod.quality_score_card;
  if (qc && typeof qc === "object") return true;
  if (typeof contentMod.composite_quality_score === "number") return true;
  return false;
}

/** Pre-publish draft output from `runContentAnalyzerFlow` (Module 3). */
export function DraftPostAnalysisCard({ contentMod, metrics }: { contentMod: Record<string, unknown>; metrics?: Record<string, number> }) {
  const meta = asRecord(contentMod.draft_analysis_metadata);
  const scoreCard = asRecord(contentMod.quality_score_card);
  const sub = asRecord(scoreCard?.sub_scores_1_to_10);
  const issues = Array.isArray(contentMod.top_5_issues) ? contentMod.top_5_issues : [];
  const edits = Array.isArray(contentMod.edit_suggestions) ? contentMod.edit_suggestions : [];
  const coherence = asRecord(contentMod.coherence_checks);
  const hook = asRecord(contentMod.hook_analysis);

  let composite = null;
  if (sub && Object.keys(sub).length > 0) {
    const getS = (key: string) => {
        const entry = Object.entries(sub).find(([k]) => k.toLowerCase().includes(key.toLowerCase()));
        return entry ? Number(entry[1]) : 7; // default to 7 if missing
    };

    const wE = getS("saveability") * 2.0;
    const wA = getS("hook strength") * 1.5;
    const wB = getS("profile content coherence") * 1.2;
    const wC = getS("behavior content coherence") * 1.2;
    const wD = getS("format optimization") * 1.0;
    const wF = getS("reach killer hygiene") * 1.0;
    const wG = getS("variety") * 1.0;
    const wH = getS("predicted performance") * 1.0;

    composite = ((wA + wB + wC + wD + wE + wF + wG + wH) / 9.9) * 10;
  }
  
  if (composite == null) {
    composite =
      typeof scoreCard?.composite_score_0_to_100 === "number"
        ? scoreCard.composite_score_0_to_100
        : typeof contentMod.composite_quality_score === "number"
          ? contentMod.composite_quality_score
          : 60;
  }

  // Formula 1 & 6 — Algorithmic Penalty & Cap
  let finalComposite = composite;
  
  const mismatchLevel = String(asRecord(contentMod.analysis_metadata)?.mismatch_level || "none");
  const mismatchCap = Number(asRecord(contentMod.analysis_metadata)?.mismatch_cap || 100);
  const mismatchMult = Number(asRecord(contentMod.analysis_metadata)?.niche_penalty_multiplier || 1.0);

  if (mismatchLevel !== "none") {
      finalComposite = finalComposite * mismatchMult;
      finalComposite = Math.min(finalComposite, mismatchCap);
  }

  // Apply Global Penalty Cap (Formula 6): Max deduction 40 pts, Floor at lowest band
  finalComposite = Math.max(30, finalComposite); // floor at 30
  const baseDeduction = 100 - finalComposite;
  const cappedDeduction = Math.min(40, baseDeduction);
  finalComposite = 100 - cappedDeduction;

  const compNum = finalComposite;

  let decision = String(scoreCard?.decision || contentMod.decision_recommendation || "—");
  if (compNum < 65) decision = "Significant Rework Needed";
  else if (compNum < 85) decision = "Minor Polish Recommended";
  else decision = "Post Ready";

  // 2. VISIBILITY RANGE (Formula 2 Enhancement)
  const followers = metrics?.followers || 800; 
  const connections = metrics?.connections || 600;
  const baseReach = followers * 0.12 + connections * 0.08 + 50;
  const mediaMult = Number(meta?.media_multiplier || 1.0);
  
  // Tightened ±35% band (0.7x to 1.5x) * MediaMultiplier
  const estMin = Math.round(baseReach * (compNum / 75) * 0.7 * mediaMult);
  const estMax = Math.round(baseReach * (compNum / 75) * 1.5 * mediaMult);
  
  // 3. REACTIONS WITH CONTENT TYPE MULTIPLIER (Formula 3)
  const arch = String(asRecord(contentMod.analysis_metadata)?.hook_archetype || "").toLowerCase();
  let typeMult = 1.0;
  if (arch.includes("story") || arch.includes("vulnerability") || arch.includes("personal")) typeMult = 1.4;
  else if (arch.includes("framework") || arch.includes("insight") || arch.includes("lesson")) typeMult = 1.2;
  else if (arch.includes("resource") || arch.includes("listicle")) typeMult = 0.9;
  else if (arch.includes("promo") || arch.includes("hiring")) typeMult = 0.6;

  const reactionRate = 0.035 * (compNum / 65) * typeMult;
  const estReactions = Math.round(estMin * reactionRate);

  const segments = String(asRecord(contentMod.post_topic_summary)?.audience_target || "");
  let audienceLabel = segments || String(asRecord(contentMod.analysis_metadata)?.draft_audience_label || "");

  if (!audienceLabel || audienceLabel === "undefined" || audienceLabel.includes("Broad LinkedIn feed")) {
    const profileNiche = String(asRecord(contentMod.analysis_metadata)?.declared_niche || "");
    audienceLabel = profileNiche ? `Your niche: ${profileNiche}` : "Graph-based (1st degree connections and neighbors)";
  }

  return (
    <div className="insightCard insightCardElevated" style={{ marginBottom: "1rem", borderColor: "var(--accent, #0a66c2)" }}>
      <div className="insightCardHead">
        <h3>Draft post — pre-publish analysis</h3>
        {finalComposite != null && Number.isFinite(finalComposite) && (
          <span className="overallPill" title="Weighted algorithmic score (Saveability prioritied)">
            {Math.round(Number(finalComposite))}
            <span className="overallPillSub">/100</span>
          </span>
        )}
      </div>
      <div className="summaryStrip" style={{ marginBottom: "1rem" }}>
        <div className="summaryCard" title={`Formula: (BaseReach * Score/75) * [0.7 to 1.5 range]`}>
          <div className="k">👁️ Impressions</div>
          <div className="v">
            {estMin.toLocaleString()}-{estMax.toLocaleString()}
          </div>
        </div>
        <div className="summaryCard" title={`Formula: Impressions * 0.035 * ContentMult(${typeMult}x) * (Score/65)`}>
          <div className="k">👍 Reactions</div>
          <div className="v">{estReactions}+</div>
        </div>
      </div>

      {mismatchLevel !== "none" && (
        <div className="issue" style={{ background: "#fff9f9", border: "1px solid #ff000033", padding: "12px", borderRadius: "8px", marginBottom: "1rem" }}>
            <div style={{ color: "#d11124", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <span>⚠️ Niche Mismatch Detected</span>
                <span style={{ fontSize: "10px", padding: "2px 6px", background: "#d11124", color: "white", borderRadius: "4px" }}>SCORE CAPPED</span>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#666" }}>
                <strong>Post domain:</strong> {String(asRecord(contentMod.analysis_metadata)?.post_domain || "Unknown")}<br/>
                <strong>Your niche:</strong> {String(asRecord(contentMod.analysis_metadata)?.declared_niche || "Not set")}<br/>
                <strong>Reason:</strong> {String(asRecord(contentMod.analysis_metadata)?.mismatch_label)} (no recent history matching this topic).
            </div>
            <div style={{ fontSize: "0.85rem", marginTop: "8px", borderTop: "1px dashed #ddd", paddingTop: "8px" }}>
                <strong>Fix:</strong> Either stay in your niche, or add context from your background (e.g. "Here's how AI is changing {String(asRecord(contentMod.analysis_metadata)?.post_domain || "this field")}")
            </div>
        </div>
      )}

      <p className="mutedSmall" style={{ marginTop: 0 }}>
        Same run also refreshed <strong>profile</strong> scores (headline / about / …) below — that is expected. This block is your <strong>post draft</strong> signal.
      </p>
      {asRecord(asRecord(contentMod.analysis_metadata)?.user_context)?.draft_post_text != null && (
        <details className="liSectionCard" style={{ marginBottom: "1rem", background: "#f3f6f8" }}>
          <summary style={{ padding: "8px", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600 }}>Analyzed draft text (click to view)</summary>
          <div style={{ padding: "12px", background: "white", borderRadius: "4px", fontSize: "0.9rem", whiteSpace: "pre-wrap", border: "1px solid #e5e7eb" }}>
            {String(asRecord(asRecord(contentMod.analysis_metadata)?.user_context)?.draft_post_text)}
          </div>
        </details>
      )}
      {meta?.niche_draft_track_mismatch === true && (
        <p className="issue" style={{ marginTop: "0.5rem", marginBottom: "0.75rem" }} role="alert">
          <span className="sev-high">niche mismatch</span> Declared niche reads as technical ML/AI but this draft reads GTM/sales-heavy (or the opposite). Composite is intentionally capped — generic overlap like “AI” is not treated as on-niche.
        </p>
      )}
      {meta && (
        <div className="miniSection">
          <div className="miniSectionTitle">Draft meta</div>
          <dl className="snapshotDl">
            <dt>Words</dt>
            <dd>{String(meta.draft_length_words ?? "—")}</dd>
            <dt>Format</dt>
            <dd>{String(meta.intended_format ?? "—")}</dd>
            <dt>Hook archetype</dt>
            <dd>{String(asRecord(contentMod.analysis_metadata)?.hook_archetype ?? hook?.detected_archetype ?? "—")}</dd>
            {meta.draft_substance_tier != null && String(meta.draft_substance_tier) !== "normal" ? (
              <>
                <dt>Length / substance</dt>
                <dd>
                  {String(meta.draft_substance_tier)}
                  {typeof meta.draft_char_count === "number" ? ` · ${String(meta.draft_char_count)} chars` : ""} — very short drafts are capped low on purpose.
                </dd>
              </>
            ) : null}
          </dl>
        </div>
      )}
      {meta &&
      (meta.draft_audience_label != null ||
        meta.draft_profile_drift_summary != null ||
        meta.draft_routing_signals_model_note != null) ? (
        <div className="miniSection">
          <div className="audSummary" style={{ marginTop: "1rem", marginBottom: "1rem", padding: "12px", borderLeft: "4px solid var(--accent)", background: "#f8fafc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: 4 }}>Predicted post target audience:</span>
                <strong style={{ fontSize: "1rem", color: "var(--accent)" }}>{audienceLabel || "Model heuristic routing…"}</strong>
              </div>
              <div style={{ minWidth: "140px", textAlign: "right" }}>
                <span style={{ fontWeight: 600, fontSize: "0.85rem", display: "block", marginBottom: 4 }}>Estimated Visibility:</span>
                <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>👁️ {estMin} – {estMax}</div>
                <div style={{ fontSize: "0.8rem", color: "#666" }}>👍 {estReactions}+ reactions</div>
              </div>
            </div>
            <p className="mutedSmall" style={{ marginTop: 8, fontSize: "0.75rem", lineHeight: 1.3 }}>
              {String(
                meta.draft_routing_signals_model_note ??
                  "Heuristic routing — not LinkedIn analytics. Based on keyword buckets and your graph size."
              )}
            </p>
          </div>
          {(meta.declared_niche_echo != null || meta.target_audience_echo != null) && (
            <p className="mutedSmall" style={{ margin: "0.25rem 0" }}>
              Stated niche: {String(meta.declared_niche_echo || "—")}
              {meta.target_audience_echo != null && meta.target_audience_echo !== ""
                ? ` · Target audience field: ${String(meta.target_audience_echo)}`
                : ""}
            </p>
          )}
          <div className="miniSectionTitle" style={{ marginTop: "0.85rem" }}>
            Drift from that profile positioning
          </div>
          <dl className="snapshotDl">
            <dt>Drift score (0 = on-brand, 100 = off-brand / unroutable)</dt>
            <dd>
              {String(meta.draft_profile_drift_band ?? "—")} — {String(meta.draft_profile_drift_score_0_to_100 ?? "—")}/100
              {typeof coherence?.declared_identity_alignment === "number" ? (
                <span className="mutedSmall">
                  {" "}
                  · niche keyword overlap on draft {String(coherence.declared_identity_alignment)}%
                </span>
              ) : null}
            </dd>
            <dt>Summary</dt>
            <dd>{String(meta.draft_profile_drift_summary ?? "—")}</dd>
          </dl>
          {isPlainObject(meta.draft_routing_signal_hits) ? (
            <DeveloperJsonDetails label="Routing cue counts by bucket (expand)" data={meta.draft_routing_signal_hits} />
          ) : null}
        </div>
      ) : null}
      <div className="miniSection">
        <div className="miniSectionTitle">Recommendation</div>
        <p style={{ margin: 0, fontWeight: 600 }}>{decision}</p>
      </div>
      {sub && Object.keys(sub).length > 0 && (
        <div className="scoreBlock" style={{ marginTop: 12 }}>
          {Object.entries(sub).map(([k, v]) => (
            <ScoreBar key={k} label={k} value={v} />
          ))}
        </div>
      )}
      {coherence && (
        <div className="miniSection">
          <div className="miniSectionTitle">Coherence</div>
          <p className="mutedSmall" style={{ margin: "0.25rem 0" }}>
            <span title="How well this post matches your profile headline and expertise.">Identity alignment</span> {String(coherence.declared_identity_alignment ?? "—")}% · 
            <span title="Consistency with your actual posting history and behavior.">Behavior alignment</span>{" "}
            {String(coherence.demonstrated_behavior_alignment ?? "—")}% · 
            <span title="How effectively the first 3 lines stop the scroll.">Hook</span> {String(coherence.hook_strength_1_to_10 ?? "—")}/10 · 
            <span title="Overall match quality: Strong, Mixed, or Diluted.">Band</span>{" "}
            {String(coherence.coherence_band ?? "—")}
          </p>
        </div>
      )}
      {issues.length > 0 && (
        <div className="issuesBlock">
          <div className="miniSectionTitle">Top issues (draft)</div>
          {issues.map((it, i) => {
            const row = asRecord(it);
            const sev = String(row?.severity ?? "");
            const cls = sev === "high" || sev === "critical" ? "sev-high" : "sev-medium";
            return (
              <div key={i} className="issue">
                <span className={cls}>{sev === "high" || sev === "critical" ? "CRITICAL" : sev.toUpperCase()}</span>
                <span style={{ fontWeight: 700, color: "var(--red)", marginRight: 8 }}>
                  {sev === "high" || sev === "critical" ? "-15" : "-8"} pts
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div style={{ fontWeight: 600 }}>
                        {toConfidenceEmoji(row?.confidence)} {String(row?.issue ?? "")}
                    </div>
                    {!!row?.why_detected && (
                        <div style={{ fontSize: "0.75rem", color: "#666", fontStyle: "italic" }}>
                            <strong>Why:</strong> {String(row.why_detected)}
                        </div>
                    )}
                    {!!row?.snippet && (
                        <div style={{ fontSize: "0.75rem", background: "#fff", padding: "4px 8px", borderLeft: "2px solid #ddd", margin: "4px 0" }}>
                            "{String(row.snippet)}"
                        </div>
                    )}
                    {!!row?.target && (
                        <div style={{ fontSize: "0.75rem", color: "#057642" }}>
                            <strong>Change to:</strong> {String(row.target)}
                        </div>
                    )}
                    {row?.fix != null && <div className="issueFix">Fix: {String(row.fix)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {edits.length > 0 && (
        <div className="miniSection">
          <div className="miniSectionTitle">Edit suggestions</div>
          <ol className="rewriteList">
            {edits.map((e, i) => {
              const row = asRecord(e);
              return (
                <li key={i}>
                  <strong>{String(row?.edit ?? "")}</strong>
                  {row?.why != null && <div className="issueFix">{String(row.why)}</div>}
                </li>
              );
            })}
          </ol>
        </div>
      )}
      <DeveloperJsonDetails label="Full content analyzer JSON (advanced)" data={contentMod} />
    </div>
  );
}

export function AnalysisOutputView({ output, metrics, profile }: { output: Record<string, unknown>; metrics?: Record<string, number>; profile?: Record<string, unknown> | null }) {
  const sub = asRecord(output.sub_analyses);
  const cc = asRecord(output.composite_classification);
  const topIssues = Array.isArray(output.top_issues) ? output.top_issues : [];
  const contentMod = asRecord(output.content_analyzer);
  const head = asRecord(sub?.headline);
  const showDraftFirst = hasDraftContentAnalysis(contentMod);

  return (
    <div className="analysisOutput">
      <h2 className="sectionTitle">Analyzer output</h2>
      {showDraftFirst && contentMod ? <DraftPostAnalysisCard contentMod={contentMod} metrics={metrics} /> : null}
      <div className="summaryStrip">
        {cc && (
          <>
            <div className="summaryCard" title={FIELD_TOOLTIPS.composite}>
              <div className="k">Tier</div>
              <div className="v">{String(cc.tier ?? "—")}</div>
            </div>
            <div className="summaryCard" title={FIELD_TOOLTIPS.composite}>
              <div className="k">Composite</div>
              <div className="v">{String(cc.score ?? "—")}</div>
            </div>
          </>
        )}
        {head && typeof head.overall_headline_score === "number" && Number.isFinite(head.overall_headline_score) && (
          <div className="summaryCard">
            <div className="k">Headline</div>
            <div className="v">{String(Math.round(head.overall_headline_score))}</div>
          </div>
        )}
      </div>

      {topIssues.length > 0 && (
        <div className="insightCard" style={{ marginBottom: "1rem" }}>
          <h3>Top issues</h3>
          {topIssues.slice(0, 8).map((it, i) => {
            const o = asRecord(it);
            return (
              <div key={i} className="issue">
                {String(o?.issue ?? "")}
              </div>
            );
          })}
        </div>
      )}

      {sub && (
        <div className="modelInsightsStack">
          {showDraftFirst ? (
            <p className="mutedSmall" style={{ marginBottom: "0.75rem" }}>
              Profile analyzer (same run)
            </p>
          ) : null}
            <SubAnalysisCard title="Headline" block={sub.headline} />
            <SubAnalysisCard title="About" block={sub.about} />
            <SubAnalysisCard title="Skills" block={sub.skills} />
            <SkillsExtraCard block={sub.skills} currentProfile={profile} />
            <ExperienceCard block={sub.experience} />
            {isPlainObject(sub.recommendations) && <SubAnalysisCard title="Recommendations" block={sub.recommendations} />}
            {isPlainObject(sub.featured) && <SubAnalysisCard title="Featured" block={sub.featured} />}
        </div>
      )}

      {contentMod && !showDraftFirst ? (
        <div className="insightCard" style={{ marginTop: "1rem" }}>
          <h3>Content analyzer</h3>
          <p className="mutedSmall">Structured summary; expand JSON only if you need the full object.</p>
          <DeveloperJsonDetails label="Raw content analyzer JSON" data={contentMod} />
        </div>
      ) : null}

    </div>
  );
}

export function ProfileReadoutCard({ profile, draftPost }: { profile: Record<string, unknown> | null; draftPost?: string }) {
  if (!profile || !Object.keys(profile).length) {
    return (
      <div className="insightCard">
        <h3>Your fields</h3>
        <p className="mutedSmall">No data in context.</p>
      </div>
    );
  }
  return (
    <div className="insightCard">
      <h3>Your fields</h3>
      <div className="field">
        <label>Name</label>
        <input value={String(profile.name ?? "")} readOnly />
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <label>Headline</label>
        <textarea value={String(profile.headline ?? "")} readOnly rows={3} style={{ width: "100%", minHeight: 56, resize: "none" }} />
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <label>About (preview)</label>
        <textarea value={String(profile.about ?? "").slice(0, 335)} readOnly style={{ minHeight: 120 }} />
      </div>
      {draftPost && (
        <div className="field" style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #ddd" }}>
          <label>Draft post (analyzed)</label>
          <div style={{ padding: "8px", background: "#f3f6f8", borderRadius: "4px", fontSize: "0.85rem", whiteSpace: "pre-wrap", border: "1px solid #e5e7eb", maxHeight: "200px", overflowY: "auto" }}>
            {draftPost}
          </div>
        </div>
      )}
    </div>
  );
}

export function AnalysisSplitView({
  output,
  profile,
}: {
  output: Record<string, unknown>;
  profile: Record<string, unknown> | null;
}) {
  const hasProfile = !!profile && Object.keys(profile).length > 0;
  const metricsRaw = asRecord(asRecord(asRecord(output.content_analyzer)?.analysis_metadata)?.user_metrics);
  const metrics: Record<string, number> = {};
  if (metricsRaw) {
    for (const [k, v] of Object.entries(metricsRaw)) {
      if (typeof v === "number") metrics[k] = v;
    }
  }

  const draftPostText = String(asRecord(asRecord(asRecord(output.content_analyzer)?.analysis_metadata)?.user_context)?.draft_post_text || "");

  return (
    hasProfile ? (
      <div className="split">
        <div>
          <h2 className="sectionTitle">Your fields</h2>
          <ProfileReadoutCard profile={profile} draftPost={draftPostText || undefined} />
        </div>
        <div>
          <AnalysisOutputView output={output} metrics={metrics} profile={profile} />
        </div>
      </div>
    ) : (
      <div>
        <AnalysisOutputView output={output} metrics={metrics} profile={profile} />
      </div>
    )
  );
}
