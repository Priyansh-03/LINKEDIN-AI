/**
 * Module 2 (Behavior Analyzer) schema guardrails.
 * ToS-compliant ingestion only: manual logs (MVP), periodic export, voice log (future).
 */

const COLLECTION_METHOD = new Set(["manual_logging", "periodic_export", "voice_log"]);

const ACTION_TYPE = new Set([
  "reaction",
  "comment",
  "share_repost",
  "profile_view",
  "connection_request_sent",
  "connection_request_accepted",
  "job_view",
  "job_save",
  "job_application",
  "search_performed",
  "company_followed",
  "post_saved",
]);

const TARGET_CLASSIFICATION = new Set([
  "in_niche",
  "adjacent_niche",
  "off_niche",
  "senior_content",
  "junior_content",
  "target_company_content",
  "hiring_manager_content",
]);

function isRecord(x) {
  return x != null && typeof x === "object" && !Array.isArray(x);
}

/**
 * Validate behavior input schema if behaviorSignals/action logs are provided.
 * @param {Record<string, unknown>} dataset
 * @returns {string[]}
 */
export function validateBehaviorSchema(dataset) {
  const errors = [];
  const b = dataset?.behaviorSignals;
  if (!isRecord(b)) return errors;

  if (b.collectionMethod != null) {
    const v = String(b.collectionMethod || "").trim().toLowerCase();
    if (!COLLECTION_METHOD.has(v)) {
      errors.push(
        "behaviorSignals.collectionMethod must be one of: manual_logging|periodic_export|voice_log"
      );
    }
  }

  if (b.tosCompliant != null && b.tosCompliant !== true) {
    errors.push("behaviorSignals.tosCompliant must be true when provided");
  }

  if (b.actionLogs != null) {
    if (!Array.isArray(b.actionLogs)) {
      errors.push("behaviorSignals.actionLogs must be array if present");
      return errors;
    }
    b.actionLogs.forEach((row, i) => {
      if (!isRecord(row)) {
        errors.push(`behaviorSignals.actionLogs[${i}] must be object`);
        return;
      }
      const actionType = String(row.actionType || "").trim().toLowerCase();
      if (!ACTION_TYPE.has(actionType)) {
        errors.push(
          `behaviorSignals.actionLogs[${i}].actionType invalid; expected known action enum`
        );
      }
      const target = String(row.targetClassification || "").trim().toLowerCase();
      if (!TARGET_CLASSIFICATION.has(target)) {
        errors.push(
          `behaviorSignals.actionLogs[${i}].targetClassification invalid; expected known target enum`
        );
      }

      if (typeof row.timestamp !== "string" || !row.timestamp.trim()) {
        errors.push(`behaviorSignals.actionLogs[${i}].timestamp must be non-empty string`);
      }
      if (row.personOrCompany != null && typeof row.personOrCompany !== "string") {
        errors.push(`behaviorSignals.actionLogs[${i}].personOrCompany must be string if present`);
      }
      if (row.commentLength != null) {
        const n = Number(row.commentLength);
        if (!Number.isFinite(n) || n < 0) {
          errors.push(`behaviorSignals.actionLogs[${i}].commentLength must be non-negative number`);
        }
      }
      if (row.notes != null && typeof row.notes !== "string") {
        errors.push(`behaviorSignals.actionLogs[${i}].notes must be string if present`);
      }
    });
  }

  return errors;
}
