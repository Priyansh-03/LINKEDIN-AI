/**
 * Minimal valid `sub_analyses` when Pass A LLM output is truncated or unusable
 * (e.g. very low OpenRouter completion budgets). Lets Pass B still run.
 */

/** @param {Record<string, unknown>} dataset */
export function buildFallbackSubAnalyses(dataset) {
  const p = /** @type {Record<string, unknown>} */ (dataset.profile || {});
  const headline = String(p.headline || "").trim().slice(0, 220) || "(empty headline)";
  const about = String(p.about || "").trim().slice(0, 2600) || "(empty about)";
  const skills = Array.isArray(p.skills) ? p.skills.map(String).filter(Boolean).slice(0, 12) : [];
  const top3 = [...skills, "Skill_A", "Skill_B", "Skill_C"].slice(0, 3);
  const expItems = Array.isArray(p.experienceItems) ? p.experienceItems.slice(0, 3) : [];
  const exp0 = expItems[0] || {};
  const title = String(exp0.title || "Role").slice(0, 80);
  const company = String(exp0.company || "Company").slice(0, 60);

  const fallbackIssue = {
    severity: "medium",
    issue: "Fallback estimate used for experience scoring.",
    confidence: "yellow",
    claim_type: "practitioner_observed",
    fix: "Increase pass-A completion budget and re-run.",
  };

  const experienceRows =
    expItems.length > 0
      ? expItems.map((e) => ({
          role: String(e?.title || "Role").slice(0, 80),
          company: String(e?.company || "Company").slice(0, 60),
          scores: {
            scope_clarity: 6,
            outcome_density: 5,
            strategic_tactical_balance: 6,
            verb_strength: 6,
            skill_tagging_coherence: 5,
            recency_treatment: 6,
          },
          issues_found: [fallbackIssue],
        }))
      : [
          {
            role: title,
            company,
            scores: {
              scope_clarity: 6,
              outcome_density: 5,
              strategic_tactical_balance: 6,
              verb_strength: 6,
              skill_tagging_coherence: 5,
              recency_treatment: 6,
            },
            issues_found: [fallbackIssue],
          },
        ];

  return {
    headline: {
      headline_text: headline,
      scores: {
        topic_clarity: 6,
        seniority_signal: 6,
        outcome_specificity: 5,
        keyword_density: 6,
        differentiation: 5,
        character_efficiency: 6,
      },
      overall_headline_score: 58,
      issues_found: [
        {
          severity: "medium",
          issue: "Fallback estimate used for headline quality.",
          confidence: "yellow",
          claim_type: "practitioner_observed",
          fix: "Re-run with sufficient token budget for full pass-A output.",
        },
      ],
      rewrite_options: [
        headline,
        `${headline.split("|")[0]?.trim() || "AI/ML professional"} | Building production-grade AI systems`,
        `${headline.split("|")[0]?.trim() || "AI/ML professional"} | Applied GenAI, NLP, and scalable cloud delivery`,
        `${headline.split("|")[0]?.trim() || "AI/ML professional"} | Turning ML prototypes into measurable outcomes`,
      ],
    },
    about: {
      about_text: about,
      scores: {
        first_275_hook: 5,
        topic_coherence: 6,
        specificity_density: 5,
        pillar_definition: 5,
        voice_authenticity: 6,
        cta_presence: 5,
        length_optimization: 6,
      },
      overall_about_score: 55,
      issues_found: [
        {
          severity: "medium",
          issue: "Fallback estimate used for about section.",
          confidence: "yellow",
          claim_type: "practitioner_observed",
          fix: "Re-run pass-A for precise section-level diagnostics.",
        },
      ],
    },
    experience: experienceRows,
    overall_experience_score: 57,
    skills: {
      scores: {
        top_3_alignment: 6,
        total_skill_count: 6,
        niche_aligned_skills_present: 6,
        boring_filter_skills: 5,
        endorsement_distribution: 5,
        skill_to_experience_coherence: 6,
      },
      overall_skills_score: 57,
      skills_to_add: skills.slice(0, 2).length ? skills.slice(0, 2) : ["Clarify stack"],
      skills_to_remove: [],
      recommended_top_3_order: top3,
    },
    recommendations: {
      scores: {
        count: 5,
        recency: 5,
        specificity: 5,
        senior_source_quality: 5,
      },
      overall_recommendations_score: 50,
      issues_found: [
        {
          severity: "medium",
          issue: "Fallback estimate used for recommendations section.",
          confidence: "yellow",
          claim_type: "practitioner_observed",
          fix: "Provide richer recommendation evidence and re-run pass-A.",
        },
      ],
    },
    featured: {
      scores: {
        item_count: 5,
        niche_alignment: 5,
        recency: 5,
        content_mix: 5,
      },
      featured_composite_0_to_100: 55,
      recommendations: [
        {
          action: "Refresh featured",
          rationale: "Fallback estimate: strengthen proof artifacts.",
          confidence: "yellow",
          claim_type: "practitioner_observed",
        },
        {
          action: "Align niche",
          rationale: "Fallback estimate: align featured items to declared niche.",
          confidence: "yellow",
          claim_type: "practitioner_observed",
        },
      ],
    },
  };
}
