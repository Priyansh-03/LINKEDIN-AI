/**
 * Module 5 — Reporting & Recommendations flow.
 * Builds cadence reports + prioritization engine across modules.
 */

import { createPromptPassport } from "./prompt-passport.mjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function clamp(min, v, max) {
  return Math.max(min, Math.min(max, v));
}

function toNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function scoreRecommendation(r) {
  const impact = clamp(1, toNum(r.impact, 5), 10);
  const confidence = clamp(1, toNum(r.confidence, 5), 10);
  const urgency = clamp(1, toNum(r.urgency, 5), 10);
  const effort = clamp(1, toNum(r.effort, 5), 10);
  return Number(((impact * confidence * urgency) / effort).toFixed(2));
}

function mapConfidenceEmojiTo10(c) {
  const s = String(c || "").trim();
  if (s === "🟢" || /green/i.test(s)) return 8;
  if (s === "🟡" || /yellow/i.test(s)) return 6;
  if (s === "🔴" || /red/i.test(s)) return 4;
  return 5;
}

function pickPostScore(post) {
  const er = Number(post?.engagementRate);
  if (Number.isFinite(er)) return { value: er, metric: "engagementRate" };
  const imp = Number(post?.impressions);
  if (Number.isFinite(imp)) return { value: imp, metric: "impressions" };
  return { value: null, metric: null };
}

function summarizePost(post, metric) {
  if (!post || typeof post !== "object") return null;
  return {
    post_id: String(post.postId || ""),
    text_preview: String(post.text || "").slice(0, 140),
    format: String(post.format || "unknown"),
    metric_used: metric,
    engagement_rate: Number.isFinite(Number(post.engagementRate)) ? Number(post.engagementRate) : null,
    impressions: Number.isFinite(Number(post.impressions)) ? Number(post.impressions) : null,
    published_at: String(post.publishedAt || ""),
  };
}

const _dir = dirname(fileURLToPath(import.meta.url));
const REPORTING_PROMPT_PATH = join(_dir, "prompts/master-reporting-system.txt");
const REPORTING_PROMPT_TEXT = readFileSync(REPORTING_PROMPT_PATH, "utf8");

/**
 * @param {Record<string, unknown>|null|undefined} dataset
 * @param {Record<string, unknown>|null|undefined} profileOut
 * @param {Record<string, unknown>|null|undefined} behaviorOut
 * @param {Record<string, unknown>|null|undefined} contentOut
 * @param {Record<string, unknown>|null|undefined} comparativeOut
 */
export function runReportingRecommendationsFlow(
  dataset,
  profileOut,
  behaviorOut,
  contentOut,
  comparativeOut
) {
  const todayIso = new Date().toISOString();
  const userName = String(dataset?.profile?.name || "User").trim();
  const behavior = dataset?.behaviorSignals || {};
  const metrics = dataset?.metricsSummary || {};
  const historicalPosts = Array.isArray(dataset?.historicalPosts) ? dataset.historicalPosts : [];

  const actionsLogged =
    toNum(behavior?.contentEngagement?.reactionsGiven) +
    toNum(behavior?.contentEngagement?.commentsWritten) +
    toNum(behavior?.contentEngagement?.reposts) +
    toNum(behavior?.contentEngagement?.saves) +
    toNum(behavior?.networkActions?.connectionRequestsSent) +
    toNum(behavior?.networkActions?.connectionRequestsAccepted);
  const nicheCoherence = toNum(behaviorOut?.ratios?.niche_coherence, 0);
  const seniorSignal = toNum(behaviorOut?.ratios?.senior_signal, 0);
  const isJobSeeker = /job seeking|both/i.test(String(dataset?.userContext?.career_goal || ""));

  const topIssues = Array.isArray(profileOut?.top_issues) ? profileOut.top_issues : [];
  const profileChanges = Array.isArray(profileOut?.composite_classification?.top_3_changes_to_elevate)
    ? profileOut.composite_classification.top_3_changes_to_elevate
    : [];
  const contentEdits = Array.isArray(contentOut?.edit_suggestions) ? contentOut.edit_suggestions : [];
  const compLags = Array.isArray(comparativeOut?.gap_analysis?.user_lags)
    ? comparativeOut.gap_analysis.user_lags
    : [];

  const rawRecommendations = [
    ...profileChanges.map((x) => ({
      category: "PROFILE_FIXES",
      recommendation: String(x?.change || "Profile optimization action"),
      impact: 8,
      confidence: mapConfidenceEmojiTo10(x?.confidence),
      urgency: 7,
      effort: 5,
    })),
    ...contentEdits.map((x) => ({
      category: "CONTENT_STRATEGY",
      recommendation: String(x?.edit || x || "Content optimization action"),
      impact: 7,
      confidence: 6,
      urgency: 8,
      effort: 4,
    })),
    ...compLags.map((x) => ({
      category: "STRATEGIC_PIVOTS",
      recommendation: String(x?.action || "Close comparative performance gap"),
      impact: 8,
      confidence: 6,
      urgency: 6,
      effort: 6,
    })),
    {
      category: "BEHAVIORAL_CHANGES",
      recommendation: "Maintain daily in-niche engagement discipline.",
      impact: 9,
      confidence: 7,
      urgency: 9,
      effort: 4,
    },
    {
      category: "NETWORK_STRATEGY",
      recommendation: "Warm up niche peers/recruiters with substantive comments.",
      impact: 7,
      confidence: 6,
      urgency: 6,
      effort: 5,
    },
  ];

  const prioritized = rawRecommendations
    .map((r) => ({ ...r, priority_score: scoreRecommendation(r) }))
    .sort((a, b) => b.priority_score - a.priority_score);
  const top5 = prioritized.slice(0, 5);

  const dailyMissionReport = {
    greeting: `Good morning, ${userName}!`,
    yesterday_behavior: {
      total_linkedin_actions_logged: actionsLogged,
      niche_coherence_percent: nicheCoherence,
      ...(isJobSeeker ? { senior_signal_percent: seniorSignal } : {}),
    },
    today_mission: {
      engagement_targets: {
        target_count: clamp(5, Math.round(15 - nicheCoherence / 10), 25),
        suggested_topics: [String(dataset?.userContext?.declared_niche || "niche topic"), "related practitioner insights"],
        suggested_people: ["niche peers", "potential collaborators"],
      },
      content_target: {
        post_today: !!dataset?.contentDraft,
        suggested_topic: String(dataset?.userContext?.declared_niche || "niche topic"),
        suggested_format: String(dataset?.contentDraft?.intendedFormat || "text"),
      },
    },
    alerts: topIssues.slice(0, 2).map((x) => x?.issue).filter(Boolean),
    streak_days_niche_discipline: nicheCoherence >= 80 ? 7 : nicheCoherence >= 60 ? 3 : 0,
  };

  const weeklyReport = {
    week_number: "current_week",
    metrics_this_week: {
      profile_views: toNum(metrics?.profileViewsLast90d),
      search_appearances: toNum(metrics?.searchAppearancesLast90d),
      post_impressions_total: toNum(metrics?.postImpressionsLast30d),
      new_followers: 0,
      new_connections: toNum(metrics?.connections),
    },
    behavior_analysis: {
      niche_coherence_percent: nicheCoherence,
      total_linkedin_actions: actionsLogged,
      average_comment_length_words: toNum(behaviorOut?.comment_analysis?.average_comment_length_words),
      reciprocity_ratio: toNum(behaviorOut?.sub_analyses?.E_behavioral_pattern_detection?.response_reciprocity_ratio),
    },
    content_analysis: {
      posts_this_week: toNum(behavior?.contentProduced?.postsPublished),
      best_post: null,
      worst_post: null,
      hook_archetype_variety_check: toNum(contentOut?.sub_analyses?.G_variety_check?.score_1_to_10) >= 6 ? "pass" : "fail",
    },
    red_flags: topIssues.slice(0, 3).map((x) => x?.issue).filter(Boolean),
    next_week_focus: top5.slice(0, 2).map((x) => x.recommendation),
  };

  if (historicalPosts.length) {
    const scored = historicalPosts
      .map((p) => {
        const s = pickPostScore(p);
        return { post: p, score: s.value, metric: s.metric };
      })
      .filter((x) => x.score != null);
    if (scored.length) {
      const sorted = scored.sort((a, b) => /** @type {number} */ (b.score) - /** @type {number} */ (a.score));
      weeklyReport.content_analysis.best_post = summarizePost(sorted[0].post, sorted[0].metric);
      weeklyReport.content_analysis.worst_post = summarizePost(sorted[sorted.length - 1].post, sorted[sorted.length - 1].metric);
    }
  }

  const monthlyReport = {
    month_name: "current_month",
    algorithmic_positioning: {
      profile_classification_trend: String(profileOut?.composite_classification?.tier || "unknown"),
      behavior_classification_trend: String(behaviorOut?.behavioral_classification?.tier || "unknown"),
      composite_score_change: "directional_increase_expected_with_execution",
    },
    growth_metrics: {
      followers_trend: "requires historical tracking input",
      profile_views_trend: toNum(metrics?.profileViewsLast90d),
      search_appearances_trend: toNum(metrics?.searchAppearancesLast90d),
      post_impressions_trend: toNum(metrics?.postImpressionsLast30d),
    },
    content_performance: {
      top_3_posts_of_month: "requires historicalPosts ranking",
      hook_archetypes_used: "derived from historicalPosts when provided",
      topics_covered: String(dataset?.userContext?.declared_niche || ""),
    },
    critical_issues_to_address: topIssues.slice(0, 5).map((x) => x?.issue).filter(Boolean),
    wins_to_celebrate: (comparativeOut?.gap_analysis?.user_leads || []).slice(0, 3),
    next_month_plan: top5.map((x) => x.recommendation),
  };

  const quarterlyDeepDive = {
    schedule: "every_90_days",
    rerun_modules: ["module_1_profile", "module_2_behavior", "module_3_content", "module_4_comparative"],
    compare_against: ["baseline", "last_quarter", "trend_over_time"],
    output: "comprehensive_shareable_report",
  };

  return {
    flow_id: "reporting_recommendations_flow",
    status: "implemented_basic",
    prompt_passport: createPromptPassport({
      layer: "reporting_recommendations_flow",
      module: "reporting_recommendations",
      promptPath: REPORTING_PROMPT_PATH,
      promptText: REPORTING_PROMPT_TEXT,
      promptVersion: "v1.0",
    }),
    analysis_metadata: {
      generated_at: todayIso,
      user_name: userName,
      cadence: ["daily", "weekly", "monthly", "quarterly"],
    },
    reporting_cadence: {
      daily_report: dailyMissionReport,
      weekly_report: weeklyReport,
      monthly_report: monthlyReport,
      quarterly_reaudit: quarterlyDeepDive,
    },
    recommendation_engine: {
      priority_formula: "(Impact * Confidence * Urgency) / Effort",
      top_5_recommendations: top5,
      all_recommendations_ranked: prioritized,
      recommendation_types: [
        "PROFILE_FIXES",
        "BEHAVIORAL_CHANGES",
        "CONTENT_STRATEGY",
        "NETWORK_STRATEGY",
        "STRATEGIC_PIVOTS",
      ],
    },
  };
}
