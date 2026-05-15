/**
 * Minimal Mustache-style interpolation for prompt templates.
 * Supports {{varName}} placeholders.
 */

/**
 * @param {string} template
 * @param {Record<string, unknown>} vars
 */
export function interpolateTemplate(template, vars = {}) {
  const src = String(template || "");
  return src.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}
