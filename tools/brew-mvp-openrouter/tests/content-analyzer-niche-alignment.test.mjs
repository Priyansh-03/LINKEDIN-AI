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
    composite_classification: { tier: "NICHE_SPECIALIST", score: 72 },
  };
}

test("AIML-style niche + pure sales draft: low identity alignment, track mismatch, capped composite", () => {
  const dataset = {
    profile: { headline: "ML Engineer", about: "Ship ranking models.", experienceItems: [], skills: [], recommendations: [], featured: [] },
    userContext: {
      declared_niche: "Applied AIML — ranking, retrieval, and model quality",
      target_audience: "ML engineers and tech leads",
      career_goal: "",
      geography: "",
      years_experience: "",
    },
    behaviorSignals: {
      collectionMethod: "manual_logging",
      tosCompliant: true,
      actionLogs: [],
      contentEngagement: {},
      networkActions: {},
      contentProduced: {},
      recentSearches: [],
    },
    contentDraft: {
      postText: [
        "If your AE team is missing quota, the problem is rarely talent.",
        "Here is the 4-step pipeline review we run with RevOps: forecast hygiene, deal velocity, discount policy, and procurement timing.",
        "SDRs should book fewer meetings and better ones — pipeline coverage beats activity metrics.",
        "What is killing your win rate this quarter?",
      ].join("\n"),
      intendedFormat: "text",
      intendedPublishAt: new Date().toISOString(),
    },
    historicalPosts: [],
  };
  const behaviorOut = runBehaviorAnalyzerFlow(dataset);
  const contentOut = runContentAnalyzerFlow(dataset, minimalProfileOut(dataset.userContext.declared_niche), behaviorOut);

  assert.equal(contentOut.status, "implemented_basic");
  assert.equal(contentOut.draft_analysis_metadata?.niche_draft_track_mismatch, true);
  assert.ok(contentOut.coherence_checks.declared_identity_alignment <= 35, "identity alignment should collapse for sales-heavy off-niche draft");
  assert.ok(contentOut.composite_quality_score <= 36, "composite should be strongly capped for niche track mismatch");
  assert.ok(
    contentOut.top_5_issues.some((x) => String(x.issue || "").toLowerCase().includes("track mismatch")),
    "expected track mismatch issue"
  );
});

test("Same niche + on-topic ML draft: no track mismatch, higher alignment than sales-only", () => {
  const dataset = {
    profile: { headline: "ML Engineer", about: "Ship ranking models.", experienceItems: [], skills: [], recommendations: [], featured: [] },
    userContext: {
      declared_niche: "Applied AIML — ranking, retrieval, and model quality",
      target_audience: "ML engineers",
      career_goal: "",
      geography: "",
      years_experience: "",
    },
    behaviorSignals: {
      collectionMethod: "manual_logging",
      tosCompliant: true,
      actionLogs: [],
      contentEngagement: {},
      networkActions: {},
      contentProduced: {},
      recentSearches: [],
    },
    contentDraft: {
      postText: [
        "We shipped a new embedding model for retrieval and measured recall@10 on our benchmark dataset.",
        "Training used PyTorch; inference latency dropped after batching and a small distillation step.",
        "Happy to share the eval notebook and the ablation we ran on the ranking head.",
      ].join("\n"),
      intendedFormat: "text",
      intendedPublishAt: new Date().toISOString(),
    },
    historicalPosts: [],
  };
  const behaviorOut = runBehaviorAnalyzerFlow(dataset);
  const contentOut = runContentAnalyzerFlow(dataset, minimalProfileOut(dataset.userContext.declared_niche), behaviorOut);

  assert.equal(contentOut.draft_analysis_metadata?.niche_draft_track_mismatch, false);
  assert.ok(contentOut.coherence_checks.declared_identity_alignment >= 45);
  assert.ok(contentOut.composite_quality_score > 40);
});
