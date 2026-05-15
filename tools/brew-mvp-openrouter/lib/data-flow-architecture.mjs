import { randomUUID } from "node:crypto";
import {
  getMongoDb,
  mongodbCollections,
  insertUnifiedAnalysis,
} from "./mongodb-persistence.mjs";
import { runLayer1Verbalize } from "./layer1-verbalize.mjs";
import {
  runLayer2PassASubAnalyses,
  runLayer2PassBSynthesis,
} from "./layer2-two-pass.mjs";
import { runLayer3StreamCompletion } from "./layer3-stream-completion.mjs";
import {
  parseJsonObject,
  runLayer4ParseValidateTwoPass,
  validateSubAnalysesShape,
} from "./layer4-parse-results.mjs";
import { runBehaviorAnalyzerFlow } from "./behavior-analyzer-flow.mjs";
import { runContentAnalyzerFlow } from "./content-analyzer-flow.mjs";
import { buildAnalysisDoc } from "./mongodb-domain-model.mjs";
import {
  enforceDailyLimit,
  enforcePlanQuota,
  getFreshCachedAnalysis,
  recordModuleMetric,
} from "./scalability-controls.mjs";

function requireProfilePayload(payload) {
  const p = payload?.profile || {};
  if (!p || typeof p !== "object") throw new Error("profile payload missing profile object");
  if (!p.headline || !p.about) throw new Error("profile payload missing headline/about");
  if (!Array.isArray(p.experienceItems) || p.experienceItems.length === 0) {
    throw new Error("profile payload missing experienceItems");
  }
}

function nowIso() {
  return new Date().toISOString();
}

async function upsertAnalysisStatus(db, colName, doc) {
  await db.collection(colName).updateOne(
    { analysisId: doc.analysisId },
    { $set: doc, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
}

/**
 * 12.3.1 Profile Analysis Flow
 * @param {object} params
 * @param {string} params.userId
 * @param {Record<string, unknown>} params.datasetPayload
 * @param {any} params.openaiClient
 * @param {string} [params.model]
 */
export async function runProfileAnalysisFlow({
  userId,
  datasetPayload,
  openaiClient,
  model = process.env.BREW_MVP_MODEL || "gpt-4o-mini",
  userPlan = "free",
  forceFresh = false,
}) {
  const tStart = Date.now();
  requireProfilePayload(datasetPayload);
  const db = await getMongoDb();
  const cols = mongodbCollections();
  const traceId = randomUUID();
  const analysisId = randomUUID();
  await enforceDailyLimit(db, cols.analysesProfile, userId);
  await enforcePlanQuota(db, cols.analysesProfile, userId, "profile", userPlan);
  if (!forceFresh) {
    const cached = await getFreshCachedAnalysis(db, cols.analysesProfile, userId, "profile");
    if (cached) {
      await recordModuleMetric(db, cols.moduleMetrics, {
        module: "module_1_profile",
        userId,
        traceId,
        success: true,
        latencyMs: Date.now() - tStart,
        details: { cacheHit: true },
      });
      return { analysisId: cached.analysisId, status: "cached", traceId, cacheHit: true };
    }
  }

  // 1-3: user submits + validate + store input
  const inputDoc = {
    userId,
    traceId,
    inputType: "profile_dataset",
    datasetPayload,
    createdAt: new Date(),
  };
  const inputRes = await db.collection(cols.profileInputs).insertOne(inputDoc);

  // 4: trigger orchestration (status row)
  await upsertAnalysisStatus(db, cols.analysesProfile, {
    analysisId,
    userId,
    traceId,
    profileInputId: inputRes.insertedId,
    status: "running",
    step: "module1_orchestration_started",
    updatedAt: new Date(),
  });

  try {
    // 5a-b: load data/context from Mongo payload
    const dataset = datasetPayload;
    const l1 = runLayer1Verbalize(dataset);

    // 5c-d: load prompt passport + construct prompts
    const l2a = runLayer2PassASubAnalyses(dataset, l1.verbalization);
    const l3a = await runLayer3StreamCompletion(openaiClient, l2a.messages, {
      model,
      quietStream: true,
      maxTokens: Number(process.env.BREW_MVP_MAX_TOKENS_PASS_A || 4500),
      layerTag: "profile_flow_passA",
    });
    const objA = parseJsonObject(l3a.rawText);
    const passAErrors = validateSubAnalysesShape(objA?.sub_analyses);
    if (passAErrors.length) {
      throw new Error(`Pass A validation failed: ${passAErrors.join("; ")}`);
    }

    const l2b = runLayer2PassBSynthesis(dataset, l1.verbalization, objA.sub_analyses);
    const l3b = await runLayer3StreamCompletion(openaiClient, l2b.messages, {
      model,
      quietStream: true,
      maxTokens: Number(process.env.BREW_MVP_MAX_TOKENS_PASS_B || 1800),
      layerTag: "profile_flow_passB",
    });

    // 5f: validate response JSON
    const l4 = runLayer4ParseValidateTwoPass(l3a.rawText, l3b.rawText);
    if (!l4.ok) {
      throw new Error(`Module1 output invalid: ${(l4.errors || []).join("; ")}`);
    }

    // 6: store results
    await upsertAnalysisStatus(db, cols.analysesProfile, {
      analysisId,
      userId,
      traceId,
      profileInputId: inputRes.insertedId,
      status: "completed",
      step: "module1_completed",
      prompt_passports: [l2a.prompt_passport, l2b.prompt_passport].filter(Boolean),
      results: l4.results,
      outputValidity: { ok: l4.ok, errors: l4.errors || [] },
      updatedAt: new Date(),
    });
    await insertUnifiedAnalysis(
      buildAnalysisDoc({
        userId,
        analysisId,
        type: "profile",
        results: l4.results,
        promptVersion: "v1.0",
        modelUsed: model,
        tokens: {
          input: (l3a?.usage?.promptTokens || 0) + (l3b?.usage?.promptTokens || 0),
          output: (l3a?.usage?.completionTokens || 0) + (l3b?.usage?.completionTokens || 0),
          estimatedCost: 0,
        },
        traceId,
      })
    );
    await recordModuleMetric(db, cols.moduleMetrics, {
      module: "module_1_profile",
      userId,
      traceId,
      success: true,
      latencyMs: Date.now() - tStart,
      details: { cacheHit: false },
    });

    // 7
    return { analysisId, status: "completed", traceId };
  } catch (e) {
    await upsertAnalysisStatus(db, cols.analysesProfile, {
      analysisId,
      userId,
      traceId,
      profileInputId: inputRes.insertedId,
      status: "failed",
      step: "module1_failed",
      error: e?.message || String(e),
      updatedAt: new Date(),
    });
    await recordModuleMetric(db, cols.moduleMetrics, {
      module: "module_1_profile",
      userId,
      traceId,
      success: false,
      latencyMs: Date.now() - tStart,
      details: { error: e?.message || String(e) },
    });
    return { analysisId, status: "failed", traceId, error: e?.message || String(e) };
  }
}

/**
 * Behavior Analysis Flow (scheduled)
 * @param {object} params
 * @param {string} params.userId
 * @param {number} [params.windowDays]
 */
export async function runBehaviorAnalysisFlow({
  userId,
  windowDays = 50,
  forceFresh = false,
}) {
  const tStart = Date.now();
  const db = await getMongoDb();
  const cols = mongodbCollections();
  const traceId = randomUUID();
  const analysisId = randomUUID();
  await enforceDailyLimit(db, cols.analysesBehavior, userId);
  if (!forceFresh) {
    const cached = await getFreshCachedAnalysis(db, cols.analysesBehavior, userId, "behavior");
    if (cached) {
      await recordModuleMetric(db, cols.moduleMetrics, {
        module: "module_2_behavior",
        userId,
        traceId,
        success: true,
        latencyMs: Date.now() - tStart,
        details: { cacheHit: true },
      });
      return { analysisId: cached.analysisId, status: "cached", traceId, cacheHit: true };
    }
  }

  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const logs = await db
    .collection(cols.behaviorLogs)
    .find({ userId, createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(5000)
    .toArray();

  const latestProfile = await db
    .collection(cols.analysesProfile)
    .find({ userId, status: "completed" })
    .sort({ updatedAt: -1 })
    .limit(1)
    .next();

  const dataset = {
    userContext: latestProfile?.results?.analysis_metadata?.user_context || {},
    behaviorSignals: {
      collectionMethod: "manual_logging",
      tosCompliant: true,
      actionLogs: logs.map((x) => ({
        actionType: x.actionType,
        targetClassification: x.targetClassification,
        timestamp: x.timestamp || x.createdAt?.toISOString?.() || nowIso(),
        personOrCompany: x.personOrCompany || null,
        commentLength: x.commentLength ?? null,
        notes: x.notes || null,
      })),
    },
  };

  const out = runBehaviorAnalyzerFlow(dataset);
  await db.collection(cols.analysesBehavior).insertOne({
    analysisId,
    userId,
    traceId,
    status: "completed",
    windowDays,
    logsCount: logs.length,
    results: out,
    prompt_passport: out.prompt_passport || null,
    createdAt: new Date(),
  });
  await insertUnifiedAnalysis(
    buildAnalysisDoc({
      userId,
      analysisId,
      type: "behavior",
      results: out,
      promptVersion: out?.prompt_passport?.prompt_version || "v1.0",
      modelUsed: "deterministic_flow",
      tokens: { input: 0, output: 0, estimatedCost: 0 },
      traceId,
    })
  );
  await recordModuleMetric(db, cols.moduleMetrics, {
    module: "module_2_behavior",
    userId,
    traceId,
    success: true,
    latencyMs: Date.now() - tStart,
    details: { windowDays, cacheHit: false },
  });

  return { analysisId, status: "completed", traceId };
}

/**
 * Content Analysis Flow (real-time)
 * @param {object} params
 * @param {string} params.userId
 * @param {{ postText: string, intendedFormat: string, intendedPublishAt: string, hookArchetype?: string }} params.draft
 */
export async function runContentAnalysisFlowRealtime({ userId, draft, userPlan = "free" }) {
  const tStart = Date.now();
  const db = await getMongoDb();
  const cols = mongodbCollections();
  const traceId = randomUUID();
  const analysisId = randomUUID();
  await enforceDailyLimit(db, cols.analysesContent, userId);
  await enforcePlanQuota(db, cols.analysesContent, userId, "content", userPlan);

  const latestProfile = await db
    .collection(cols.analysesProfile)
    .find({ userId, status: "completed" })
    .sort({ updatedAt: -1 })
    .limit(1)
    .next();
  const latestBehavior = await db
    .collection(cols.analysesBehavior)
    .find({ userId, status: "completed" })
    .sort({ createdAt: -1 })
    .limit(1)
    .next();
  const historicalPosts = await db
    .collection(cols.posts)
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(30)
    .toArray();

  const dataset = {
    userContext: latestProfile?.results?.analysis_metadata?.user_context || {},
    profile: {
      headline:
        latestProfile?.results?.sub_analyses?.headline?.headline_text || "",
      about: latestProfile?.results?.sub_analyses?.about?.about_text || "",
    },
    contentDraft: {
      postText: draft.postText,
      intendedFormat: draft.intendedFormat,
      intendedPublishAt: draft.intendedPublishAt,
      ...(draft.hookArchetype ? { hookArchetype: draft.hookArchetype } : {}),
    },
    historicalPosts: historicalPosts.map((p) => ({
      text: p.text || "",
      engagementRate: p.engagementRate ?? null,
      impressions: p.impressions ?? null,
      format: p.format || null,
    })),
  };

  const out = runContentAnalyzerFlow(
    dataset,
    latestProfile?.results || null,
    latestBehavior?.results || null
  );

  await db.collection(cols.analysesContent).insertOne({
    analysisId,
    userId,
    traceId,
    status: "completed",
    draft,
    profileAnalysisRef: latestProfile?.analysisId || null,
    behaviorAnalysisRef: latestBehavior?.analysisId || null,
    historicalPostsCount: historicalPosts.length,
    results: out,
    prompt_passport: out.prompt_passport || null,
    createdAt: new Date(),
  });
  await insertUnifiedAnalysis(
    buildAnalysisDoc({
      userId,
      analysisId,
      type: "content",
      results: out,
      promptVersion: out?.prompt_passport?.prompt_version || "v1.0",
      modelUsed: "deterministic_flow",
      tokens: { input: 0, output: 0, estimatedCost: 0 },
      traceId,
    })
  );
  await recordModuleMetric(db, cols.moduleMetrics, {
    module: "module_3_content",
    userId,
    traceId,
    success: true,
    latencyMs: Date.now() - tStart,
    details: { historicalPostsCount: historicalPosts.length },
  });

  return {
    analysisId,
    status: "completed",
    traceId,
    score: out?.composite_quality_score ?? null,
    decision: out?.decision_recommendation ?? null,
  };
}
