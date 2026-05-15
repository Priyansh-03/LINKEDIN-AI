/**
 * Hook Archetype Library (12 archetypes).
 */

export const HOOK_ARCHETYPES = [
  "Specific Number",
  "Years-Earned Insight",
  "Receipts Reveal",
  "Pattern Interrupt",
  "Open Loop",
  "Counter-Intuitive Truth",
  "Confessional",
  "Contrarian Stand",
  '"I Was Wrong" Pivot',
  "Numbered Promise",
  '"Steal This" Offer',
  "Diagnostic Question",
];

/**
 * Lightweight pattern matcher to infer archetype from draft.
 * @param {string} text
 * @returns {string}
 */
export function detectHookArchetypeFromLibrary(text) {
  const t = String(text || "").trim();
  const l = t.toLowerCase();
  if (!l) return "Diagnostic Question";
  if (/^\s*.+\?\s*$/.test(t.slice(0, 220)) || l.startsWith("what if") || l.startsWith("are you")) {
    return "Diagnostic Question";
  }
  if (/^\d+(\+|x|%|\b)/i.test(t)) return "Specific Number";
  if (/\b\d+\s+years?\b|\bin \d+\s+years?\b/i.test(l)) return "Years-Earned Insight";
  if (/\breceipt|screenshot|proof|here'?s the data\b/i.test(l)) return "Receipts Reveal";
  if (/\bno one talks about|stop doing this|everyone says\b/i.test(l)) return "Pattern Interrupt";
  if (/\bbut here'?s what happened|and then\b/i.test(l)) return "Open Loop";
  if (/\bcounter[- ]intuitive|opposite is true|actually\b/i.test(l)) return "Counter-Intuitive Truth";
  if (/^\s*i (messed up|failed|was ashamed|struggled)\b/i.test(l)) return "Confessional";
  if (/^\s*(unpopular opinion|hot take|i disagree)\b/i.test(l)) return "Contrarian Stand";
  if (/^\s*i was wrong\b/i.test(l)) return '"I Was Wrong" Pivot';
  if (/^\s*\d+\s+(ways|lessons|mistakes|rules|frameworks)\b/i.test(l)) return "Numbered Promise";
  if (/^\s*steal this\b/i.test(l)) return '"Steal This" Offer';
  return "Pattern Interrupt";
}
