import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runLayer0LoadDataset } from "../lib/layer0-load-dataset.mjs";
import { runLayer1Verbalize } from "../lib/layer1-verbalize.mjs";
import { runLayer4ParseValidate } from "../lib/layer4-parse-results.mjs";
import { applySlimEnvelope } from "../lib/slim-envelope.mjs";
import { runBehaviorAnalyzerFlow } from "../lib/behavior-analyzer-flow.mjs";
import { runContentAnalyzerFlow } from "../lib/content-analyzer-flow.mjs";

function sampleDataset() {
  return {
    profile: {
      headline: "AI Engineering Leader | 20+ yrs | Founding Member @ Outspark",
      about:
        "I build AI-first products and teams. I focus on applied LLM systems, growth loops, and high-leverage execution.",
      experienceItems: [
        {
          title: "Head of AI",
          company: "Outspark",
          duration: "2020-Present",
          description: "Built AI product org, shipped LLM workflows, and improved conversion pipelines.",
        },
      ],
      skills: ["LLM Systems", "Product Strategy", "GTM"],
      recommendations: ["Strong builder", "Excellent leader"],
      featured: [],
    },
    userContext: {
      declared_niche: "AI Product Engineering",
      career_goal: "Growth",
      geography: "India",
      target_audience: "Founders, product leaders",
      years_experience: "20+",
    },
    behaviorSignals: {
      collectionMethod: "manual_logging",
      tosCompliant: true,
      actionLogs: [
        {
          actionType: "comment",
          targetClassification: "in_niche",
          timestamp: new Date().toISOString(),
          personOrCompany: "Peer A",
          commentLength: 24,
          notes: "Strong analysis",
        },
        {
          actionType: "reaction",
          targetClassification: "in_niche",
          timestamp: new Date().toISOString(),
          personOrCompany: "Peer B",
          commentLength: null,
          notes: null,
        },
      ],
      contentEngagement: { reactionsGiven: 12, commentsWritten: 8, reposts: 1, saves: 4 },
      networkActions: { connectionRequestsSent: 5, connectionRequestsAccepted: 3, messagesSent: 4 },
      contentProduced: { postsPublished: 2, videoMinutesWatchedLearning: 30 },
      recentSearches: ["AI GTM", "LLM Product Lead"],
    },
    contentDraft: {
      postText:
        "Most AI posts fail because they optimize for likes, not saves.\nHere is the 3-step framework we use to drive practical adoption.",
      intendedFormat: "text",
      intendedPublishAt: new Date(Date.now() + 3600000).toISOString(),
    },
    historicalPosts: Array.from({ length: 10 }, (_, i) => ({
      postId: `p-${i + 1}`,
      text: `Post ${i + 1} on AI strategy and execution`,
      format: "text_only",
      publishedAt: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
      impressions: 1200 + i * 100,
      likes: 60 + i * 3,
      comments: 12 + i,
      reposts: 3 + (i % 3),
      saves: 20 + i * 2,
      profileViews: 40 + i,
      follows: 6 + (i % 4),
    })),
  };
}

function validProfileOutput(dataset) {
  return {
    analysis_metadata: {
      user_context: {
        declared_niche: dataset.userContext.declared_niche,
        career_goal: dataset.userContext.career_goal,
        geography: dataset.userContext.geography,
        target_audience: dataset.userContext.target_audience,
        years_experience: dataset.userContext.years_experience,
      },
      analysis_date: new Date().toISOString(),
      framework_version: "v1.0",
    },
    sub_analyses: {
      headline: {
        headline_text: dataset.profile.headline,
        scores: {
          topic_clarity: 8,
          seniority_signal: 9,
          outcome_specificity: 8,
          keyword_density: 8,
          differentiation: 7,
          character_efficiency: 8,
        },
        overall_headline_score: 80,
        issues_found: [],
        rewrite_options: [
          "AI Engineering Leader | 20+ yrs | Outspark Founding Member",
          "AI Product Leader | LLM Systems | 20+ yrs",
          "AI Operator | Product + Engineering | 20+ yrs",
          "AI Strategy & Execution Leader | 20+ yrs",
        ],
      },
      about: {
        about_text: dataset.profile.about,
        scores: {
          first_275_hook: 8,
          topic_coherence: 8,
          specificity_density: 7,
          pillar_definition: 8,
          voice_authenticity: 7,
          cta_presence: 6,
          length_optimization: 8,
        },
        overall_about_score: 76,
        issues_found: [],
        rewrite_options: [
          "I build AI-first products and teams — applied LLM systems, growth loops, execution. DM for product or advisory conversations.",
          "[Outcome-led] Shipped LLM workflows and conversion improvements. I partner with founders on AI product + GTM. Let's connect.",
          "[Who / How / Proof] Operators in AI product: I lead applied GenAI, mentor teams, and ship. Proof: Outspark Head of AI role. Reach out for build vs buy.",
          "[Tighter] AI product + engineering leader (20+ yrs). Focus: LLM systems, reliability, revenue impact. Open to senior IC or leadership roles.",
        ],
      },
      experience: [
        {
          role: "Head of AI",
          company: "Outspark",
          scores: {
            scope_clarity: 8,
            outcome_density: 8,
            strategic_tactical_balance: 7,
            verb_strength: 8,
            skill_tagging_coherence: 8,
            recency_treatment: 8,
          },
          issues_found: [],
        },
      ],
      overall_experience_score: 78,
      skills: {
        scores: {
          top_3_alignment: 8,
          total_skill_count: 7,
          niche_aligned_skills_present: 8,
          boring_filter_skills: 7,
          endorsement_distribution: 6,
          skill_to_experience_coherence: 8,
        },
        overall_skills_score: 74,
        skills_to_add: ["AI Product Analytics"],
        skills_to_remove: [],
        recommended_top_3_order: ["LLM Systems", "Product Strategy", "GTM"],
      },
      recommendations: {
        scores: { count: 7, recency: 7, specificity: 8, senior_source_quality: 7 },
        overall_recommendations_score: 76,
        issues_found: [],
      },
      featured: {
        scores: { item_count: 6, niche_alignment: 7, recency: 6, content_mix: 6 },
        featured_composite_0_to_100: 66,
        recommendations: [
          {
            action: "Add one case-study PDF to featured",
            rationale: "Improves evidence depth",
            confidence: "🟢",
            claim_type: "paper_verified",
          },
        ],
      },
    },
    composite_classification: {
      tier: "NICHE_SPECIALIST",
      score: 78,
      predicted_reach: "niche_average",
      predicted_recruiter_discoverability: "high",
      reasoning: "Clear niche signal with strong seniority alignment.",
      top_3_changes_to_elevate: [
        {
          change: "Add more quantified outcomes in experience",
          expected_impact: "Higher credibility for senior roles",
          confidence: "🟢",
          claim_type: "paper_verified",
        },
        {
          change: "Tighten headline keyword sequencing",
          expected_impact: "Better role relevance matching",
          confidence: "🟡",
          claim_type: "practitioner_observed",
        },
        {
          change: "Refresh featured media quarterly",
          expected_impact: "Improved recency signal",
          confidence: "🔴",
          claim_type: "speculation",
        },
      ],
      realistic_projection_note: "30/60/90 day gains are directional and depend on execution consistency.",
    },
    top_issues: [
      {
        severity: "high",
        issue: "Experience bullets can be more outcome-specific.",
        fix: "Add metrics and business impact in each role.",
        confidence: "🟢",
        claim_type: "paper_verified",
      },
      {
        severity: "medium",
        issue: "Featured section lacks stronger proof artifacts.",
        fix: "Add one case-study and one long-form post link.",
        confidence: "🟡",
        claim_type: "practitioner_observed",
      },
      {
        severity: "low",
        issue: "Posting cadence language is not explicit.",
        fix: "Mention weekly cadence briefly in about section.",
        confidence: "🔴",
        claim_type: "speculation",
      },
    ],
    improvement_projection: {
      "30_days": "Sharper positioning expected.",
      "60_days": "Discoverability can improve with consistency.",
      "90_days": "Compounded signal quality likely if behavior aligns.",
    },
    paper_grounded_disclaimer:
      "Grounded in arXiv 2501.16450. We are NOT LinkedIn. Predictions are directional and not literal LinkedIn scores.",
  };
}

test("Profile analysis end-to-end: ingest -> validate -> UI-ready contract", () => {
  const dataset = sampleDataset();
  const dir = mkdtempSync(join(tmpdir(), "brew-mvp-it-"));
  const file = join(dir, "dataset.json");
  writeFileSync(file, JSON.stringify(dataset, null, 2), "utf8");

  const l0 = runLayer0LoadDataset(file);
  assert.equal(l0.ok, true);

  const l1 = runLayer1Verbalize(l0.dataset);
  assert.equal(l1.ok, true);
  assert.ok(String(l1.verbalization?.profileBlock || "").length > 20);

  const l4 = runLayer4ParseValidate(JSON.stringify(validProfileOutput(dataset)));
  assert.equal(l4.ok, true);

  const envelope = {
    buildInfo: { pipelineVersion: "v1.0" },
    run: { promptVersion: "v1.0", model: "test-model", datasetPath: file, generatedAt: new Date().toISOString() },
    outputValidity: { ok: true, errors: [] },
    results: l4.results,
    pipeline: { layerTrace: [] },
  };
  const slim = applySlimEnvelope(envelope);
  assert.ok(Array.isArray(slim.output_specifications?.critical_issues?.user_facing_cards));
  assert.ok(slim.output_specifications.critical_issues.user_facing_cards.length >= 1);
  assert.equal(
    slim.output_specifications?.ui_ux_specifications?.information_architecture?.ui_ready,
    true
  );

  rmSync(dir, { recursive: true, force: true });
});

test("Behavior logging flow: actions aggregated and trends derived", () => {
  const dataset = sampleDataset();
  const out = runBehaviorAnalyzerFlow(dataset);
  assert.equal(out.flow_id, "behavior_flow");
  assert.ok(out.ratios.niche_coherence >= 0 && out.ratios.niche_coherence <= 100);
  assert.ok(["improving", "stable", "declining"].includes(out.comment_analysis.trend_direction));
  assert.ok(Array.isArray(out.patterns_detected));
});

test("Content analysis flow: context-loaded draft analysis returns structured output", () => {
  const dataset = sampleDataset();
  const profileOut = validProfileOutput(dataset);
  const behaviorOut = runBehaviorAnalyzerFlow(dataset);
  const contentOut = runContentAnalyzerFlow(dataset, profileOut, behaviorOut);

  assert.equal(contentOut.flow_id, "content_flow");
  assert.ok(contentOut.decision_recommendation);
  assert.ok(contentOut.performance_prediction);
  assert.ok(Array.isArray(contentOut.reach_killers_detected));
});
