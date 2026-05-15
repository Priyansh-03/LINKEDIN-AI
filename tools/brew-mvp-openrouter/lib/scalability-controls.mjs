/**
 * Scalability controls:
 * - per-user daily analysis limits
 * - plan quotas
 * - TTL cache checks
 */

const DAILY_MAX = Number(process.env.BREW_MVP_DAILY_ANALYSIS_MAX || 50);

const PLAN_LIMITS = {
  free: { profilePerMonth: 1, contentPerMonth: 5 },
  pro: { profilePerMonth: 999999, contentPerMonth: 999999 },
  team: { profilePerMonth: 999999, contentPerMonth: 999999 },
  coach: { profilePerMonth: 999999, contentPerMonth: 999999 },
};

const CACHE_TTL_MS = {
  profile: 30 * 24 * 60 * 60 * 1000,
  behavior: 24 * 60 * 60 * 1000,
  comparative: 7 * 24 * 60 * 60 * 1000,
  content: 0,
};

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * @param {string} plan
 */
export function resolvePlan(plan) {
  const p = String(plan || "free").trim().toLowerCase();
  return PLAN_LIMITS[p] ? p : "free";
}

/**
 * @param {import("mongodb").Db} db
 * @param {string} colName
 * @param {string} userId
 */
export async function enforceDailyLimit(db, colName, userId) {
  const since = startOfDay();
  const n = await db.collection(colName).countDocuments({ userId, createdAt: { $gte: since } });
  if (n >= DAILY_MAX) {
    throw new Error(`Daily analysis limit reached (${DAILY_MAX}/day)`);
  }
}

/**
 * @param {import("mongodb").Db} db
 * @param {string} colName
 * @param {string} userId
 * @param {"profile"|"content"} module
 * @param {string} userPlan
 */
export async function enforcePlanQuota(db, colName, userId, module, userPlan) {
  const plan = resolvePlan(userPlan);
  const limits = PLAN_LIMITS[plan];
  const since = startOfMonth();
  const n = await db.collection(colName).countDocuments({ userId, createdAt: { $gte: since } });
  const cap = module === "profile" ? limits.profilePerMonth : limits.contentPerMonth;
  if (n >= cap) {
    throw new Error(`Monthly ${module} quota reached for plan=${plan} (cap=${cap})`);
  }
}

/**
 * @param {import("mongodb").Db} db
 * @param {string} colName
 * @param {string} userId
 * @param {"profile"|"behavior"|"content"|"comparative"} module
 */
export async function getFreshCachedAnalysis(db, colName, userId, module) {
  const ttl = CACHE_TTL_MS[module];
  if (!ttl) return null;
  const since = new Date(Date.now() - ttl);
  return await db
    .collection(colName)
    .find({ userId, status: "completed", createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
}

/**
 * @param {import("mongodb").Db} db
 * @param {string} colName
 * @param {{ module: string, userId: string, traceId: string, success: boolean, latencyMs: number, details?: Record<string, unknown> }} payload
 */
export async function recordModuleMetric(db, colName, payload) {
  await db.collection(colName).insertOne({
    module: payload.module,
    userId: payload.userId,
    traceId: payload.traceId,
    success: payload.success,
    latencyMs: payload.latencyMs,
    details: payload.details || {},
    createdAt: new Date(),
  });
}

export function cacheTtlMs(module) {
  return CACHE_TTL_MS[module] ?? 0;
}
