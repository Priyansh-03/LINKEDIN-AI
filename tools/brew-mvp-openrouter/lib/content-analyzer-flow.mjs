/**
 * Module 3 — Content Analyzer (pre-publish) flow.
 * Evaluates draft coherence with declared identity (profile) and demonstrated behavior.
 */
import {
  HOOK_ARCHETYPES,
  detectHookArchetypeFromLibrary,
} from "./hook-archetype-library.mjs";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createPromptPassport } from "./prompt-passport.mjs";
import { mergePostTuning } from "./scoring-tuning.mjs";

function clamp(min, v, max) {
  return Math.max(min, Math.min(max, v));
}

function startsStrong(text) {
  const first = String(text || "").trim().slice(0, 275);
  if (!first) return 0;
  let score = 5;
  if (/\d/.test(first)) score += 1;
  if (/[?]/.test(first)) score += 1;
  if (/(how to|mistake|lesson|framework|playbook|unpopular)/i.test(first)) score += 2;
  if (first.length >= 90) score += 1;
  return clamp(1, score, 10);
}

function firstTwoLinesOr220(text) {
  const t = String(text || "").trim();
  if (!t) return "";
  const lines = t.split("\n").map((x) => x.trim()).filter(Boolean);
  if (lines.length >= 2) {
    const firstTwo = `${lines[0]} ${lines[1]}`.trim();
    return firstTwo.slice(0, 220);
  }
  return t.slice(0, 220);
}

function scoreHookDimensions(hookText) {
  const t = String(hookText || "").trim();
  const lower = t.toLowerCase();
  const curiosity =
    (/[?]/.test(t) ? 3 : 0) +
    (/\bbut\b|\bhowever\b|\bsecret\b|\btruth\b|\bmistake\b/i.test(t) ? 3 : 0) +
    (t.length >= 80 ? 2 : 1);
  const specificity =
    (/\d/.test(t) ? 4 : 1) +
    (/\bcase\b|\bframework\b|\bplaybook\b|\bsteps?\b/i.test(lower) ? 3 : 1) +
    (t.length >= 60 ? 2 : 1);
  const clarity =
    (/\bai|sales|founder|product|career|linkedin\b/i.test(lower) ? 4 : 2) +
    (t.length >= 40 ? 3 : 1) +
    (/[a-z]/i.test(t) ? 2 : 0);
  const differentiation =
    (/\bunpopular|wrong|counter|steal this|no one talks\b/i.test(lower) ? 4 : 2) +
    (/\d/.test(t) ? 2 : 1) +
    (t.length >= 70 ? 2 : 1);
  return {
    curiosity_generation: clamp(1, curiosity, 10),
    specificity: clamp(1, specificity, 10),
    topic_clarity: clamp(1, clarity, 10),
    differentiation: clamp(1, differentiation, 10),
  };
}

function to10From100(v) {
  return clamp(1, Math.round(Number(v || 0) / 10), 10);
}

function genericLinkedInSpeakScore(text) {
  const l = String(text || "").toLowerCase();
  const genericHits = [
    "thrilled to share",
    "humbled and honored",
    "grateful for the opportunity",
    "thoughts?",
    "let's connect",
  ].filter((x) => l.includes(x)).length;
  return genericHits;
}

function countWords(text) {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

/**
 * LinkedIn drafts need minimum length and intent; otherwise neutral formula floors
 * (baseline default, saveability +3, etc.) inflate nonsense like "i am eating." to ~40+.
 */
function draftSubstanceMetrics(postText) {
  const trimmed = String(postText || "").trim();
  const words = countWords(trimmed);
  const chars = trimmed.length;
  if (words <= 0 || chars <= 0) {
    return {
      tier: "empty",
      words,
      chars,
      compositeCap: 0,
      rawPenalty: 100,
      baselineDefault: 0,
      saveBase: 0,
      lengthOptOverride: 1,
      expertiseCap: 1,
    };
  }
  if (words < 6 || chars < 36) {
    return {
      tier: "micro",
      words,
      chars,
      compositeCap: 10,
      rawPenalty: 62,
      baselineDefault: 0,
      saveBase: 0,
      lengthOptOverride: 1,
      expertiseCap: 2,
    };
  }
  if (words < 18 || chars < 110) {
    return {
      tier: "stub",
      words,
      chars,
      compositeCap: 20,
      rawPenalty: 42,
      baselineDefault: 6,
      saveBase: 1,
      lengthOptOverride: 2,
      expertiseCap: 4,
    };
  }
  if (words < 32 || chars < 200) {
    return {
      tier: "thin",
      words,
      chars,
      compositeCap: 36,
      rawPenalty: 18,
      baselineDefault: 16,
      saveBase: 2,
      lengthOptOverride: null,
      expertiseCap: null,
    };
  }
  return {
    tier: "normal",
    words,
    chars,
    compositeCap: 100,
    rawPenalty: 0,
    baselineDefault: 30,
    saveBase: 3,
    lengthOptOverride: null,
    expertiseCap: null,
  };
}

function detectReachKillers(postText, historicalPosts, hookArchetype) {
  const t = String(postText || "");
  const l = t.toLowerCase();
  const killers = [];
  const add = (name, severity, fix) => killers.push({ name, severity, fix });
  const tw = countWords(t);
  const tc = t.trim().length;
  if (tw > 0 && (tw < 6 || tc < 36)) {
    add(
      "insufficient_substance_micro_post",
      "high",
      "Expand to a full post (hook, proof, CTA). Micro-posts are scored as non-distributable."
    );
  }
  if (/https?:\/\//i.test(t)) add("external_link_in_body", "high", "Move links to later comments or profile CTA.");
  if (/link in (first )?comment/i.test(l)) add("link_in_first_comment_workaround", "medium", "Avoid explicit workaround language; keep post self-contained.");
  if (/comment\s+yes|type\s+yes|agree\?/i.test(l)) add("engagement_bait_phrase", "high", "Replace bait CTA with specific reflective question.");
  if (genericLinkedInSpeakScore(t) >= 2) add("generic_ai_generated_tone", "medium", "Add concrete personal proof points and remove template phrases.");
  const mentions = (t.match(/@\w+/g) || []).length;
  if (mentions > 5) add("mass_tagging", "medium", "Tag at most 1-3 highly relevant people.");
  if (/please reshare|boost this/i.test(l)) add("reengagement_request", "medium", "Use value-first CTA instead of boost requests.");
  if ((t.match(/#/g) || []).length > 3) add("excessive_hashtags", "low", "Keep hashtags to 1-3 targeted terms.");
  if (/[^\x00-\x7F]{6,}/.test(t)) add("formatting_issues", "low", "Simplify symbols/line breaks for readability.");
  const last3 = (historicalPosts || []).slice(0, 3).map((p) => detectHookArchetypeFromLibrary(String(p?.text || "")));
  if (last3.length === 3 && last3.every((x) => x === hookArchetype)) {
    add("repeated_archetype_last_3_posts", "medium", "Switch to a different hook archetype for variety.");
  }
  return killers;
}

/** Generic / role fluff — not counted as niche "pillars" for draft–niche overlap. */
const NICHE_DRAFT_STOPWORDS = new Set(
  [
    "and",
    "the",
    "for",
    "with",
    "from",
    "your",
    "our",
    "that",
    "this",
    "into",
    "over",
    "about",
    "more",
    "other",
    "some",
    "such",
    "also",
    "just",
    "like",
    "all",
    "any",
    "are",
    "but",
    "not",
    "was",
    "who",
    "what",
    "how",
    "why",
    "its",
    "their",
    "based",
    "leading",
    "experienced",
    "passionate",
    "helping",
    "help",
    "building",
    "scaling",
    "driving",
    "creating",
    "enabling",
    "empowering",
    "world",
    "global",
    "digital",
    "solutions",
    "solution",
    "services",
    "service",
    "industry",
    "industries",
    "company",
    "companies",
    "team",
    "teams",
    "leader",
    "leaders",
    "leadership",
    "management",
    "manager",
    "managers",
    "chief",
    "head",
    "director",
    "executive",
    "senior",
    "principal",
    "staff",
    "junior",
    "associate",
    "consultant",
    "consultants",
    "strategic",
    "strategy",
    "innovative",
    "best",
    "great",
    "strong",
    "top",
    "high",
    "level",
    "years",
    "plus",
    "work",
    "working",
    "career",
    "careers",
    "skilled",
    "expert",
    "experts",
    "professional",
    "professionals",
    "focused",
    "dedicated",
    "passion",
    "love",
    "product",
    "products",
    "platform",
    "platforms",
    "applications",
    "application",
    "software",
    "systems",
    "system",
    "technology",
    "technologies",
    "tech",
    "business",
    "growth",
    "marketing",
    "content",
    "customer",
    "customers",
    "clients",
    "client",
    "users",
    "user",
    "design",
    "designer",
    "delivery",
    "projects",
    "project",
    "programs",
    "program",
    "initiatives",
    "initiative",
    "excellence",
    "quality",
    "people",
    "culture",
    "value",
    "values",
    "vision",
    "mission",
    "brand",
    "brands",
    "market",
    "ecosystem",
    "space",
    "area",
    "field",
    "domains",
    "domain",
    "vertical",
    "verticals",
    "horizontal",
    "across",
    "through",
    "within",
    "between",
    "among",
    "including",
    "especially",
    "primarily",
    "mainly",
    "mostly",
    "well",
    "very",
    "make",
    "made",
    "making",
    "using",
    "used",
    "use",
    "new",
    "next",
    "first",
    "things",
    "thing",
    "way",
    "ways",
    "thought",
    "thoughts",
    "learnings",
    "journey",
    "story",
    "stories",
    "startup",
    "startups",
    "founder",
    "founders",
    "cofounder",
    "builder",
    "builders",
    "entrepreneur",
  ].map((s) => s.toLowerCase())
);

/** Short tokens: only count if whole-word match in draft (avoids substring noise). */
const SHORT_NICHE_TOKENS = new Set(["ml", "ai", "dl", "nlp", "gpu", "tpu", "llm", "rag", "iot", "cv", "bi", "pm"]);

const TECH_ML_NICHE_BLOB = /\b(machine learning|deep learning|data science|mlops|ml ops|artificial intelligence|computer vision|natural language|large language|\bllm\b|\brag\b|neural networks?|pytorch|tensorflow|keras|transformers?|embeddings?|fine[\s-]?tun|inference|model training|gpu\b|tpu|feature store|vector (db|database)|research scientist|applied ml|aiml|machine[\s-]learning|ml engineer|data scientist|ranking models?|recommender)\b/i;

const SALES_NICHE_BLOB = /\b(b2b sales|enterprise sales|saas sales|account executive|sales (leader|manager|director|team)|revenue leader|gtm|go[\s-]to[\s-]market|business development|\bbd\b|\bsdr\b|\bbdr\b|pipeline coverage|quota)\b/i;

/** Declared niche reads as technical ML/AI (not only exact PRD phrases). */
function nicheLooksTechMl(blob) {
  const b = String(blob || "");
  if (!b.trim()) return false;
  if (TECH_ML_NICHE_BLOB.test(b)) return true;
  if (/\b(aiml|genai|generative ai|agentic|a\.i\.)\b/i.test(b)) return true;
  if (
    /\bai\b/i.test(b) &&
    /\b(ml|machine learning|models?|llm|embedding|inference|training|pytorch|tensorflow|keras|jupyter|gpu|vector|ranking|recommender|scientist|research|engineering|engineer|mlops|datasets?)\b/i.test(b)
  ) {
    return true;
  }
  if (/\b(ml|mlo|nlp)\b/i.test(b) && /\b(engineer|engineering|scientist|systems?|ops|platform)\b/i.test(b)) return true;
  return false;
}

const SALES_GTM_POST_RE = /\b(sales|selling|seller|quota|quotas|pipeline|prospecting|prospect|cold (call|outreach|email)|\bAE\b|\bBDR\b|\bSDR\b|account executive|sales (leader|manager|director|team)|revenue target|deal(s)? velocity|win rate|booking(s)?|\bARR\b|\bMRR\b|commission|comp plan|quota attainment|pipeline review|forecast(ing)?|buyer(s)?|closing deals|negotiation(s)?|discount(s)?|procurement|\bRFP\b|gtm\b|go[\s-]to[\s-]market|pipeline hygiene|pipeline coverage|territory planning|sales kickoff|\bSKO\b)\b/gi;

const TECH_ML_POST_RE = /\b(machine learning|deep learning|data science|mlops|\bml\b|\bllm\b|\brag\b|pytorch|tensorflow|keras|transformers?|embeddings?|fine[\s-]?tun|training loop|gradient|backprop|inference latency|gpu\b|tpu|neural|vector (db|store)|embedding model|benchmark dataset|ground truth|labeling|jupyter|notebook|evaluation metric|\bf1 score\b|\bf1\b|precision|recall|arxiv|ablation study|hyperparameters?)\b/gi;

const CAREER_JOB_POST_RE = /\b(we are hiring|now hiring|\bhiring\b|open roles?|job opening|apply here|resume tips?|\bcv\b|interview prep|job search|job seek|unemployed|laid off|offer letter|salary negotiation|referral request)\b/gi;

const PRODUCT_PM_POST_RE = /\b(prd\b|product roadmap|user research|usability|wireframe|\bfigma\b|\bmvp\b|feature flag|release notes|changelog|product[- ]market fit)\b/gi;

const LEADERSHIP_ORG_POST_RE = /\b(team culture|skip level|all hands|reorg|layoff|leading through|\b1:1\b|burnout|mental health at work)\b/gi;

const IC_ENGINEERING_POST_RE = /\b(system design|observability|distributed systems|kubernetes|\bk8s\b|postgres|redis|ci\/cd|postmortem|incident response|\bsla\b|\bslo\b)\b/gi;

const PERSONAL_LIFE_POST_RE = /\b(eating|brunch|lunch|dinner|vacation|holiday|weekend vibes|birthday|married|baby|family time|gym workout|marathon|personal news)\b/gi;

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordBoundaryHas(postLower, token) {
  return new RegExp(`\\b${escapeRegExp(token)}\\b`, "i").test(postLower);
}

function nicheTokenMatchesPost(postLower, token) {
  const t = String(token || "").toLowerCase();
  if (!t) return false;
  if (t.length <= 3) {
    if (!SHORT_NICHE_TOKENS.has(t)) return false;
    return wordBoundaryHas(postLower, t);
  }
  return wordBoundaryHas(postLower, t);
}

function tokenizeNicheBlob(declaredNiche, targetAudience) {
  const blob = `${String(declaredNiche || "")} ${String(targetAudience || "")}`
    .toLowerCase()
    .replace(/\//g, " ")
    .replace(/,/g, " ");
  const parts = blob.split(/[^a-z0-9+]+/).filter(Boolean);
  const seen = new Set();
  const tokens = [];
  for (const p of parts) {
    if (seen.has(p)) continue;
    seen.add(p);
    tokens.push(p);
  }
  return { blob, tokens };
}

function countRegexHits(re, text) {
  const s = String(text || "");
  const m = s.match(re);
  return m ? m.length : 0;
}

/** 
 * Heuristic years ago detector for experience recency.
 * Looks for years (2024, 2025) or "Present".
 */
function getYearsAgo(durationStr) {
  const s = String(durationStr || "").toLowerCase();
  if (s.includes("present") || s.includes("current") || s.includes("now")) return 0;
  if (s.includes("2026") || s.includes("2025") || s.includes("2024")) return 0.5;
  if (s.includes("2023")) return 2;
  if (s.includes("2022") || s.includes("2021")) return 4;
  return 10; // default to old
}

const MISMATCH_CONFIG = {
  none:            { penaltyPct: 0,   cap: 100, label: "Perfect Alignment" },
  adjacent:        { penaltyPct: 10,  cap: 75,  label: "Adjacent Niche" },
  past_experience: { penaltyPct: 12,  cap: 65,  label: "Recent-Past Domain Experience" },
  full:            { penaltyPct: 25,  cap: 45,  label: "Old Experience (Non-core)" },
  severe:          { penaltyPct: 25,  cap: 40,  label: "No Domain Experience (Severe)" },
};

/**
 * Declared niche vs draft overlap + cross-track penalty (e.g. AIML niche, pure sales draft).
 * Now incorporates profile-awareness (experience items).
 */
function computeDraftNicheAlignment(declaredNiche, targetAudience, postText, experienceItems = []) {
  const postLower = String(postText || "").toLowerCase();
  const { blob, tokens } = tokenizeNicheBlob(declaredNiche, targetAudience);
  const meaningful = tokens.filter(
    (t) => !NICHE_DRAFT_STOPWORDS.has(t) && (t.length >= 4 || SHORT_NICHE_TOKENS.has(t))
  );

  let declaredIdentityAlignment;
  if (!blob.trim()) {
    declaredIdentityAlignment = 28;
  } else if (!meaningful.length) {
    declaredIdentityAlignment = 34;
  } else {
    const hits = meaningful.filter((t) => nicheTokenMatchesPost(postLower, t)).length;
    declaredIdentityAlignment = Math.round((hits / meaningful.length) * 100);
  }

  const nicheTechMl = nicheLooksTechMl(blob);
  const nicheSales = SALES_NICHE_BLOB.test(blob);
  const nicheHybrid = nicheTechMl && nicheSales;
  const postSalesHits = countRegexHits(SALES_GTM_POST_RE, postLower);
  const postTechHits = countRegexHits(TECH_ML_POST_RE, postLower);

  let nicheDraftTrackMismatch = false;
  if (!nicheHybrid && nicheTechMl && postSalesHits >= 2 && postTechHits < 2) {
    nicheDraftTrackMismatch = true;
    declaredIdentityAlignment = Math.min(declaredIdentityAlignment, 22);
  } else if (!nicheHybrid && nicheTechMl && postSalesHits >= 1 && postTechHits === 0) {
    nicheDraftTrackMismatch = true;
    declaredIdentityAlignment = Math.min(declaredIdentityAlignment, 28);
  } else if (!nicheHybrid && nicheSales && postTechHits >= 3 && postSalesHits === 0) {
    nicheDraftTrackMismatch = true;
    declaredIdentityAlignment = Math.min(declaredIdentityAlignment, 26);
  }

  if (/\bmachine learning\b/i.test(blob) && !/\bmachine learning\b/i.test(postLower) && !/\bml\b/i.test(postLower)) {
    declaredIdentityAlignment = Math.min(declaredIdentityAlignment, declaredIdentityAlignment >= 70 ? 48 : declaredIdentityAlignment);
  }

  if (nicheTechMl && !nicheHybrid && postTechHits >= 3 && postSalesHits < 2) {
    declaredIdentityAlignment = Math.max(
      declaredIdentityAlignment,
      Math.min(92, 52 + Math.min(28, postTechHits * 5))
    );
  } else if (nicheSales && !nicheHybrid && postSalesHits >= 3 && postTechHits < 2) {
    declaredIdentityAlignment = Math.max(declaredIdentityAlignment, Math.min(90, 50 + Math.min(25, postSalesHits * 5)));
  }

  let mismatchLevel = "none";
  let postDomain = "other";

  if (postTechHits > postSalesHits && postTechHits >= 1) postDomain = "engineering";
  else if (postSalesHits >= 1) postDomain = "sales";
  else if (countRegexHits(CAREER_JOB_POST_RE, postLower) >= 1) postDomain = "careers";

  const isProfileNicheMatch = declaredIdentityAlignment >= 65 || (postDomain === "engineering" && nicheTechMl) || (postDomain === "sales" && nicheSales);
  
  // Pivot Logic: If user EXPLICITLY set a target audience, and post matches that intent, reduce penalty.
  const targetLower = String(targetAudience || "").toLowerCase();
  const isIntentionalTargetMatch = targetLower.length > 3 && (
    (postDomain === "sales" && /\b(sales|gtm|revenue|seller)\b/i.test(targetLower)) ||
    (postDomain === "engineering" && /\b(ai|ml|eng|tech|developer)\b/i.test(targetLower)) ||
    (postDomain === "careers" && /\b(hiring|job|recruiter|candidate)\b/i.test(targetLower))
  );

  if (isProfileNicheMatch || isIntentionalTargetMatch) {
    mismatchLevel = isProfileNicheMatch ? "none" : "adjacent"; // Pivot is "adjacent" by default unless profile is updated
  } else {
    // Check experience history
    const domainRe = postDomain === "engineering" ? TECH_ML_POST_RE : postDomain === "sales" ? SALES_GTM_POST_RE : /[]/;
    const relevantExp = (experienceItems || []).filter(exp => {
        const text = `${exp.title} ${exp.description}`.toLowerCase();
        return domainRe.test(text);
    });

    if (relevantExp.length === 0) {
        mismatchLevel = "severe";
    } else {
        const minYears = Math.min(...relevantExp.map(e => getYearsAgo(e.duration)));
        if (minYears <= 2) mismatchLevel = "past_experience";
        else if (minYears <= 5) mismatchLevel = "full";
        else mismatchLevel = "severe";
    }
  }

  // Final drift score integration
  const config = MISMATCH_CONFIG[mismatchLevel];
  const nichePenaltyMultiplier = 1 - (config.penaltyPct / 100);

  return {
    declaredIdentityAlignment,
    nicheDraftTrackMismatch,
    mismatchLevel,
    mismatchLabel: config.label,
    mismatchCap: config.cap,
    nichePenaltyMultiplier,
    postSalesHits,
    postTechHits,
    postDomain,
    meaningfulTokens: meaningful,
  };
}

function truncMeta(s, n) {
  const t = String(s || "").trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

/**
 * Heuristic audience routing + profile/niche drift (deterministic / "model-derived" buckets, not LinkedIn ground truth).
 */
function inferDraftAudienceProfileDrift({
  postLower,
  substance,
  declaredNicheRaw,
  targetAudienceRaw,
  declaredIdentityAlignment,
  demonstratedBehaviorAlignment,
  nicheDraftTrackMismatch,
  postSalesHits,
  postTechHits,
  userMetrics,
}) {
  const salesHits = postSalesHits;
  const mlHits = postTechHits;
  const careerHits = countRegexHits(CAREER_JOB_POST_RE, postLower);
  const productHits = countRegexHits(PRODUCT_PM_POST_RE, postLower);
  const leadershipHits = countRegexHits(LEADERSHIP_ORG_POST_RE, postLower);
  const icEngHits = countRegexHits(IC_ENGINEERING_POST_RE, postLower);
  const personalHits = countRegexHits(PERSONAL_LIFE_POST_RE, postLower);

  const buckets = [
    { key: "sales_gtm", label: "Revenue / GTM / sales operators (AEs, RevOps, deal motion)", n: salesHits },
    { key: "technical_ml_data", label: "ML, data, and applied AI practitioners (ICs, tech leads)", n: mlHits },
    { key: "software_engineering_ic", label: "Software / platform engineers (systems, backends, infra)", n: icEngHits },
    { key: "product_ux", label: "Product, design, and research audience", n: productHits },
    { key: "careers_talent", label: "Job seekers, recruiters, and hiring-process audience", n: careerHits },
    { key: "leadership_org", label: "Managers and org / culture topics", n: leadershipHits },
    { key: "personal_social", label: "Close network / lifestyle — weak professional routing", n: personalHits },
  ];
  const sorted = [...buckets].sort((a, b) => b.n - a.n);
  const maxN = sorted[0].n;
  const secondN = sorted[1]?.n ?? 0;

  let primaryKey = "broad_professional_unclear";
  let primaryLabel =
    "Graph-affinity distribution: Mostly 1st-degree connections and active neighbors (no specific niche-routing cues detected).";

  if (substance.tier === "empty" || substance.tier === "micro") {
    primaryKey = "not_routable_minimal";
    primaryLabel =
      "Post is too short: LinkedIn won't be able to tell who this is for. It will only reach a few close friends.";
  } else if (maxN >= 2 || (maxN === 1 && secondN === 0)) {
    const win = sorted[0];
    primaryKey = win.key;
    primaryLabel =
      maxN >= 2
        ? `Main audience: ${win.label} (based on ${maxN} mentions in your post).`
        : `Leaning toward: ${win.label} (1 mention). Try adding more specific words for this audience.`;
    if (secondN >= 1 && secondN >= maxN - 1 && sorted[1].key !== win.key) {
      primaryLabel += ` Also reaches: ${sorted[1].label}.`;
    }
  } else if (personalHits >= 1 && salesHits + mlHits + careerHits + productHits + leadershipHits + icEngHits <= 1) {
    primaryKey = "personal_social";
    primaryLabel =
      "Personal update: Mostly reaches people who already know you—not a business audience.";
  }

  if (nicheDraftTrackMismatch && substance.tier !== "empty" && substance.tier !== "micro") {
    primaryLabel +=
      " Topic track (sales-heavy vs ML/tech-heavy) conflicts with your declared niche shape — tighten alignment or update niche if intentional.";
  }

  let driftScore = Math.round(
    (100 - declaredIdentityAlignment) * 0.44 + (100 - demonstratedBehaviorAlignment) * 0.3
  );
  if (nicheDraftTrackMismatch) driftScore += 20;
  if (substance.tier === "micro" || substance.tier === "empty") driftScore = Math.max(driftScore, 92);
  else if (substance.tier === "stub") driftScore = Math.max(driftScore, 62);
  else if (substance.tier === "thin") driftScore = Math.max(driftScore, 38);
  driftScore = clamp(0, driftScore, 100);

  const driftBand =
    driftScore >= 75 ? "severe" : driftScore >= 52 ? "strong" : driftScore >= 30 ? "moderate" : "aligned";

  let driftSummary = "";
  if (driftBand === "aligned") {
    driftSummary =
      "Low drift: draft is reasonably consistent with your declared niche wording and behavior-weighted signals.";
  } else if (driftBand === "moderate") {
    driftSummary =
      "Moderate drift: part of your audience will recognize the niche; others may scroll past as off-topic.";
  } else if (driftBand === "strong") {
    driftSummary =
      "Strong drift: niche followers and profile-positioning are misaligned — expect weaker saves and weaker inbound fit.";
  } else {
    driftSummary =
      "Severe drift or non-post: text does not substantiate your profile promise, or is too short to register as on-brand.";
  }

  const routingSignalsModelNote =
    "Routing cue counts are model-derived heuristics (regex buckets), not LinkedIn impressions. Zeros mean no strong lexical matches in that bucket — not “no audience exists.”";

  return {
    primaryKey,
    primaryLabel,
    driftScore,
    driftBand,
    driftSummary,
    routingSignalsModelNote,
    routing_signal_hits: {
      sales_gtm: salesHits,
      ml_tech: mlHits,
      swe_ic: icEngHits,
      product_ux: productHits,
      careers: careerHits,
      leadership_org: leadershipHits,
      personal_life: personalHits,
    },
    declared_niche_echo: truncMeta(declaredNicheRaw, 140),
    target_audience_echo: truncMeta(targetAudienceRaw, 140),
    user_metrics: userMetrics || null,
  };
}

const _dir = dirname(fileURLToPath(import.meta.url));
const CONTENT_PROMPT_PATH = join(_dir, "prompts/content-analyzer-system.txt");
const CONTENT_PROMPT_TEXT = readFileSync(CONTENT_PROMPT_PATH, "utf8");

/**
 * @param {Record<string, unknown>|null|undefined} dataset
 * @param {Record<string, unknown>|null|undefined} profileOut
 * @param {Record<string, unknown>|null|undefined} behaviorOut
 */
export function runContentAnalyzerFlow(dataset, profileOut, behaviorOut) {
  const draft = dataset?.contentDraft;
  if (!draft || typeof draft !== "object") {
    return {
      flow_id: "content_flow",
      prompt_passport: createPromptPassport({
        layer: "content_flow",
        module: "content_analyzer",
        promptPath: CONTENT_PROMPT_PATH,
        promptText: CONTENT_PROMPT_TEXT,
        promptVersion: "v1.0",
      }),
      status: "awaiting_mandatory_input",
      missing_inputs: ["contentDraft.postText", "contentDraft.intendedFormat", "contentDraft.intendedPublishAt"],
    };
  }

  const postText = String(draft.postText || "").trim();
  const format = String(draft.intendedFormat || "").trim().toLowerCase();
  
  // Media multipliers (Formula 2 Enhancement)
  let mediaMultiplier = 1.0;
  if (format.includes("image") && format.includes("video")) mediaMultiplier = 1.7;
  else if (format.includes("video")) mediaMultiplier = 1.5;
  else if (format.includes("image")) mediaMultiplier = 1.3;
  else if (format === "text_with_both") mediaMultiplier = 1.7; // explicit both
  
  const publishAt = String(draft.intendedPublishAt || "").trim();
  const hookArchetype =
    String(draft.hookArchetype || "").trim() || detectHookArchetypeFromLibrary(postText);
  const hookText = firstTwoLinesOr220(postText);
  const hookScores = scoreHookDimensions(hookText);
  const historicalPosts = Array.isArray(dataset?.historicalPosts) ? dataset.historicalPosts : [];
  const substance = draftSubstanceMetrics(postText);
  const postWords = substance.words;
  const t = mergePostTuning(dataset?.scoringTuning?.post);

  const declaredNicheRaw = String(dataset?.userContext?.declared_niche || "");
  const targetAudienceRaw = String(dataset?.userContext?.target_audience || "");
  const postLower = postText.toLowerCase();
  const nicheAlign = computeDraftNicheAlignment(declaredNicheRaw, targetAudienceRaw, postText, dataset?.profile?.experienceItems || []);
  const declaredIdentityAlignment = nicheAlign.declaredIdentityAlignment;
  const nicheDraftTrackMismatch = nicheAlign.nicheDraftTrackMismatch;
  const meaningfulNicheTokens = nicheAlign.meaningfulTokens;

  const profileTier = String(profileOut?.composite_classification?.tier || "");
  const behaviorScore = Number(behaviorOut?.behavioral_classification?.score_0_to_100 || 0);
  const behaviorNiche = Number(behaviorOut?.ratios?.niche_coherence || 0);

  const profileKeywords = [
    String(dataset?.profile?.headline || ""),
    String(dataset?.profile?.about || ""),
  ]
    .join(" ")
    .toLowerCase();
  const demonstratedBehaviorAlignment = Math.round(
    behaviorScore * t.demonstrated_behavior_score_weight + behaviorNiche * t.demonstrated_behavior_niche_weight
  );
  const hookStrength = startsStrong(postText);

  const coherenceScore = clamp(
    0,
    Math.round(
      declaredIdentityAlignment * t.coherence_identity_weight +
        demonstratedBehaviorAlignment * t.coherence_behavior_weight +
        hookStrength * t.coherence_hook_strength_scale
    ),
    100
  );

  const coherenceBand = coherenceScore >= 80 ? "strong" : coherenceScore >= 60 ? "mixed" : "diluted";
  const risks = [];
  if (declaredIdentityAlignment < 60) risks.push("Draft appears weakly aligned with declared niche.");
  if (nicheDraftTrackMismatch) {
    risks.push("Draft topic track (e.g. GTM/sales) diverges from declared technical ML/AI niche (or the reverse).");
  }
  if (hookStrength < 6) risks.push("Hook likely weak before the 275-char attention cutoff.");
  if (substance.tier === "micro" || substance.tier === "stub") {
    risks.push("Draft is far below minimum length for a LinkedIn post; scores are heavily discounted.");
  }
  if (demonstratedBehaviorAlignment < 55) risks.push("Draft intent diverges from demonstrated behavior pattern.");

  const weeklyActions = [
    "Publish only drafts with coherence_score >= 70.",
    "Use one niche keyword in first 150 characters.",
    "Align post CTA with current behavior objective.",
  ];

  const histEngagement = historicalPosts
    .map((p) => Number(p?.engagementRate))
    .filter((n) => Number.isFinite(n));
  const baselineEngagement = histEngagement.length
    ? Number((histEngagement.reduce((a, b) => a + b, 0) / histEngagement.length).toFixed(2))
    : null;
  const baselineForScore = baselineEngagement != null ? baselineEngagement : substance.baselineDefault;

  // B) Profile-Content Coherence
  const topicMatch = to10From100(declaredIdentityAlignment);
  const complexitySignals = (
    postText.match(/\b(api|architecture|latency|data\s+pipeline|ml\s+pipeline|benchmark|strategy|systems?)\b/gi) || []
  ).length;
  let expertiseLevelMatch = clamp(
    1,
    Math.round(
      profileTier.includes("AUTHORITY") || profileTier.includes("NICHE")
        ? 5 + Math.min(5, complexitySignals)
        : 6 + Math.min(4, complexitySignals / 2)
    ),
    10
  );
  if (substance.expertiseCap != null) {
    expertiseLevelMatch = clamp(1, Math.min(expertiseLevelMatch, substance.expertiseCap), 10);
  }
  const voiceConsistency = clamp(1, 10 - genericLinkedInSpeakScore(postText), 10);
  const nichePhraseHit =
    meaningfulNicheTokens.length > 0 &&
    meaningfulNicheTokens.some((t) => nicheTokenMatchesPost(postLower, t));
  const credibilityAnchoring = clamp(
    1,
    (/\d/.test(postText) ? 4 : 2) + (nichePhraseHit ? 3 : 1) + (profileKeywords.includes("founder") ? 2 : 1),
    10
  );

  // C) Behavior-Content Coherence
  const topicFamiliarity = to10From100(demonstratedBehaviorAlignment);
  const audiencePreWarming = clamp(1, Math.round((behaviorNiche * 0.7 + baselineForScore) / 13), 10);

  // D) Format Optimization
  const formatContentMatch = clamp(
    1,
    Math.round(
      (["framework_playbook", "Numbered Promise", "Specific Number"].includes(hookArchetype) && ["carousel", "document"].includes(format) ? 9 : 6) ||
        (["personal_story", "Confessional"].includes(hookArchetype) && format === "text" ? 8 : 6)
    ),
    10
  );
  const lengthOptimization =
    substance.lengthOptOverride != null
      ? substance.lengthOptOverride
      : postWords < 120
        ? 5
        : postWords < 220
          ? 8
          : postWords < 420
            ? 9
            : postWords < 700
              ? 7
              : 5;
  const ctaStrength = clamp(1, (/[?]/.test(postText) ? 6 : 3) + (/you|your/.test(postText.toLowerCase()) ? 2 : 1), 10);

  // E) Save-trigger elements
  const saveElements = [
    { k: "frameworks", m: /\bframework|playbook|system\b/i },
    { k: "numbered_lists", m: /\b\d+\s+(ways|steps|principles|rules|mistakes)\b/i },
    { k: "checklists", m: /\bchecklist\b/i },
    { k: "templates", m: /\btemplate\b|\bcopy[- ]paste\b/i },
    { k: "diagrams_visualizations", m: /\bdiagram|chart|visual\b/i },
    { k: "specific_reference_data", m: /\b\d+%|\b\d+x|\bbenchmark|stat\b/i },
  ];
  const saveDetected = saveElements.filter((x) => x.m.test(postText)).map((x) => x.k);
  const saveability = clamp(1, substance.saveBase + saveDetected.length, 10);

  // F) Reach killer detection
  const reachKillers = detectReachKillers(postText, historicalPosts, hookArchetype);

  // G) Variety check
  const histHooks = historicalPosts.map((p) => detectHookArchetypeFromLibrary(String(p?.text || "")));
  const hookRepetition = histHooks.slice(0, 5).filter((x) => x === hookArchetype).length;
  const formatRepetition = historicalPosts.slice(0, 5).filter((p) => String(p?.format || "").toLowerCase() === format).length;
  const varietyScore = clamp(1, 10 - Math.max(hookRepetition - 1, 0) - Math.max(formatRepetition - 2, 0), 10);

  // H) Performance prediction
  const killerPenalty = reachKillers.length * t.killer_penalty_per_flag;
  let rawPredictedScore = clamp(
    0,
    Math.round(
      coherenceScore * t.raw_coherence_multiplier +
        demonstratedBehaviorAlignment * t.raw_demonstrated_multiplier +
        saveability * t.raw_saveability_multiplier +
        varietyScore * t.raw_variety_multiplier +
        baselineForScore -
        killerPenalty -
        substance.rawPenalty
    ),
    100
  );
  if (nicheDraftTrackMismatch) {
    rawPredictedScore = clamp(
      0,
      Math.round(rawPredictedScore * t.niche_mismatch_raw_multiplier - t.niche_mismatch_raw_subtract),
      100
    );
  }
  const severeProfileMismatch = declaredIdentityAlignment < 40 || nicheDraftTrackMismatch;
  // Hard guardrail: if draft is far off declared profile niche, cap overall quality.
  const predictedScore = Math.min(
    severeProfileMismatch
      ? Math.min(
          rawPredictedScore,
          nicheDraftTrackMismatch ? t.severe_cap_niche_track_mismatch : t.severe_cap_other_mismatch
        )
      : rawPredictedScore,
    substance.compositeCap
  );
  const impressionRange = predictedScore >= 75 ? "high" : predictedScore >= 50 ? "mid" : "low";
  const confidenceInterval = predictedScore >= 75 ? "medium" : predictedScore >= 55 ? "medium" : "low";
  const hookAvg = Math.round(
    (hookScores.curiosity_generation +
      hookScores.specificity +
      hookScores.topic_clarity +
      hookScores.differentiation) /
      4
  );
  const hookAlternatives =
    hookAvg < 7
      ? [
          {
            hook: "3 patterns top builders use before shipping this topic",
            archetype: "Numbered Promise",
            rationale: "Specific-number framing boosts clarity and curiosity quickly.",
          },
          {
            hook: "I was wrong about this topic - here is what changed",
            archetype: '"I Was Wrong" Pivot',
            rationale: "Confessional pivot increases authenticity and scroll-stop effect.",
          },
          {
            hook: "Steal this checklist before your next post on this niche",
            archetype: '"Steal This" Offer',
            rationale: "Actionable utility framing can improve saves and shares.",
          },
        ]
      : [];
  const top5Issues = [
    ...(substance.tier === "micro" || substance.tier === "empty"
      ? [
          {
            severity: "high",
            issue: "Draft is far too short to evaluate as a LinkedIn post (micro / no substance).",
            fix: "Write at least ~50–80 words with a clear hook, one concrete detail, and a CTA.",
          },
        ]
      : []),
    ...(substance.tier === "stub"
      ? [
          {
            severity: "high",
            issue: "Draft is still stub-length; distribution and save signals will stay very low.",
            fix: "Target ~120+ words for a standard feed post unless this is intentional teaser copy.",
          },
        ]
      : []),
    ...(nicheDraftTrackMismatch
      ? [
          {
            severity: "high",
            issue:
              "Topic track mismatch: draft reads GTM/sales-heavy while declared niche is technical ML/AI (or the opposite). Generic overlap (e.g. 'AI') is not enough.",
            fix: "Rewrite for your declared niche pillars, or update declared niche / target audience if this topic is intentional.",
          },
        ]
      : []),
    ...(severeProfileMismatch && !nicheDraftTrackMismatch
      ? [
          {
            severity: "high",
            issue: "Draft is strongly off-profile for declared niche.",
            fix: "Either pivot post to your niche pillars or publish from a separate, matching profile.",
          },
        ]
      : []),
    ...(declaredIdentityAlignment < 70
      ? [{ severity: "high", issue: "Topic drifts from declared niche", fix: "Anchor draft to a declared pillar keyword." }]
      : []),
    ...(demonstratedBehaviorAlignment < 65
      ? [{ severity: "high", issue: "Weak behavior-content alignment", fix: "Warm this topic via in-niche engagement first." }]
      : []),
    ...(hookAvg < 7
      ? [{ severity: "medium", issue: "Hook strength below target", fix: "Use a stronger archetype with concrete specificity." }]
      : []),
    ...reachKillers.slice(0, 5).map((x) => ({
      severity: x.severity,
      issue: x.name,
      fix: x.fix,
    })),
  ].slice(0, 5);
  const decisionRecommendation =
    predictedScore >= 80
      ? "Post as is"
      : predictedScore >= 60
        ? "Edit then post"
        : predictedScore >= 40
          ? "Significant rework needed"
          : "Do not post / save for later";
  const editSuggestions = [
    {
      edit: "Strengthen first 220 chars with a specific claim and audience cue.",
      why: "Improves hook clarity and audience routing signals early in the post.",
    },
    {
      edit: "Add one concrete proof point (number, case, or outcome).",
      why: "Increases credibility anchoring and perceived expertise consistency.",
    },
    {
      edit: "Use a CTA that invites substantive replies (not engagement bait).",
      why: "Improves comment quality while avoiding reach-killer patterns.",
    },
  ];
  const scoreCard = {
    composite_score_0_to_100: predictedScore,
    sub_scores_1_to_10: {
      A_hook_strength: hookAvg,
      B_profile_content_coherence: Math.round((topicMatch + expertiseLevelMatch + voiceConsistency + credibilityAnchoring) / 4),
      C_behavior_content_coherence: Math.round((topicFamiliarity + audiencePreWarming) / 2),
      D_format_optimization: Math.round((formatContentMatch + lengthOptimization + ctaStrength) / 3),
      E_saveability: saveability,
      F_reach_killer_hygiene: clamp(1, 10 - reachKillers.length, 10),
      G_variety: varietyScore,
      H_predicted_performance: to10From100(predictedScore),
    },
    decision: decisionRecommendation,
  };

  const audienceDrift = inferDraftAudienceProfileDrift({
    postLower,
    substance,
    declaredNicheRaw,
    targetAudienceRaw: String(dataset?.userContext?.target_audience || ""),
    declaredIdentityAlignment,
    demonstratedBehaviorAlignment,
    nicheDraftTrackMismatch,
    postSalesHits: nicheAlign.postSalesHits,
    postTechHits: nicheAlign.postTechHits,
    userMetrics: dataset?.metricsSummary,
  });

  return {
    flow_id: "content_flow",
    prompt_passport: createPromptPassport({
      layer: "content_flow",
      module: "content_analyzer",
      promptPath: CONTENT_PROMPT_PATH,
      promptText: CONTENT_PROMPT_TEXT,
      promptVersion: "v1.0",
    }),
    status: "implemented_basic",
    draft_analysis_metadata: {
      draft_length_words: postWords,
      intended_format: format,
      media_multiplier: mediaMultiplier,
      intended_publish_time: publishAt,
      declared_niche: String(dataset?.userContext?.declared_niche || ""),
      profile_tier: profileTier || null,
      behavior_tier: behaviorOut?.behavioral_classification?.tier || null,
      niche_coherence_ratio: behaviorOut?.ratios?.niche_coherence ?? null,
      niche_draft_track_mismatch: nicheDraftTrackMismatch,
      mismatch_level: nicheAlign.mismatchLevel,
      mismatch_label: nicheAlign.mismatchLabel,
      mismatch_cap: nicheAlign.mismatchCap,
      niche_penalty_multiplier: nicheAlign.nichePenaltyMultiplier,
      post_domain: nicheAlign.postDomain,
      draft_sales_signal_hits: nicheAlign.postSalesHits,
      draft_tech_ml_signal_hits: nicheAlign.postTechHits,
      meaningful_niche_token_count: meaningfulNicheTokens.length,
      draft_substance_tier: substance.tier,
      draft_char_count: substance.chars,
      draft_audience_primary_key: audienceDrift.primaryKey,
      draft_audience_label: audienceDrift.primaryLabel,
      draft_profile_drift_score_0_to_100: audienceDrift.driftScore,
      draft_profile_drift_band: audienceDrift.driftBand,
      draft_profile_drift_summary: audienceDrift.driftSummary,
      draft_routing_signal_hits: audienceDrift.routing_signal_hits,
      draft_routing_signals_model_note: audienceDrift.routingSignalsModelNote,
      declared_niche_echo: audienceDrift.declared_niche_echo,
      target_audience_echo: audienceDrift.target_audience_echo,
    },
    analysis_metadata: {
      intended_format: format,
      intended_publish_at: publishAt,
      hook_archetype: hookArchetype,
      hook_archetype_source: draft.hookArchetype ? "user_provided" : "auto_detected",
      profile_tier_reference: profileTier || null,
    },
    sub_analyses: {
      A_hook_detection_strength: {
        practitioner_note:
          "First-2-lines hook influence is practitioner-observed (🟡), not paper-verified.",
        extracted_hook_text: hookText,
        extraction_method: "first_2_lines_or_first_220_chars",
        detected_archetype: hookArchetype,
        archetype_library_count: HOOK_ARCHETYPES.length,
        scores_1_to_10: hookScores,
      },
      B_profile_content_coherence: {
        scores_1_to_10: {
          topic_match: topicMatch,
          expertise_level_match: expertiseLevelMatch,
          voice_consistency: voiceConsistency,
          credibility_anchoring: credibilityAnchoring,
        },
      },
      C_behavior_content_coherence: {
        scores_1_to_10: {
          topic_familiarity: topicFamiliarity,
          audience_pre_warming: audiencePreWarming,
        },
      },
      D_format_optimization: {
        scores_1_to_10: {
          format_content_match: formatContentMatch,
          length_optimization: lengthOptimization,
          cta_strength: ctaStrength,
        },
      },
      E_save_trigger_detection: {
        practitioner_note:
          "Save-weight emphasis is practitioner-observed (🟡), not paper-verified.",
        elements_detected: saveDetected,
        saveability_score_1_to_10: saveability,
      },
      F_reach_killer_detection: {
        flags: reachKillers,
      },
      G_variety_check: {
        score_1_to_10: varietyScore,
        hook_repetition_last_5: hookRepetition,
        format_repetition_last_5: formatRepetition,
        flag_same_pattern_3_plus: hookRepetition >= 3 || formatRepetition >= 3,
      },
      H_performance_prediction: {
        predicted_impression_range: impressionRange,
        predicted_save_rate_band: saveability >= 7 ? "high" : saveability >= 5 ? "mid" : "low",
        predicted_comment_quality_band: ctaStrength >= 7 ? "high" : ctaStrength >= 5 ? "mid" : "low",
        confidence_interval: confidenceInterval,
        note: "Predictions are directional, not precise.",
      },
    },
    hook_analysis: {
      detected_archetype: hookArchetype,
      scores: hookScores,
      alternatives: hookAlternatives,
    },
    coherence_analysis: {
      profile_coherence: {
        topic_match: topicMatch,
        expertise_level_match: expertiseLevelMatch,
        voice_consistency: voiceConsistency,
        credibility_anchoring: credibilityAnchoring,
        coherence_band: coherenceBand,
      },
      behavior_coherence: {
        topic_familiarity: topicFamiliarity,
        audience_pre_warming: audiencePreWarming,
      },
    },
    format_analysis: {
      format_content_match: formatContentMatch,
      length_optimization: lengthOptimization,
      cta_strength: ctaStrength,
    },
    saveability_analysis: {
      elements_detected: saveDetected,
      saveability_score_1_to_10: saveability,
    },
    reach_killers_detected: reachKillers,
    variety_analysis: {
      variety_score_1_to_10: varietyScore,
      hook_repetition_last_5: hookRepetition,
      format_repetition_last_5: formatRepetition,
      repeated_pattern_flag: hookRepetition >= 3 || formatRepetition >= 3,
    },
    performance_prediction: {
      impression_range: impressionRange,
      save_likelihood: saveability >= 7 ? "high" : saveability >= 5 ? "medium" : "low",
      comment_quality_prediction: ctaStrength >= 7 ? "high" : ctaStrength >= 5 ? "medium" : "low",
      confidence: confidenceInterval,
      comparison_to_user_average: baselineEngagement == null
        ? "historical baseline unavailable"
        : predictedScore >= baselineEngagement
          ? "above_user_average"
          : "below_user_average",
      user_average_engagement_rate: baselineEngagement,
      severe_profile_mismatch: severeProfileMismatch,
      raw_model_score_before_mismatch_cap: rawPredictedScore,
      final_score_after_mismatch_cap: predictedScore,
    },
    quality_score_card: scoreCard,
    composite_quality_score: predictedScore,
    decision_recommendation: decisionRecommendation,
    top_5_issues: top5Issues,
    edit_suggestions: editSuggestions,
    coherence_checks: {
      declared_identity_alignment: declaredIdentityAlignment,
      demonstrated_behavior_alignment: demonstratedBehaviorAlignment,
      hook_strength_1_to_10: hookStrength,
      coherence_score_0_to_100: coherenceScore,
      coherence_band: coherenceBand,
      severe_profile_mismatch: severeProfileMismatch,
    },
    risks_detected: risks,
    pre_publish_recommendations: [
      {
        action: "Tighten hook with specific outcome and niche keyword.",
        confidence: "🟢",
      },
      {
        action: "Ensure body has one concrete proof point (metric/example).",
        confidence: "🟡",
      },
      {
        action: "Use CTA that matches desired audience action.",
        confidence: "🟡",
      },
    ],
    weekly_action_recommendations: weeklyActions,
    paper_grounded_disclaimer:
      "This pre-publish analysis follows 360Brew verbalization principles (arXiv 2501.16450). It is directional, not a literal LinkedIn ranking prediction.",
    pulled_from_other_modules: {
      profile_analyzer: "latest tier + profile text signals",
      behavior_analyzer: "niche coherence + behavior strength",
      historical_posts_database: historicalPosts.length
        ? {
            connected: true,
            posts_count: historicalPosts.length,
            baseline_engagement_rate: baselineEngagement,
          }
        : { connected: false, note: "Provide historicalPosts (10-30) to enable baseline comparison." },
      hook_archetype_library: {
        connected: true,
        archetypes_count: HOOK_ARCHETYPES.length,
        selected_archetype: hookArchetype,
      },
    },
  };
}
