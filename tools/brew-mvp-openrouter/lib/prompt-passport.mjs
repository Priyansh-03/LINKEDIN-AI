import { createHash } from "node:crypto";

function shortHash(text) {
  return createHash("sha256").update(String(text || ""), "utf8").digest("hex").slice(0, 16);
}

/**
 * Build a prompt passport that is carried with layer outputs.
 * @param {object} params
 * @param {string} params.layer
 * @param {string} params.module
 * @param {string} params.promptPath
 * @param {string} params.promptText
 * @param {string} [params.promptVersion]
 */
export function createPromptPassport({ layer, module, promptPath, promptText, promptVersion }) {
  return {
    layer,
    module,
    prompt_path: promptPath,
    prompt_version: promptVersion || "v1.0",
    prompt_hash: shortHash(promptText),
  };
}
