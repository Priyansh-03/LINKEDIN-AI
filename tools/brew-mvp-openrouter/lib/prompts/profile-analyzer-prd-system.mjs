/**
 * PRD §7.4 Profile Analyzer — system prompt loaded from sibling .txt (single source of truth for Node + Python).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const _dir = dirname(fileURLToPath(import.meta.url));

export const PROFILE_ANALYZER_FRAMEWORK_VERSION = "1.0";

export const PROFILE_ANALYZER_PRD_SYSTEM = readFileSync(
  join(_dir, "profile-analyzer-prd-system.txt"),
  "utf8"
);
