import { MongoClient } from "mongodb";
import { buildPromptTemplateDoc } from "./mongodb-domain-model.mjs";

let _client = null;
let _db = null;

function required(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return String(v).trim();
}

export function isMongoPersistenceEnabled() {
  return process.env.BREW_MVP_PERSIST_MONGODB === "1";
}

async function getDb() {
  if (_db) return _db;
  const uri = required("MONGODB_URI");
  const dbName = process.env.MONGODB_DB_NAME || "brew_mvp";
  _client = new MongoClient(uri);
  await _client.connect();
  _db = _client.db(dbName);
  return _db;
}

function collectionNames() {
  return {
    users: process.env.MONGODB_COLLECTION_USERS || "users",
    profiles: process.env.MONGODB_COLLECTION_PROFILES || "profiles",
    behaviors: process.env.MONGODB_COLLECTION_BEHAVIORS || "behavior_logs",
    posts: process.env.MONGODB_COLLECTION_POSTS || "posts",
    analysesUnified: process.env.MONGODB_COLLECTION_ANALYSES_UNIFIED || "analyses",
    reportsUnified: process.env.MONGODB_COLLECTION_REPORTS_UNIFIED || "reports",
    peers: process.env.MONGODB_COLLECTION_PEERS || "peers",
    prompts: process.env.MONGODB_COLLECTION_PROMPTS || "prompts",
    datasets: process.env.MONGODB_COLLECTION_DATASETS || "datasets",
    analyses: process.env.MONGODB_COLLECTION_ANALYSES || "analyses",
    reports: process.env.MONGODB_COLLECTION_REPORTS || "reports",
    promptRegistry: process.env.MONGODB_COLLECTION_PROMPT_REGISTRY || "prompt_registry",
    profileInputs: process.env.MONGODB_COLLECTION_PROFILE_INPUTS || "users_profile_inputs",
    behaviorLogs: process.env.MONGODB_COLLECTION_BEHAVIOR_LOGS || "behavior_logs",
    analysesProfile: process.env.MONGODB_COLLECTION_ANALYSES_PROFILE || "analyses_profile",
    analysesBehavior: process.env.MONGODB_COLLECTION_ANALYSES_BEHAVIOR || "analyses_behavior",
    analysesContent: process.env.MONGODB_COLLECTION_ANALYSES_CONTENT || "analyses_content",
    moduleMetrics: process.env.MONGODB_COLLECTION_MODULE_METRICS || "module_metrics",
  };
}

export { collectionNames as mongodbCollections };

export async function getMongoDb() {
  return await getDb();
}

function extractPromptPassports(envelope, slimOutput) {
  const seen = new Set();
  const out = [];
  const add = (p) => {
    if (!p || typeof p !== "object") return;
    if (!p.prompt_path || !p.prompt_hash) return;
    const key = `${p.layer}|${p.module}|${p.prompt_path}|${p.prompt_hash}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(p);
  };
  add(slimOutput?.behavior_analyzer?.prompt_passport);
  add(slimOutput?.content_analyzer?.prompt_passport);
  add(slimOutput?.comparative_intelligence?.prompt_passport);
  add(slimOutput?.reporting_recommendations?.prompt_passport);
  add(envelope?.pipeline?.layerOutputs?.L2_prompt_assembly?.passA?.prompt_passport);
  add(envelope?.pipeline?.layerOutputs?.L2_prompt_assembly?.passB?.prompt_passport);
  add(envelope?.pipeline?.layerOutputs?.L2_prompt_assembly?.single?.prompt_passport);
  return out;
}

/**
 * Persist one run envelope + slim output for module-level reporting.
 * Safe no-op when disabled.
 * @param {object} params
 * @param {string} params.datasetPath
 * @param {object} params.envelope
 * @param {object} params.slimOutput
 */
export async function persistRunToMongo({ datasetPath, envelope, slimOutput }) {
  if (!isMongoPersistenceEnabled()) return { persisted: false, reason: "disabled" };
  const db = await getDb();
  const col = collectionNames();
  const now = new Date();

  const datasetDoc = {
    datasetPath,
    promptVersion: envelope?.run?.promptVersion || null,
    model: envelope?.run?.model || null,
    generatedAt: envelope?.run?.generatedAt || now.toISOString(),
    updatedAt: now,
  };
  await db.collection(col.datasets).updateOne(
    { datasetPath },
    { $set: datasetDoc, $setOnInsert: { createdAt: now } },
    { upsert: true }
  );

  const analysisDoc = {
    datasetPath,
    traceId: envelope?.run?.traceId || null,
    run: envelope?.run || {},
    outputValidity: envelope?.outputValidity || {},
    buildInfo: envelope?.buildInfo || {},
    pipeline: envelope?.pipeline || {},
    results: envelope?.results || null,
    slim: slimOutput || null,
    createdAt: now,
  };
  const analysisRes = await db.collection(col.analyses).insertOne(analysisDoc);

  const reportDoc = {
    datasetPath,
    traceId: envelope?.run?.traceId || null,
    analysisId: analysisRes.insertedId,
    profile: slimOutput?.composite_classification || null,
    behavior: slimOutput?.behavior_analyzer || null,
    content: slimOutput?.content_analyzer || null,
    comparative: slimOutput?.comparative_intelligence || null,
    reporting: slimOutput?.reporting_recommendations || null,
    createdAt: now,
  };
  await db.collection(col.reports).insertOne(reportDoc);

  const passports = extractPromptPassports(envelope, slimOutput);
  if (passports.length) {
    await Promise.all(
      passports.map((p) =>
        db.collection(col.promptRegistry).updateOne(
          { prompt_path: p.prompt_path, prompt_hash: p.prompt_hash },
          {
            $set: {
              layer: p.layer,
              module: p.module,
              prompt_version: p.prompt_version || "v1.0",
              updatedAt: now,
            },
            $setOnInsert: { createdAt: now },
          },
          { upsert: true }
        )
      )
    );
  }

  return { persisted: true, analysisId: String(analysisRes.insertedId), promptsRegistered: passports.length };
}

/**
 * Unified analyses writer matching Mongo "analyses" model.
 * @param {object} doc
 */
export async function insertUnifiedAnalysis(doc) {
  if (!isMongoPersistenceEnabled()) return { inserted: false, reason: "disabled" };
  const db = await getDb();
  const col = collectionNames();
  const res = await db.collection(col.analysesUnified).insertOne({ ...doc, createdAt: new Date() });
  return { inserted: true, id: String(res.insertedId) };
}

/**
 * Unified reports writer matching Mongo "reports" model.
 * @param {object} doc
 */
export async function insertUnifiedReport(doc) {
  if (!isMongoPersistenceEnabled()) return { inserted: false, reason: "disabled" };
  const db = await getDb();
  const col = collectionNames();
  const res = await db.collection(col.reportsUnified).insertOne({ ...doc, generatedAt: new Date() });
  return { inserted: true, id: String(res.insertedId) };
}

/**
 * Upsert prompt template (type+version) in prompts collection.
 */
export async function upsertPromptTemplate({
  promptType,
  version,
  template,
  variables = [],
  metadata = {},
}) {
  if (!isMongoPersistenceEnabled()) return { upserted: false, reason: "disabled" };
  const db = await getDb();
  const col = collectionNames();
  const doc = buildPromptTemplateDoc({ promptType, version, template, variables, metadata });
  await db.collection(col.prompts).updateOne(
    { promptType, version },
    { $set: { ...doc, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );
  return { upserted: true };
}
