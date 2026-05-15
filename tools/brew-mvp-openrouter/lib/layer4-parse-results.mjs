/**
 * Layer 4 — parse & validate PRD Profile Analyzer JSON (§7 output contract).
 * Supports single-pass text or two-pass merge (Pass A sub_analyses + Pass B synthesis).
 */

export const LAYER4_ID = "L4_parse_validate";
import {
  isClaimTypeConsistent,
  normalizeConfidenceKey,
  toClaimTypeFromConfidence,
} from "./confidence-taxonomy.mjs";

const TOP_LEVEL_KEYS = [
  "analysis_metadata",
  "sub_analyses",
  "composite_classification",
  "top_issues",
  "improvement_projection",
  "paper_grounded_disclaimer",
];

const TIER_ENUM = new Set([
  "AUTHORITY_FIGURE",
  "NICHE_SPECIALIST",
  "GENERIC_PROFESSIONAL",
  "CONFUSED_SIGNAL",
]);
const PREDICTED_REACH = new Set(["above_niche_average", "niche_average", "below_niche_average", "low"]);
const RECRUITER_DISCOVERABILITY = new Set(["very_high", "high", "medium", "low"]);

const SEVERITY = new Set(["critical", "high", "medium", "low"]);
const CLAIM_TYPE = new Set(["paper_verified", "practitioner_observed", "speculation"]);

export function parseJsonObject(text) {
  let t = String(text || "").trim();
  if (!t) return {};
  if (t.startsWith("```")) {
    const lines = t.split("\n");
    if (lines[0]?.startsWith("```")) lines.shift();
    if (lines.at(-1)?.trim() === "```") lines.pop();
    t = lines.join("\n").trim();
  }
  try {
    return JSON.parse(t);
  } catch {
    const s = t.indexOf("{");
    const e = t.lastIndexOf("}");
    if (s >= 0 && e > s) {
      try {
        return JSON.parse(t.slice(s, e + 1));
      } catch {
        /* ignore */
      }
    }
  }
  return {};
}

function isRecord(x) {
  return x != null && typeof x === "object" && !Array.isArray(x);
}

/**
 * Models often emit rubric values as strings ("7"). `JSON.parse` keeps them as strings;
 * our validators and slim `scoreBlock` then fail or fall back to default 6/7.
 * Mutates `sub` in place.
 * @param {unknown} sub
 */
export function coerceSubAnalysesNumericScores(sub) {
  if (!isRecord(sub)) return;

  const toFiniteNumber = (v) => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(String(v).trim().replace(/,/g, ""));
      if (Number.isFinite(n)) return n;
    }
    return null;
  };

  const coerceScoresRecord = (sc) => {
    if (!isRecord(sc)) return;
    for (const k of Object.keys(sc)) {
      const n = toFiniteNumber(sc[k]);
      if (n != null) sc[k] = n;
    }
  };

  const coerceKey = (o, key) => {
    if (!isRecord(o) || !(key in o)) return;
    const n = toFiniteNumber(o[key]);
    if (n != null) o[key] = n;
  };

  for (const blockKey of ["headline", "about", "skills", "recommendations", "featured"]) {
    const o = sub[blockKey];
    if (!isRecord(o)) continue;
    if (isRecord(o.scores)) coerceScoresRecord(o.scores);
    if (blockKey === "headline") coerceKey(o, "overall_headline_score");
    if (blockKey === "about") coerceKey(o, "overall_about_score");
    if (blockKey === "skills") coerceKey(o, "overall_skills_score");
    if (blockKey === "recommendations") coerceKey(o, "overall_recommendations_score");
    if (blockKey === "featured") coerceKey(o, "featured_composite_0_to_100");
  }

  coerceKey(sub, "overall_experience_score");

  const exp = sub.experience;
  if (Array.isArray(exp)) {
    for (const row of exp) {
      if (isRecord(row) && isRecord(row.scores)) coerceScoresRecord(row.scores);
    }
  }
}

function tierForScore(score) {
  if (score >= 90) return "AUTHORITY_FIGURE";
  if (score >= 75) return "NICHE_SPECIALIST";
  if (score >= 50) return "GENERIC_PROFESSIONAL";
  return "CONFUSED_SIGNAL";
}

function isConfidenceValid(v) {
  return normalizeConfidenceKey(v) != null;
}

function validateConfidenceClaimConsistency(obj, path, errors) {
  if (!obj?.claim_type) return;
  if (!isClaimTypeConsistent(obj.confidence, obj.claim_type)) {
    errors.push(`${path}.claim_type must match confidence mapping (🟢→paper_verified, 🟡→practitioner_observed, 🔴→speculation)`);
  }
}

function normalizeConfidenceClaimRow(row) {
  if (!row || typeof row !== "object") return;
  if (row.confidence == null) return;
  const raw = String(row.confidence).trim().toLowerCase();
  if (raw === "high") row.confidence = "green";
  else if (raw === "medium") row.confidence = "yellow";
  else if (raw === "low") row.confidence = "red";
  row.claim_type = toClaimTypeFromConfidence(row.confidence);
}

function normalizeConfidenceClaimMappings(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const sub = obj.sub_analyses;
  if (sub && typeof sub === "object") {
    const featRecs = sub?.featured?.recommendations;
    if (Array.isArray(featRecs)) {
      featRecs.forEach(normalizeConfidenceClaimRow);
    }
  }
  const changes = obj?.composite_classification?.top_3_changes_to_elevate;
  if (Array.isArray(changes)) {
    changes.forEach(normalizeConfidenceClaimRow);
  }
  if (Array.isArray(obj.top_issues)) {
    obj.top_issues.forEach(normalizeConfidenceClaimRow);
  }
  if (typeof obj.paper_grounded_disclaimer === "string" && obj.paper_grounded_disclaimer.trim()) {
    if (!obj.paper_grounded_disclaimer.includes("NOT LinkedIn")) {
      obj.paper_grounded_disclaimer = `${obj.paper_grounded_disclaimer.trim()} We are NOT LinkedIn.`;
    }
    if (!obj.paper_grounded_disclaimer.toLowerCase().includes("directional")) {
      obj.paper_grounded_disclaimer = `${obj.paper_grounded_disclaimer.trim()} Predictions are directional.`;
    }
    if (!obj.paper_grounded_disclaimer.toLowerCase().includes("not literal linkedin")) {
      obj.paper_grounded_disclaimer = `${obj.paper_grounded_disclaimer.trim()} Scores are not literal LinkedIn scores.`;
    }
  }
  return obj;
}

/** Pass A: validate only `sub_analyses` subtree. */
export function validateSubAnalysesShape(sub) {
  coerceSubAnalysesNumericScores(sub);
  const errors = [];
  if (!isRecord(sub)) {
    errors.push("sub_analyses must be object");
    return errors;
  }
  for (const k of ["headline", "about", "skills", "featured"]) {
    if (!isRecord(sub[k]) || Object.keys(sub[k]).length === 0) {
      errors.push(`sub_analyses.${k} must be non-empty object`);
    }
  }
  const rec = sub.recommendations;
  if (!isRecord(rec) || Object.keys(rec).length === 0) {
    errors.push("sub_analyses.recommendations must be non-empty object");
  } else {
    if (!isRecord(rec.scores)) {
      errors.push("sub_analyses.recommendations.scores must be object");
    } else {
      for (const s of ["count", "recency", "specificity", "senior_source_quality"]) {
        const v = rec.scores[s];
        if (typeof v !== "number" || v < 0 || v > 10) {
          errors.push(`sub_analyses.recommendations.scores.${s} must be number 0-10`);
        }
      }
    }
    if (
      typeof rec.overall_recommendations_score !== "number" ||
      rec.overall_recommendations_score < 0 ||
      rec.overall_recommendations_score > 100
    ) {
      errors.push("sub_analyses.recommendations.overall_recommendations_score must be number 0-100");
    }
    if (!Array.isArray(rec.issues_found)) {
      errors.push("sub_analyses.recommendations.issues_found must be array");
    }
  }
  if (!Array.isArray(sub.experience) || sub.experience.length === 0) {
    errors.push("sub_analyses.experience must be a non-empty array");
  } else {
    const rows = sub.experience.slice(0, 3);
    rows.forEach((row, i) => {
      if (!isRecord(row)) {
        errors.push(`sub_analyses.experience[${i}] must be object`);
        return;
      }
      for (const f of ["role", "company"]) {
        if (typeof row[f] !== "string" || !row[f].trim()) {
          errors.push(`sub_analyses.experience[${i}].${f} must be non-empty string`);
        }
      }
      if (!isRecord(row.scores)) {
        errors.push(`sub_analyses.experience[${i}].scores must be object`);
      } else {
        for (const s of [
          "scope_clarity",
          "outcome_density",
          "strategic_tactical_balance",
          "verb_strength",
          "skill_tagging_coherence",
          "recency_treatment",
        ]) {
          const v = row.scores[s];
          if (typeof v !== "number" || v < 0 || v > 10) {
            errors.push(`sub_analyses.experience[${i}].scores.${s} must be number 0-10`);
          }
        }
      }
      if (!Array.isArray(row.issues_found)) {
        errors.push(`sub_analyses.experience[${i}].issues_found must be array`);
      }
    });
  }
  if ("overall_experience_score" in sub) {
    const o = sub.overall_experience_score;
    if (typeof o !== "number" || o < 0 || o > 100) {
      errors.push("sub_analyses.overall_experience_score must be number 0-100");
    }
  }
  const head = sub.headline;
  if (isRecord(head)) {
    if (typeof head.headline_text !== "string" || !head.headline_text.trim()) {
      errors.push("sub_analyses.headline.headline_text must be non-empty string");
    }
    if (!isRecord(head.scores)) {
      errors.push("sub_analyses.headline.scores must be object");
    } else {
      for (const s of [
        "topic_clarity",
        "seniority_signal",
        "outcome_specificity",
        "keyword_density",
        "differentiation",
        "character_efficiency",
      ]) {
        const v = head.scores[s];
        if (typeof v !== "number" || v < 0 || v > 10) {
          errors.push(`sub_analyses.headline.scores.${s} must be number 0-10`);
        }
      }
    }
    if (typeof head.overall_headline_score !== "number" || head.overall_headline_score < 0 || head.overall_headline_score > 100) {
      errors.push("sub_analyses.headline.overall_headline_score must be number 0-100");
    }
    if (!Array.isArray(head.issues_found)) {
      errors.push("sub_analyses.headline.issues_found must be array");
    }
    if (!Array.isArray(head.rewrite_options) || head.rewrite_options.length !== 4) {
      errors.push("sub_analyses.headline.rewrite_options must be array of length 4");
    } else {
      head.rewrite_options.forEach((opt, i) => {
        if (typeof opt !== "string" || !opt.trim()) {
          errors.push(`sub_analyses.headline.rewrite_options[${i}] must be non-empty string`);
        }
      });
    }
  }
  const feat = sub.featured;
  const about = sub.about;
  if (isRecord(about)) {
    if (typeof about.about_text !== "string" || !about.about_text.trim()) {
      errors.push("sub_analyses.about.about_text must be non-empty string");
    }
    if (!isRecord(about.scores)) {
      errors.push("sub_analyses.about.scores must be object");
    } else {
      for (const s of [
        "first_275_hook",
        "topic_coherence",
        "specificity_density",
        "pillar_definition",
        "voice_authenticity",
        "cta_presence",
        "length_optimization",
      ]) {
        const v = about.scores[s];
        if (typeof v !== "number" || v < 0 || v > 10) {
          errors.push(`sub_analyses.about.scores.${s} must be number 0-10`);
        }
      }
    }
    if (typeof about.overall_about_score !== "number" || about.overall_about_score < 0 || about.overall_about_score > 100) {
      errors.push("sub_analyses.about.overall_about_score must be number 0-100");
    }
    if (!Array.isArray(about.issues_found)) {
      errors.push("sub_analyses.about.issues_found must be array");
    }
    if (!Array.isArray(about.rewrite_options) || about.rewrite_options.length !== 4) {
      errors.push("sub_analyses.about.rewrite_options must be array of length 4");
    } else {
      about.rewrite_options.forEach((opt, i) => {
        if (typeof opt !== "string" || !opt.trim()) {
          errors.push(`sub_analyses.about.rewrite_options[${i}] must be non-empty string`);
        }
      });
    }
  }
  const skills = sub.skills;
  if (isRecord(skills)) {
    if (!isRecord(skills.scores)) {
      errors.push("sub_analyses.skills.scores must be object");
    } else {
      for (const s of [
        "top_3_alignment",
        "total_skill_count",
        "niche_aligned_skills_present",
        "boring_filter_skills",
        "endorsement_distribution",
        "skill_to_experience_coherence",
      ]) {
        const v = skills.scores[s];
        if (s === "total_skill_count") {
          if (typeof v !== "number" || v < 0 || v > 100) {
            errors.push(`sub_analyses.skills.scores.${s} must be number 0-100`);
          }
        } else {
          if (typeof v !== "number" || v < 0 || v > 10) {
            errors.push(`sub_analyses.skills.scores.${s} must be number 0-10`);
          }
        }
      }
    }
    if (typeof skills.overall_skills_score !== "number" || skills.overall_skills_score < 0 || skills.overall_skills_score > 100) {
      errors.push("sub_analyses.skills.overall_skills_score must be number 0-100");
    }
    if (!Array.isArray(skills.skills_to_add)) {
      errors.push("sub_analyses.skills.skills_to_add must be array");
    }
    if (!Array.isArray(skills.skills_to_remove)) {
      errors.push("sub_analyses.skills.skills_to_remove must be array");
    }
    if (!Array.isArray(skills.recommended_top_3_order) || skills.recommended_top_3_order.length !== 3) {
      errors.push("sub_analyses.skills.recommended_top_3_order must be array of length 3");
    }
  }
  if (isRecord(feat)) {
    if (!isRecord(feat.scores)) errors.push("sub_analyses.featured.scores must be object");
    else {
      for (const s of ["item_count", "niche_alignment", "recency", "content_mix"]) {
        const v = feat.scores[s];
        if (s === "item_count") {
          if (typeof v !== "number" || v < 0 || v > 100) {
            errors.push(`sub_analyses.featured.scores.${s} must be number 0-100`);
          }
        } else {
          if (typeof v !== "number" || v < 0 || v > 10) {
            errors.push(`sub_analyses.featured.scores.${s} must be number 0-10`);
          }
        }
      }
    }
    if (typeof feat.featured_composite_0_to_100 !== "number") {
      errors.push("sub_analyses.featured.featured_composite_0_to_100 must be number");
    }
    if (!Array.isArray(feat.recommendations)) {
      errors.push("sub_analyses.featured.recommendations must be array");
    } else {
      feat.recommendations.forEach((row, i) => {
        if (!isRecord(row)) {
          errors.push(`sub_analyses.featured.recommendations[${i}] must be object`);
          return;
        }
        normalizeConfidenceClaimRow(row);
        for (const f of ["action", "rationale", "confidence"]) {
          if (typeof row[f] !== "string" || !row[f].trim()) {
            errors.push(`sub_analyses.featured.recommendations[${i}].${f} must be non-empty string`);
          }
        }
        if (row.confidence && !isConfidenceValid(row.confidence)) {
          errors.push(`sub_analyses.featured.recommendations[${i}].confidence must be green|yellow|red`);
        }
        if (row.claim_type && !CLAIM_TYPE.has(row.claim_type)) {
          errors.push(
            `sub_analyses.featured.recommendations[${i}].claim_type must be paper_verified|practitioner_observed|speculation`
          );
        }
        validateConfidenceClaimConsistency(row, `sub_analyses.featured.recommendations[${i}]`, errors);
      });
    }
  }
  return errors;
}

/** Pass B: validate synthesis keys (no sub_analyses). */
export function validateSynthesisShape(obj) {
  const errors = [];
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    errors.push("pass B root must be object");
    return errors;
  }
  for (const k of ["analysis_metadata", "composite_classification", "top_issues", "improvement_projection", "paper_grounded_disclaimer"]) {
    if (!(k in obj)) errors.push(`pass B missing key: ${k}`);
  }
  if (errors.length) return errors;

  const meta = obj.analysis_metadata;
  if (!isRecord(meta)) errors.push("analysis_metadata must be object");
  else {
    if (!isRecord(meta.user_context)) errors.push("analysis_metadata.user_context must be object");
    else {
      for (const f of ["declared_niche", "career_goal", "geography", "target_audience"]) {
        if (typeof meta.user_context[f] !== "string") errors.push(`analysis_metadata.user_context.${f} must be string`);
      }
      const yoe = meta.user_context.years_experience;
      if (!(typeof yoe === "string" || typeof yoe === "number")) {
        errors.push("analysis_metadata.user_context.years_experience must be string|number");
      }
    }
    if (typeof meta.analysis_date !== "string") errors.push("analysis_metadata.analysis_date must be string");
    if (typeof meta.framework_version !== "string") errors.push("analysis_metadata.framework_version must be string");
  }

  const cc = obj.composite_classification;
  if (!isRecord(cc)) errors.push("composite_classification must be object");
  else {
    if (!TIER_ENUM.has(cc.tier)) errors.push(`composite_classification.tier must be one of ${[...TIER_ENUM].join(", ")}`);
    if (typeof cc.score !== "number" || cc.score < 0 || cc.score > 100) {
      errors.push("composite_classification.score must be number 0-100");
    }
    if (typeof cc.score === "number" && cc.score >= 0 && cc.score <= 100 && TIER_ENUM.has(cc.tier)) {
      const expectedTier = tierForScore(cc.score);
      if (cc.tier !== expectedTier) {
        errors.push(
          `composite_classification.tier (${cc.tier}) must match score band for score=${cc.score} (expected ${expectedTier})`
        );
      }
    }
    if (!PREDICTED_REACH.has(cc.predicted_reach)) {
      errors.push("composite_classification.predicted_reach must be above_niche_average|niche_average|below_niche_average|low");
    }
    if (!RECRUITER_DISCOVERABILITY.has(cc.predicted_recruiter_discoverability)) {
      errors.push("composite_classification.predicted_recruiter_discoverability must be very_high|high|medium|low");
    }
    if (typeof cc.reasoning !== "string" || !cc.reasoning.trim()) {
      errors.push("composite_classification.reasoning must be non-empty string");
    }
    if (!Array.isArray(cc.top_3_changes_to_elevate) || cc.top_3_changes_to_elevate.length !== 3) {
      errors.push("composite_classification.top_3_changes_to_elevate must be array of length 3");
    } else {
      cc.top_3_changes_to_elevate.forEach((ch, i) => {
        if (!isRecord(ch)) errors.push(`top_3_changes_to_elevate[${i}] must be object`);
        else {
          normalizeConfidenceClaimRow(ch);
          for (const f of ["change", "expected_impact", "confidence"]) {
            if (typeof ch[f] !== "string") errors.push(`top_3_changes_to_elevate[${i}].${f} must be string`);
          }
          if (ch.confidence && !isConfidenceValid(ch.confidence)) {
            errors.push(`top_3_changes_to_elevate[${i}].confidence must be green|yellow|red`);
          }
          if (ch.claim_type && !CLAIM_TYPE.has(ch.claim_type)) {
            errors.push(
              `top_3_changes_to_elevate[${i}].claim_type must be paper_verified|practitioner_observed|speculation`
            );
          }
          validateConfidenceClaimConsistency(ch, `top_3_changes_to_elevate[${i}]`, errors);
        }
      });
    }
    if (typeof cc.realistic_projection_note !== "string" || !cc.realistic_projection_note.trim()) {
      errors.push("composite_classification.realistic_projection_note must be non-empty string");
    }
  }

  if (!Array.isArray(obj.top_issues)) errors.push("top_issues must be array");
  else {
    if (obj.top_issues.length < 3) errors.push("top_issues must have at least 3 entries");
    if (obj.top_issues.length > 10) errors.push("top_issues must have at most 10 entries");
    obj.top_issues.forEach((row, i) => {
      if (!isRecord(row)) errors.push(`top_issues[${i}] must be object`);
      else {
        normalizeConfidenceClaimRow(row);
        if (!SEVERITY.has(row.severity)) errors.push(`top_issues[${i}].severity invalid`);
        for (const f of ["issue", "fix"]) {
          if (typeof row[f] !== "string" || !row[f].trim()) errors.push(`top_issues[${i}].${f} must be non-empty string`);
        }
        if (!isConfidenceValid(row.confidence)) errors.push(`top_issues[${i}].confidence must be green|yellow|red`);
        if (row.claim_type && !CLAIM_TYPE.has(row.claim_type)) {
          errors.push(`top_issues[${i}].claim_type must be paper_verified|practitioner_observed|speculation`);
        }
        validateConfidenceClaimConsistency(row, `top_issues[${i}]`, errors);
      }
    });
  }

  const imp = obj.improvement_projection;
  if (!isRecord(imp)) errors.push("improvement_projection must be object");
  else {
    for (const k of ["30_days", "60_days", "90_days"]) {
      if (typeof imp[k] !== "string" || !imp[k].trim()) {
        errors.push(`improvement_projection.${k} must be non-empty string`);
      }
    }
  }

  if (typeof obj.paper_grounded_disclaimer !== "string" || !obj.paper_grounded_disclaimer.includes("2501.16450")) {
    errors.push("paper_grounded_disclaimer must be string citing arXiv 2501.16450");
  } else {
    const d = obj.paper_grounded_disclaimer;
    if (!d.includes("NOT LinkedIn")) {
      errors.push('paper_grounded_disclaimer must clearly state "NOT LinkedIn"');
    }
    if (!d.toLowerCase().includes("directional")) {
      errors.push("paper_grounded_disclaimer must state predictions are directional");
    }
    if (!d.toLowerCase().includes("not literal linkedin")) {
      errors.push("paper_grounded_disclaimer must state scores are not literal LinkedIn scores");
    }
  }

  return errors;
}

export function mergePrdTwoPass(passAObj, passBObj) {
  const sub = passAObj?.sub_analyses;
  return {
    ...passBObj,
    sub_analyses: sub,
  };
}

export function validatePrdProfileOutput(obj) {
  const errors = [];
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    errors.push("root must be a JSON object");
    return errors;
  }
  for (const k of TOP_LEVEL_KEYS) {
    if (!(k in obj)) errors.push(`missing top-level key: ${k}`);
  }
  if (errors.length) return errors;

  errors.push(...validateSubAnalysesShape(obj.sub_analyses));
  const { sub_analyses, ...rest } = obj;
  errors.push(...validateSynthesisShape(rest));
  return errors;
}

/**
 * @param {string} rawText
 */
export function runLayer4ParseValidate(rawText) {
  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  const results = normalizeConfidenceClaimMappings(parseJsonObject(rawText));
  const errors = validatePrdProfileOutput(results);
  const finishedAt = new Date().toISOString();
  return {
    layerId: LAYER4_ID,
    ok: errors.length === 0 && Object.keys(results).length > 0,
    startedAt,
    finishedAt,
    durationMs: Math.round(performance.now() - t0),
    results,
    errors,
    parsedKeyCount: Object.keys(results).length,
  };
}

/**
 * Two-pass: parse A+B, merge, validate full PRD object.
 * @param {string} rawA
 * @param {string} rawB
 */
export function runLayer4ParseValidateTwoPass(rawA, rawB) {
  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  const objA = normalizeConfidenceClaimMappings(parseJsonObject(rawA));
  const objB = normalizeConfidenceClaimMappings(parseJsonObject(rawB));
  const errA = validateSubAnalysesShape(objA.sub_analyses);
  const errB = validateSynthesisShape(objB);
  const merged = mergePrdTwoPass(objA, objB);
  const errFull = validatePrdProfileOutput(merged);
  const finishedAt = new Date().toISOString();
  return {
    layerId: LAYER4_ID,
    ok: errFull.length === 0 && Object.keys(merged).length > 0,
    startedAt,
    finishedAt,
    durationMs: Math.round(performance.now() - t0),
    results: merged,
    errors: errFull,
    parsedKeyCount: Object.keys(merged).length,
    passAErrors: errA,
    passBErrors: errB,
  };
}
