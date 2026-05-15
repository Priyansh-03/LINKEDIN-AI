const CONFIDENCE_TO_EMOJI = {
  green: "🟢",
  yellow: "🟡",
  red: "🔴",
};

const CLAIM_BY_CONFIDENCE = {
  green: "paper_verified",
  yellow: "practitioner_observed",
  red: "speculation",
};

/**
 * Accepts common confidence variants and returns canonical key.
 * @param {unknown} value
 * @returns {"green"|"yellow"|"red"|null}
 */
export function normalizeConfidenceKey(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  if (raw === "🟢" || raw === "paper-verified" || raw === "paper_verified") return "green";
  if (raw === "🟡" || raw === "observed" || raw === "practitioner_observed") return "yellow";
  if (raw === "🔴" || raw === "speculation") return "red";
  if (raw === "green" || raw === "yellow" || raw === "red") return raw;
  return null;
}

/**
 * @param {unknown} confidence
 */
export function toConfidenceEmoji(confidence) {
  const key = normalizeConfidenceKey(confidence);
  return key ? CONFIDENCE_TO_EMOJI[key] : "🟡";
}

/**
 * @param {unknown} confidence
 */
export function toClaimTypeFromConfidence(confidence) {
  const key = normalizeConfidenceKey(confidence);
  return key ? CLAIM_BY_CONFIDENCE[key] : "practitioner_observed";
}

/**
 * @param {unknown} confidence
 * @param {unknown} claimType
 */
export function isClaimTypeConsistent(confidence, claimType) {
  const expected = toClaimTypeFromConfidence(confidence);
  return String(claimType || "").trim() === expected;
}
