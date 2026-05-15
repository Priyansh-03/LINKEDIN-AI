/**
 * Layer 0 — ingest: read dataset file, parse JSON, validate minimal contract.
 */
import { readFileSync } from "node:fs";
import { validateBehaviorSchema } from "./behavior-schema.mjs";
import { validateContentSchema } from "./content-schema.mjs";
import { validateComparativeSchema } from "./comparative-schema.mjs";

export const LAYER0_ID = "L0_ingest_dataset";
const HEADLINE_MAX = 220;
const ABOUT_MAX = 3000;
const OPTIONAL_INPUT_MAX = 240;

function isRecord(x) {
  return x != null && typeof x === "object" && !Array.isArray(x);
}

function isStringArray(x) {
  return Array.isArray(x) && x.every((v) => typeof v === "string");
}

/**
 * @param {string} absolutePath
 */
export function runLayer0LoadDataset(absolutePath) {
  const startedAt = new Date().toISOString();
  const t0 = performance.now();
  const errors = [];

  let raw = "";
  try {
    raw = readFileSync(absolutePath, "utf8");
  } catch (e) {
    errors.push(`read failed: ${e?.message || e}`);
    return finish(startedAt, t0, errors, null);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    errors.push(`JSON.parse failed: ${e?.message || e}`);
    return finish(startedAt, t0, errors, null);
  }

  if (!isRecord(data)) {
    errors.push("root must be a JSON object");
    return finish(startedAt, t0, errors, null);
  }
  if (!isRecord(data.profile)) {
    errors.push("missing object: profile");
  }
  if (data.metricsSummary != null && !isRecord(data.metricsSummary)) {
    errors.push("metricsSummary must be an object if present");
  }
  if (data.behaviorSignals != null && !isRecord(data.behaviorSignals)) {
    errors.push("behaviorSignals must be an object if present");
  }
  if (data.userContext != null && !isRecord(data.userContext)) {
    errors.push("userContext must be an object if present");
  }

  if (errors.length) {
    process.stderr.write(`Layer 0 early validation failed: ${errors.join("; ")}\n`);
    return finish(startedAt, t0, errors, null);
  }

  const profile = data.profile;
  if (profile.headline != null) {
    if (typeof profile.headline !== "string") errors.push("profile.headline must be string");
    else if (profile.headline.length > HEADLINE_MAX) {
      errors.push(`profile.headline exceeds max ${HEADLINE_MAX} chars`);
    }
  }
  if (profile.about != null) {
    if (typeof profile.about !== "string") errors.push("profile.about must be string");
    else if (profile.about.length > ABOUT_MAX) {
      errors.push(`profile.about exceeds max ${ABOUT_MAX} chars`);
    }
  }

  const exp = profile.experienceItems;
  if (!Array.isArray(exp) || exp.length === 0) {
    errors.push("profile.experienceItems must be a non-empty array");
  } else {
    exp.forEach((row, i) => {
      if (!isRecord(row)) {
        errors.push(`profile.experienceItems[${i}] must be object`);
        return;
      }
      for (const f of ["title", "company", "duration", "description"]) {
        if (typeof row[f] !== "string") {
          errors.push(`profile.experienceItems[${i}].${f} must be string`);
        }
      }
    });
  }

  for (const [key, label] of [
    ["skills", "profile.skills"]
  ]) {
    if (profile[key] != null && !isStringArray(profile[key])) {
      errors.push(`${label} must be string array if present`);
    }
  }

  if (profile.recommendations != null && !Array.isArray(profile.recommendations)) {
     errors.push("profile.recommendations must be array if present");
  }

  if (profile.education != null) {
    if (!Array.isArray(profile.education)) errors.push("profile.education must be array if present");
    else {
      profile.education.forEach((row, i) => {
        if (!isRecord(row)) {
          errors.push(`profile.education[${i}] must be object`);
          return;
        }
        if (row.school != null && typeof row.school !== "string") {
          errors.push(`profile.education[${i}].school must be string if present`);
        }
      });
    }
  }

  if (profile.certifications != null) {
    if (!Array.isArray(profile.certifications)) errors.push("profile.certifications must be array if present");
    else {
      profile.certifications.forEach((row, i) => {
        if (!isRecord(row)) {
          errors.push(`profile.certifications[${i}] must be object`);
          return;
        }
        if (row.name != null && typeof row.name !== "string") {
          errors.push(`profile.certifications[${i}].name must be string if present`);
        }
      });
    }
  }

  // Method B (URL submission) is future-phase only for this MVP.
  if (data.profileUrl != null || data.linkedinProfileUrl != null) {
    errors.push("profile URL submission is not supported in this MVP; use dataset profile fields");
  }

  // Optional Inputs (quality boosters): validate shape if present.
  if (isRecord(data.userContext)) {
    const optionalStringFields = [
      "declared_niche",
      "geography",
      "career_goal",
      "industry_context",
      "years_experience",
      "target_audience",
    ];
    for (const f of optionalStringFields) {
      const v = data.userContext[f];
      if (v == null) continue;
      if (typeof v !== "string") {
        errors.push(`userContext.${f} must be string if present`);
        continue;
      }
      if (v.length > OPTIONAL_INPUT_MAX) {
        errors.push(`userContext.${f} exceeds max ${OPTIONAL_INPUT_MAX} chars`);
      }
    }
    const goal = data.userContext.career_goal;
    if (typeof goal === "string" && goal.trim()) {
      const allowed = new Set(["growth", "job seeking", "both"]);
      if (!allowed.has(goal.trim().toLowerCase())) {
        errors.push('userContext.career_goal must be one of: "Growth", "Job Seeking", "Both"');
      }
    }
  }

  errors.push(...validateBehaviorSchema(data));
  errors.push(...validateContentSchema(data));
  errors.push(...validateComparativeSchema(data));

  if (errors.length) {
    process.stderr.write(`Layer 0 validation failed: ${errors.join("; ")}\n`);
    return finish(startedAt, t0, errors, null);
  }

  return finish(startedAt, t0, [], data);
}

function finish(startedAt, t0, errors, dataset) {
  const finishedAt = new Date().toISOString();
  return {
    layerId: LAYER0_ID,
    ok: errors.length === 0,
    dataset,
    errors,
    startedAt,
    finishedAt,
    durationMs: Math.round(performance.now() - t0),
  };
}
