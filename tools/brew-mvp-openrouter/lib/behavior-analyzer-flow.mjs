/**
 * Module 2 — Behavior Analyzer flow.
 * Separate input-driven flow that computes A-F behavior sub-analyses.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPromptPassport } from "./prompt-passport.mjs";

function clamp(min, v, max) {
  return Math.max(min, Math.min(max, v));
}

function pct(num, den) {
  if (!den) return 0;
  return Math.round((num / den) * 100);
}

function avg(nums) {
  const list = Array.isArray(nums) ? nums.filter((n) => Number.isFinite(n)) : [];
  if (!list.length) return 0;
  return Math.round(list.reduce((a, b) => a + b, 0) / list.length);
}

function classifyBand(value, strongMin, mixedMin, strongLabel, mixedLabel, weakLabel) {
  if (value >= strongMin) return strongLabel;
  if (value >= mixedMin) return mixedLabel;
  return weakLabel;
}

function toBehaviorTier(score) {
  if (score >= 90) return "STRONG_NICHE_OPERATOR";
  if (score >= 75) return "CLEAR_NICHE_PARTICIPANT";
  if (score >= 50) return "SCATTERED_PROFESSIONAL";
  return "DILUTED_SIGNAL";
}

function toJobSeekerTier(score, niche, senior, targetCompany) {
  if (niche >= 80 && senior >= 60 && targetCompany >= 30 && score >= 90) return "ACTIVE_SENIOR_JOB_SEEKER";
  if (score >= 75) return "LATENT_SENIOR_PROSPECT";
  if (score >= 50) return "PASSIVE_SENIOR";
  return "WRONG_LEVEL_SIGNALING";
}

const _dir = dirname(fileURLToPath(import.meta.url));
const BEHAVIOR_PROMPT_PATH = join(_dir, "prompts/behavior-analyzer-system.txt");
const BEHAVIOR_PROMPT_TEXT = readFileSync(BEHAVIOR_PROMPT_PATH, "utf8");

/**
 * @param {Record<string, unknown>|null|undefined} dataset
 */
export function runBehaviorAnalyzerFlow(dataset) {
  const userCtx = dataset?.userContext || {};
  const b = dataset?.behaviorSignals || {};
  const actionLogs = Array.isArray(b?.actionLogs) ? b.actionLogs : [];
  const goal = String(userCtx?.career_goal || "").trim().toLowerCase();
  const isJobSeeker = goal === "job seeking" || goal === "both";

  const totalActions = actionLogs.length;
  const inNiche = actionLogs.filter((x) => x?.targetClassification === "in_niche").length;
  const seniorActions = actionLogs.filter((x) => x?.targetClassification === "senior_content").length;
  const targetCompanyActions = actionLogs.filter((x) => x?.targetClassification === "target_company_content").length;
  const offNiche = actionLogs.filter((x) => x?.targetClassification === "off_niche").length;

  const commentLogs = actionLogs.filter((x) => x?.actionType === "comment");
  const reactionLogs = actionLogs.filter((x) => x?.actionType === "reaction");
  const commentLengths = commentLogs
    .map((x) => Number(x?.commentLength))
    .filter((n) => Number.isFinite(n) && n >= 0);
  const substantive = commentLengths.filter((n) => n >= 15).length;

  const recentSearches = Array.isArray(b?.recentSearches) ? b.recentSearches.length : 0;
  const content = b?.contentEngagement || {};
  const network = b?.networkActions || {};

  // A) Niche Coherence Ratio
  const nicheCoherenceRatio = totalActions
    ? pct(inNiche, totalActions)
    : clamp(0, Math.round(40 + recentSearches * 8), 100);
  const nicheBand = classifyBand(
    nicheCoherenceRatio,
    80,
    50,
    "target_achieved",
    "mixed",
    "diluted"
  );

  // B) Senior Signal Ratio (job seekers)
  const seniorSignalRatio = inNiche > 0 ? pct(seniorActions, inNiche) : 0;
  const seniorBand = classifyBand(
    seniorSignalRatio,
    60,
    30,
    "target_achieved",
    "mixed",
    "weak"
  );

  // C) Target company ratio (job seekers)
  const targetCompanyRatio = seniorActions > 0 ? pct(targetCompanyActions, seniorActions) : 0;
  const targetCompanyBand = classifyBand(
    targetCompanyRatio,
    30,
    10,
    "target_achieved",
    "mixed",
    "weak"
  );

  // D) Comment quality trend
  const avgCommentLength = avg(commentLengths);
  const substantiveShare = commentLogs.length ? pct(substantive, commentLogs.length) : 0;
  const commentToReactionRatio = reactionLogs.length ? Number((commentLogs.length / reactionLogs.length).toFixed(2)) : 0;
  const trendDirection = avgCommentLength >= 18 ? "improving" : avgCommentLength >= 10 ? "stable" : "declining";

  // E) Pattern detection (lightweight heuristics)
  const nicheDrift = offNiche > inNiche ? "high_drift" : offNiche > 0 ? "moderate_drift" : "low_drift";
  const totalNetwork = Number(network?.connectionRequestsSent || 0) + Number(network?.messagesSent || 0);
  const burstDrought = totalNetwork >= 25 || totalActions >= 40 ? "consistent_or_high" : "erratic_or_low";
  const reciprocityRatio = Number(network?.connectionRequestsSent || 0)
    ? Number(
        (
          Number(network?.connectionRequestsAccepted || 0) / Number(network?.connectionRequestsSent || 1)
        ).toFixed(2)
      )
    : 0;
  const reciprocityBand = reciprocityRatio >= 0.6 ? "healthy" : reciprocityRatio >= 0.3 ? "mixed" : "low";
  const offNicheConcentration = offNiche > 0 ? (offNiche <= 2 ? "clustered_recoverable" : "spread_chronic") : "none";

  // F) Predicted behavioral classification
  const behaviorScore = Math.round(
    nicheCoherenceRatio * 0.4 +
      seniorSignalRatio * (isJobSeeker ? 0.2 : 0.05) +
      targetCompanyRatio * (isJobSeeker ? 0.15 : 0.0) +
      clamp(0, avgCommentLength * 4, 100) * 0.15 +
      clamp(0, substantiveShare, 100) * 0.1 +
      clamp(0, Math.round(reciprocityRatio * 100), 100) * 0.1
  );
  const behaviorTier = toBehaviorTier(behaviorScore);
  const jobSeekerTier = isJobSeeker
    ? toJobSeekerTier(behaviorScore, nicheCoherenceRatio, seniorSignalRatio, targetCompanyRatio)
    : null;

  const analysisMetadata = {
    declared_niche: String(userCtx?.declared_niche || "").trim(),
    career_goal: String(userCtx?.career_goal || "").trim(),
    years_experience: String(userCtx?.years_experience || "").trim(),
    analysis_date: new Date().toISOString(),
    methodology: "arXiv 2501.16450 behavior verbalization + ratio synthesis",
  };

  const patternsDetected = [
    { pattern: "niche_drift", value: nicheDrift, severity: nicheDrift === "high_drift" ? "high" : "medium" },
    { pattern: "engagement_burst_drought", value: burstDrought, severity: burstDrought.includes("erratic") ? "medium" : "low" },
    { pattern: "response_reciprocity", value: reciprocityBand, severity: reciprocityBand === "low" ? "high" : "low" },
    { pattern: "off_niche_concentration", value: offNicheConcentration, severity: offNicheConcentration.includes("chronic") ? "high" : "low" },
  ];

  const resetProtocol =
    nicheCoherenceRatio < 50
      ? [
          "Set daily target: 5 in-niche engagements, 0 off-niche engagements.",
          "Comment only on declared-niche and senior-content posts for 30 days.",
          "Track weekly niche coherence and adjust topics if off-niche drift persists.",
        ]
      : [];

  const weeklyActions = [
    "Maintain 80%+ in-niche engagement discipline.",
    "Prioritize substantive comments (15+ words) over low-signal reactions.",
    isJobSeeker ? "Engage with target company and hiring-manager content weekly." : "Sustain reciprocal engagement with niche peers.",
  ];

  return {
    flow_id: "behavior_flow",
    prompt_passport: createPromptPassport({
      layer: "behavior_flow",
      module: "behavior_analyzer",
      promptPath: BEHAVIOR_PROMPT_PATH,
      promptText: BEHAVIOR_PROMPT_TEXT,
      promptVersion: "v1.0",
    }),
    collection_method: String(b?.collectionMethod || "manual_logging"),
    is_job_seeker_mode: isJobSeeker,
    analysis_metadata: analysisMetadata,
    ratios: {
      niche_coherence: nicheCoherenceRatio,
      senior_signal: seniorSignalRatio,
      target_company_engagement: targetCompanyRatio,
    },
    comment_analysis: {
      average_comment_length_words: avgCommentLength,
      substantive_vs_perfunctory_distribution: {
        substantive_percent: substantiveShare,
        perfunctory_percent: clamp(0, 100 - substantiveShare, 100),
      },
      comment_to_reaction_ratio: commentToReactionRatio,
      trend_direction: trendDirection,
    },
    patterns_detected: patternsDetected,
    behavioral_classification: {
      score_0_to_100: clamp(0, behaviorScore, 100),
      tier: behaviorTier,
      job_seeker_tier: jobSeekerTier,
      reasoning:
        "Classification is synthesized from niche coherence, senior and target-company signaling, comment quality, and reciprocity patterns.",
    },
    "30_day_reset_protocol": resetProtocol,
    weekly_action_recommendations: weeklyActions,
    paper_grounded_disclaimer:
      "This behavior analysis applies methodology from arXiv 2501.16450. Predictions are directional and not literal LinkedIn ranking scores.",
    sub_analyses: {
      A_niche_coherence_ratio: {
        formula: "(in_niche_actions / total_actions) * 100",
        value: nicheCoherenceRatio,
        target: "80%+",
        band: nicheBand,
      },
      B_senior_signal_ratio: {
        formula: "(senior_content_actions / total_in_niche_actions) * 100",
        value: seniorSignalRatio,
        target: "60%+ (job seekers)",
        band: seniorBand,
      },
      C_target_company_ratio: {
        formula: "(target_company_actions / total_senior_actions) * 100",
        value: targetCompanyRatio,
        target: "30%+ (job seekers)",
        band: targetCompanyBand,
      },
      D_comment_quality_trend: {
        avg_comment_length_words: avgCommentLength,
        substantive_share_percent: substantiveShare,
        comment_to_reaction_ratio: commentToReactionRatio,
        trend_direction: trendDirection,
      },
      E_behavioral_pattern_detection: {
        niche_drift_detection: nicheDrift,
        engagement_burst_drought_pattern: burstDrought,
        response_reciprocity_ratio: reciprocityRatio,
        response_reciprocity_band: reciprocityBand,
        off_niche_concentration: offNicheConcentration,
      },
      F_predicted_behavioral_classification: {
        score_0_to_100: clamp(0, behaviorScore, 100),
        classification: behaviorTier,
        job_seeker_classification: jobSeekerTier,
      },
    },
  };
}
