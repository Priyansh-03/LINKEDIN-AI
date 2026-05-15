/**
 * Layer 1 — retrieval analog (deterministic):
 * Turn structured dataset slices into verbalized "candidates" the ranker/LLM consumes.
 * This is not LinkedIn's Layer-1 retrieval; it is our explicit verbalization stage.
 */

export const LAYER1_ID = "L1_verbalize_context";

function lines(...parts) {
  return parts.filter(Boolean).join("\n");
}

function formatList(items, bullet = "-") {
  if (!Array.isArray(items) || !items.length) return "(none)";
  return items.map((x) => `${bullet} ${x}`).join("\n");
}

function experienceBlock(profile) {
  const items = profile?.experienceItems;
  if (!Array.isArray(items) || !items.length) return "(no experienceItems)";
  return items
    .map((e, i) => {
      const title = e?.title ?? "";
      const company = e?.company ?? "";
      const duration = e?.duration ?? "";
      const desc = (e?.description || "").trim();
      return lines(
        `[${i + 1}] ${title} @ ${company} (${duration})`,
        desc ? `    ${desc.replace(/\n/g, " ").slice(0, 193)}` : ""
      );
    })
    .join("\n\n");
}

function educationBlock(profile) {
  const ed = profile?.education;
  if (!Array.isArray(ed) || !ed.length) return "(no education)";
  return ed
    .map((x) => {
      const bits = [x?.degree, x?.field, x?.school, x?.year].filter(Boolean);
      return `- ${bits.join(" — ")}`;
    })
    .join("\n");
}

function certificationsBlock(profile) {
  const c = profile?.certifications;
  if (!Array.isArray(c) || !c.length) return "(no certifications)";
  return c.map((x) => `- ${x?.name || ""} (${x?.issuer || ""}, ${x?.date || ""})`).join("\n");
}

/**
 * @param {Record<string, unknown>} dataset
 */
export function runLayer1Verbalize(dataset) {
  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  const profile = dataset.profile || {};

  const headline = String(profile.headline || "").trim() || "(empty headline)";
  const about = String(profile.about || "").trim() || "(empty about)";
  const name = String(profile.name || "").trim() || "(name redacted)";
  const location = String(profile.location || "").trim() || "";
  const skills = Array.isArray(profile.skills) ? profile.skills.map(String) : [];
  const recommendations = Array.isArray(profile.recommendations)
    ? profile.recommendations.map((r) => {
        if (typeof r === "object" && r !== null) {
          return `${r.name || ""}, ${r.role || ""}: "${r.message || ""}"`;
        }
        return String(r);
      })
    : [];
  const featured = Array.isArray(profile.featured) ? profile.featured : [];

  const profileVerbal = lines(
    "## Profile (verbalized for ranking-style context)",
    `Name: ${name}`,
    `Headline: ${headline}`,
    location ? `Location: ${location}` : "",
    profile.yearsExperienceHint ? `Years experience hint: ${profile.yearsExperienceHint}` : "",
    "",
    "### About",
    about,
    "",
    "### Experience",
    experienceBlock(profile),
    "",
    "### Education",
    educationBlock(profile),
    "",
    "### Certifications",
    certificationsBlock(profile),
    "",
    "### Skills (ordered as provided)",
    skills.length ? skills.join(", ") : "(no skills)",
    "",
    "### Recommendations (blurbs)",
    formatList(recommendations),
    "",
    "### Featured",
    featured.length
      ? featured.map((f) => `- ${f?.title || f?.text || ""} ${f?.url || f?.format || ""}`.trim()).join("\n")
      : "(none)"
  );

  const metrics = dataset.metricsSummary || {};
  const metricsVerbal = lines(
    "## Metrics summary (surface / discovery signals)",
    JSON.stringify(metrics)
  );

  const behavior = dataset.behaviorSignals || {};
  const behaviorVerbal = lines(
    "## Behavior signals (recent activity verbalization)",
    JSON.stringify(behavior)
  );

  const peer = dataset.peerBenchmark || {};
  const peerVerbal = lines(
    "## Peer benchmark (relative performance data)",
    JSON.stringify(peer)
  );

  const meta = lines(
    "## Dataset meta",
    `schemaVersion: ${dataset.schemaVersion ?? "(missing)"}`,
    dataset.description ? `description: ${dataset.description}` : "",
    dataset.sourceNote ? `sourceNote: ${dataset.sourceNote}` : "",
    dataset.taskInstruction ? `taskInstruction: ${dataset.taskInstruction}` : ""
  );

  const finishedAt = new Date().toISOString();
  return {
    layerId: LAYER1_ID,
    ok: true,
    startedAt,
    finishedAt,
    durationMs: Math.round(performance.now() - t0),
    verbalization: {
      profileBlock: profileVerbal,
      metricsBlock: metricsVerbal,
      behaviorBlock: behaviorVerbal,
      peerBlock: peerVerbal,
      metaBlock: meta,
    },
    stats: {
      skillCount: skills.length,
      experienceItemCount: Array.isArray(profile.experienceItems) ? profile.experienceItems.length : 0,
      hasBehaviorSignals: Object.keys(behavior).length > 0,
      hasMetricsSummary: Object.keys(metrics).length > 0,
    },
  };
}
