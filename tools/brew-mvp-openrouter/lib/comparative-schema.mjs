/**
 * Module 4 (Comparative Intelligence) schema guards.
 * Manual, ToS-safe peer inputs only.
 */

function isRecord(x) {
  return x != null && typeof x === "object" && !Array.isArray(x);
}

/**
 * @param {Record<string, unknown>} dataset
 * @returns {string[]}
 */
export function validateComparativeSchema(dataset) {
  const errors = [];
  const peers = dataset?.peerBenchmark;
  if (peers == null) return errors;
  if (!isRecord(peers)) {
    errors.push("peerBenchmark must be object if present");
    return errors;
  }

  if (peers.collectionMode != null) {
    const mode = String(peers.collectionMode || "").trim().toLowerCase();
    if (mode !== "manual") {
      errors.push('peerBenchmark.collectionMode must be "manual" (ToS-safe)');
    }
  }
  if (peers.tosCompliant != null && peers.tosCompliant !== true) {
    errors.push("peerBenchmark.tosCompliant must be true when provided");
  }

  const profiles = peers.peerProfiles;
  if (profiles != null) {
    if (!Array.isArray(profiles)) {
      errors.push("peerBenchmark.peerProfiles must be array if present");
    } else {
      profiles.forEach((p, i) => {
        if (!isRecord(p)) {
          errors.push(`peerBenchmark.peerProfiles[${i}] must be object`);
          return;
        }
        if (typeof p.name !== "string" || !p.name.trim()) {
          errors.push(`peerBenchmark.peerProfiles[${i}].name must be non-empty string`);
        }
        if (p.url != null && typeof p.url !== "string") {
          errors.push(`peerBenchmark.peerProfiles[${i}].url must be string if present`);
        }
      });
    }
  }
  return errors;
}
