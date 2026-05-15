/**
 * Module 3 (Content Analyzer) input schema guards.
 */

const POST_FORMAT = new Set([
  "text",
  "multi_image",
  "carousel",
  "video",
  "document",
  "image",
  "image_only",
  "video_only",
  "text_with_image",
  "text_with_video",
  "text_with_both",
  "text_with_video",
]);

function isRecord(x) {
  return x != null && typeof x === "object" && !Array.isArray(x);
}

/**
 * Validate content analyzer inputs if provided.
 * @param {Record<string, unknown>} dataset
 * @returns {string[]}
 */
export function validateContentSchema(dataset) {
  const errors = [];
  const c = dataset?.contentDraft;
  if (c == null) return errors;
  if (!isRecord(c)) {
    errors.push("contentDraft must be object if present");
    return errors;
  }
  if (typeof c.postText !== "string" || !c.postText.trim()) {
    errors.push("contentDraft.postText is required and must be non-empty string");
  }
  if (typeof c.intendedFormat !== "string" || !POST_FORMAT.has(String(c.intendedFormat).trim().toLowerCase())) {
    errors.push("contentDraft.intendedFormat must be one of: text|multi_image|carousel|video|document");
  }
  if (typeof c.intendedPublishAt !== "string" || !c.intendedPublishAt.trim()) {
    errors.push("contentDraft.intendedPublishAt is required and must be non-empty string");
  }
  if (c.hookArchetype != null && typeof c.hookArchetype !== "string") {
    errors.push("contentDraft.hookArchetype must be string if present");
  }

  // Optional historical posts input (9.2.2): expected 10-30 rows when provided.
  const hp = dataset?.historicalPosts;
  if (hp != null) {
    if (!Array.isArray(hp)) {
      errors.push("historicalPosts must be array if present");
    } else {
      if (Array.isArray(hp) && hp.length > 50) {
        errors.push("historicalPosts must contain no more than 50 posts");
      }
      hp.forEach((row, i) => {
        if (!isRecord(row)) {
          errors.push(`historicalPosts[${i}] must be object`);
          return;
        }
        if (typeof row.text !== "string" || !row.text.trim()) {
          errors.push(`historicalPosts[${i}].text must be non-empty string`);
        }
        if (row.impressions != null && !Number.isFinite(Number(row.impressions))) {
          errors.push(`historicalPosts[${i}].impressions must be numeric if present`);
        }
        if (row.engagementRate != null && !Number.isFinite(Number(row.engagementRate))) {
          errors.push(`historicalPosts[${i}].engagementRate must be numeric if present`);
        }
      });
    }
  }
  return errors;
}
