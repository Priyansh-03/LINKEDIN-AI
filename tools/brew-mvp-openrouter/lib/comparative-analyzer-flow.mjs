/**
 * Module 4 — Comparative Intelligence flow.
 * Calibration vs manual peer benchmark (no scraping/automation).
 */
import { createPromptPassport } from "./prompt-passport.mjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function clamp(min, v, max) {
  return Math.max(min, Math.min(max, v));
}

function median(nums) {
  const arr = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!arr.length) return null;
  const mid = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
}

function topQuartile(nums) {
  const arr = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!arr.length) return null;
  const idx = Math.max(0, Math.floor(arr.length * 0.75) - 1);
  return arr[idx];
}

function percentileBand(gap) {
  if (gap == null) return "unknown";
  if (gap >= 12) return "Top 25%";
  if (gap >= 0) return "50th-75th percentile";
  if (gap >= -10) return "25th-50th percentile";
  return "Bottom 25%";
}

const _dir = dirname(fileURLToPath(import.meta.url));
const COMP_PROMPT_PATH = join(_dir, "prompts/comparative-intelligence-system.txt");
const COMP_PROMPT_TEXT = readFileSync(COMP_PROMPT_PATH, "utf8");

function profileScoresFromOutput(profileOut) {
  const sa = profileOut?.sub_analyses || {};
  return {
    headline: Number(sa?.headline?.overall_headline_score || 0),
    about: Number(sa?.about?.overall_about_score || 0),
    experience: Number(sa?.experience?.overall_experience_score || 0),
    skills: Number(sa?.skills?.overall_skills_score || 0),
    recommendations: Number(sa?.recommendations?.overall_recommendations_score || 0),
    featured: Number(sa?.featured?.overall_featured_score || 0),
  };
}

/**
 * @param {Record<string, unknown>|null|undefined} dataset
 * @param {Record<string, unknown>|null|undefined} profileOut
 * @param {Record<string, unknown>|null|undefined} behaviorOut
 * @param {Record<string, unknown>|null|undefined} contentOut
 */
export function runComparativeAnalyzerFlow(dataset, profileOut, behaviorOut, contentOut) {
  const peers = dataset?.peerBenchmark;
  if (!peers || typeof peers !== "object") {
    return {
      flow_id: "comparative_flow",
      status: "awaiting_manual_peer_inputs",
      prompt_passport: createPromptPassport({
        layer: "comparative_flow",
        module: "comparative_intelligence",
        promptPath: COMP_PROMPT_PATH,
        promptText: COMP_PROMPT_TEXT,
        promptVersion: "v1.0",
      }),
      missing_inputs: ["peerBenchmark.peerProfiles[] (manual)", "peerBenchmark.tosCompliant=true"],
    };
  }

  const peerProfiles = Array.isArray(peers.peerProfiles) ? peers.peerProfiles : [];
  const userProfile = profileScoresFromOutput(profileOut);

  const profileDims = [
    { k: "headline", label: "headline_strength", peerKey: "headlineScore" },
    { k: "about", label: "about_depth", peerKey: "aboutScore" },
    { k: "experience", label: "experience_quality", peerKey: "experienceScore" },
    { k: "skills", label: "skills_coverage", peerKey: "skillsScore" },
    { k: "recommendations", label: "recommendations_count_quality", peerKey: "recommendationsScore" },
    { k: "featured", label: "featured_usage", peerKey: "featuredScore" },
  ];

  const profileComparison = profileDims.map((d) => {
    const peerVals = peerProfiles.map((p) => Number(p?.[d.peerKey])).filter((n) => Number.isFinite(n));
    const med = median(peerVals);
    const topQ = topQuartile(peerVals);
    const user = userProfile[d.k];
    return {
      dimension: d.label,
      user_score: user,
      peer_median_score: med,
      peer_top_quartile_score: topQ,
      gap_vs_median: med == null ? null : Math.round(user - med),
      percentile_band: percentileBand(med == null ? null : Math.round(user - med)),
    };
  });

  const postsPerWeekUser = Number(dataset?.metricsSummary?.postsPerWeek || dataset?.behaviorSignals?.contentProduced?.postsPublished || 0);
  const peerPostsPerWeek = peerProfiles.map((p) => Number(p?.postsPerWeek)).filter((n) => Number.isFinite(n));
  const peerEngagementRates = peerProfiles.map((p) => Number(p?.avgEngagementRate)).filter((n) => Number.isFinite(n));
  const userEngagementProxy = Number(dataset?.metricsSummary?.postImpressionsLast30d || 0) > 0 ? 3.2 : 1.8;
  const contentStrategyComparison = {
    posting_frequency_posts_per_week: {
      user: postsPerWeekUser,
      peer_median: median(peerPostsPerWeek),
      peer_top_performers: topQuartile(peerPostsPerWeek),
    },
    average_engagement_rate: {
      user: userEngagementProxy,
      peer_median: median(peerEngagementRates),
      peer_top_performers: topQuartile(peerEngagementRates),
    },
    format_mix_user: contentOut?.format_analysis ? { intended_format: contentOut?.draft_analysis_metadata?.intended_format || null } : null,
  };

  const behaviorComparison = {
    engagement_frequency: {
      user: Number(dataset?.behaviorSignals?.contentEngagement?.reactionsGiven || 0) + Number(dataset?.behaviorSignals?.contentEngagement?.commentsWritten || 0),
      peer_median: median(peerProfiles.map((p) => Number(p?.engagementFrequency)).filter(Number.isFinite)),
    },
    comment_to_reaction_ratio: {
      user: Number(contentOut?.sub_analyses?.C_behavior_content_coherence?.scores_1_to_10?.audience_pre_warming || 0) / 10,
      peer_median: median(peerProfiles.map((p) => Number(p?.commentReactionRatio)).filter(Number.isFinite)),
    },
    network_composition: {
      user: "inferred_from_manual_data",
      peer_benchmark: "manual_benchmark_inputs",
    },
  };

  const leads = profileComparison.filter((x) => x.gap_vs_median != null && x.gap_vs_median > 0).map((x) => x.dimension);
  const lags = profileComparison
    .filter((x) => x.gap_vs_median != null && x.gap_vs_median < 0)
    .map((x) => ({
      area: x.dimension,
      severity: Math.abs(Number(x.gap_vs_median)) >= 15 ? "high" : "medium",
      action: `Raise ${x.dimension} via focused edits over next 30 days.`,
    }));
  const neutral = profileComparison.filter((x) => x.gap_vs_median === 0).map((x) => x.dimension);
  const currentTier = String(profileOut?.composite_classification?.tier || "GENERIC_PROFESSIONAL");
  const nextTierTarget =
    currentTier === "CONFUSED_SIGNAL"
      ? "GENERIC_PROFESSIONAL"
      : currentTier === "GENERIC_PROFESSIONAL"
        ? "NICHE_SPECIALIST"
        : currentTier === "NICHE_SPECIALIST"
          ? "AUTHORITY_FIGURE"
          : "AUTHORITY_FIGURE";
  const estimatedTimeline = lags.length >= 3 ? "90+ days" : lags.length >= 1 ? "60-90 days" : "30-60 days";
  const topPerformerPatterns = [
    "Clear niche-specific headline and profile positioning.",
    "Consistent in-niche posting cadence with varied hook archetypes.",
    "Higher proportion of substantive comments and reciprocal engagement.",
  ];

  return {
    flow_id: "comparative_flow",
    status: "implemented_basic",
    prompt_passport: createPromptPassport({
      layer: "comparative_flow",
      module: "comparative_intelligence",
      promptPath: COMP_PROMPT_PATH,
      promptText: COMP_PROMPT_TEXT,
      promptVersion: "v1.0",
    }),
    analysis_metadata: {
      declared_niche: String(dataset?.userContext?.declared_niche || ""),
      seniority_level: String(dataset?.userContext?.years_experience || ""),
      geography: String(dataset?.userContext?.geography || ""),
      career_goal: String(dataset?.userContext?.career_goal || ""),
      peers_count: peerProfiles.length,
      tos_compliant_manual_mode: peers?.tosCompliant === true,
    },
    comparison_metadata: {
      niche: String(dataset?.userContext?.declared_niche || ""),
      seniority: String(dataset?.userContext?.years_experience || ""),
      geography: String(dataset?.userContext?.geography || ""),
      career_goal: String(dataset?.userContext?.career_goal || ""),
      peers_count: peerProfiles.length,
      manual_public_data_mode: true,
    },
    profile_comparison: {
      dimensions: profileComparison,
      overall_percentile:
        lags.length >= 4
          ? "25th-50th percentile"
          : lags.length >= 2
            ? "50th-75th percentile"
            : "Top 25%",
    },
    content_comparison: contentStrategyComparison,
    behavior_comparison: behaviorComparison,
    gap_analysis: {
      user_leads: leads.slice(0, 3),
      user_lags: lags.slice(0, 3).map((x) => ({
        area: x.area,
        severity: x.severity,
        action: x.action,
        estimated_effort: x.severity === "high" ? "6-12 weeks" : "3-6 weeks",
      })),
      neutral_zones: neutral,
      actions_30_60_90: {
        "30_days": "Fix top one lagging profile dimension and improve posting consistency.",
        "60_days": "Close two medium gaps via profile + behavior optimization loop.",
        "90_days": "Consolidate gains and aim tier progression with stable engagement quality.",
      },
    },
    trajectory: {
      current_tier: currentTier,
      next_tier_target: nextTierTarget,
      estimated_timeline: estimatedTimeline,
    },
    peer_insights: {
      top_performers_do_differently: topPerformerPatterns,
      adoptable_patterns_with_confidence: [
        { pattern: "Niche-specific positioning", confidence: "🟢" },
        { pattern: "Consistent posting rhythm", confidence: "🟡" },
        { pattern: "Substantive comment discipline", confidence: "🟡" },
      ],
    },
    paper_grounded_disclaimer:
      "Comparative calibration is directional and uses user-provided public peer inputs. No scraping/automation is used. 360Brew paper mechanics are used where applicable.",
    sub_analyses: {
      A_profile_tier_comparison: profileComparison,
      B_content_strategy_comparison: contentStrategyComparison,
      C_behavioral_pattern_comparison: behaviorComparison,
      D_gap_analysis: {
        gaps_where_user_leads: leads,
        gaps_where_user_lags: lags,
        neutral_zones: neutral,
      },
    },
  };
}
