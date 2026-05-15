import test from "node:test";
import assert from "node:assert/strict";
import { runContentAnalyzerFlow } from "../lib/content-analyzer-flow.mjs";
import { runBehaviorAnalyzerFlow } from "../lib/behavior-analyzer-flow.mjs";

function minimalProfileOut(declaredNiche) {
  return {
    analysis_metadata: {
      user_context: {
        declared_niche: declaredNiche,
        career_goal: "",
        geography: "",
        target_audience: "",
        years_experience: "",
      },
      analysis_date: new Date().toISOString(),
      framework_version: "1.0",
    },
    composite_classification: { tier: "GENERIC_PROFESSIONAL", score: 55 },
  };
}

const tinyBehavior = {
  collectionMethod: "manual_logging",
  tosCompliant: true,
  actionLogs: [],
  contentEngagement: {},
  networkActions: {},
  contentProduced: {},
  recentSearches: [],
};

test("Micro post (e.g. 'i am eating.') — composite very low, not ~40s from neutral floors", () => {
  const dataset = {
    profile: { headline: "Engineer", about: "Builder.", experienceItems: [], skills: [], recommendations: [], featured: [] },
    userContext: {
      declared_niche: "Applied ML",
      target_audience: "",
      career_goal: "",
      geography: "",
      years_experience: "",
    },
    behaviorSignals: tinyBehavior,
    contentDraft: {
      postText: "i am eating.",
      intendedFormat: "text",
      intendedPublishAt: new Date().toISOString(),
    },
    historicalPosts: [],
  };
  const behaviorOut = runBehaviorAnalyzerFlow(dataset);
  const out = runContentAnalyzerFlow(dataset, minimalProfileOut("Applied ML"), behaviorOut);

  assert.equal(out.draft_analysis_metadata?.draft_substance_tier, "micro");
  assert.ok(out.composite_quality_score <= 12, `expected micro cap, got ${out.composite_quality_score}`);
  assert.equal(out.draft_analysis_metadata?.draft_audience_primary_key, "not_routable_minimal");
  assert.ok(String(out.draft_analysis_metadata?.draft_audience_label || "").toLowerCase().includes("not routable"));
  assert.ok(typeof out.draft_analysis_metadata?.draft_profile_drift_score_0_to_100 === "number");
  assert.ok(Number(out.draft_analysis_metadata?.draft_profile_drift_score_0_to_100) >= 75);
  assert.ok(
    out.reach_killers_detected?.some((k) => String(k.name) === "insufficient_substance_micro_post"),
    "expected substance reach-killer flag"
  );
  assert.ok(out.top_5_issues.some((x) => String(x.issue || "").toLowerCase().includes("too short")));
});

test("Normal-length draft still scores above micro cap", () => {
  const dataset = {
    profile: { headline: "ML Engineer", about: "Ranking systems.", experienceItems: [], skills: [], recommendations: [], featured: [] },
    userContext: {
      declared_niche: "ML ranking and retrieval",
      target_audience: "Engineers",
      career_goal: "",
      geography: "",
      years_experience: "",
    },
    behaviorSignals: tinyBehavior,
    contentDraft: {
      postText: [
        "We shipped a new retrieval pipeline and measured recall@10 on our offline benchmark.",
        "The biggest win was hardening evaluation: held-out queries, human spot checks, and latency SLOs before launch.",
        "If you are building ranking in production, what is one metric you refuse to ship without?",
      ].join("\n"),
      intendedFormat: "text",
      intendedPublishAt: new Date().toISOString(),
    },
    historicalPosts: [],
  };
  const behaviorOut = runBehaviorAnalyzerFlow(dataset);
  const out = runContentAnalyzerFlow(dataset, minimalProfileOut(dataset.userContext.declared_niche), behaviorOut);

  assert.equal(out.draft_analysis_metadata?.draft_substance_tier, "normal");
  assert.ok(out.composite_quality_score > 25);
});
