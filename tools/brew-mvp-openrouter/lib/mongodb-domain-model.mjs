/**
 * MongoDB domain model helpers (Firestore-inspired structure, Mongo-native).
 * We store user-scoped documents with `userId` instead of nested subcollections.
 */

function now() {
  return new Date();
}

export function buildUserDoc({
  userId,
  email = "",
  displayName = "",
  context = {},
  subscription = {},
  settings = {},
  stats = {},
}) {
  return {
    userId,
    email,
    displayName,
    createdAt: now(),
    context: {
      niche: context.niche || "",
      careerGoal: context.careerGoal || "growth",
      geography: context.geography || "",
      yearsExperience: Number(context.yearsExperience || 0),
      targetAudience: context.targetAudience || "",
      targetCompanies: Array.isArray(context.targetCompanies) ? context.targetCompanies : [],
      targetRoles: Array.isArray(context.targetRoles) ? context.targetRoles : [],
      opsecLevel: context.opsecLevel || "low",
    },
    subscription: {
      tier: subscription.tier || "free",
      startedAt: subscription.startedAt || now(),
      renewsAt: subscription.renewsAt || null,
    },
    settings: {
      notificationsEnabled: settings.notificationsEnabled ?? true,
      timezone: settings.timezone || "UTC",
      dailyReportEnabled: settings.dailyReportEnabled ?? true,
      weeklyReportEnabled: settings.weeklyReportEnabled ?? true,
    },
    stats: {
      profileAnalysesRun: Number(stats.profileAnalysesRun || 0),
      behaviorEntriesLogged: Number(stats.behaviorEntriesLogged || 0),
      contentAnalysesRun: Number(stats.contentAnalysesRun || 0),
      lastActiveAt: stats.lastActiveAt || now(),
    },
  };
}

export function buildProfileDataDoc({ userId, profile, version = 1 }) {
  return {
    userId,
    headline: String(profile?.headline || ""),
    about: String(profile?.about || ""),
    experiences: Array.isArray(profile?.experiences) ? profile.experiences : [],
    skills: Array.isArray(profile?.skills) ? profile.skills : [],
    education: Array.isArray(profile?.education) ? profile.education : [],
    certifications: Array.isArray(profile?.certifications) ? profile.certifications : [],
    recommendations: Array.isArray(profile?.recommendations) ? profile.recommendations : [],
    featured: Array.isArray(profile?.featured) ? profile.featured : [],
    lastUpdatedAt: now(),
    version,
  };
}

export function buildAnalysisDoc({
  userId,
  analysisId,
  type,
  results,
  promptVersion,
  modelUsed,
  tokens = {},
  traceId,
}) {
  return {
    userId,
    analysisId,
    type, // profile|behavior|content|comparative|master_report
    traceId: traceId || null,
    createdAt: now(),
    results: results || {},
    promptVersion: promptVersion || "v1.0",
    modelUsed: modelUsed || "",
    tokens: {
      input: Number(tokens.input || 0),
      output: Number(tokens.output || 0),
      estimatedCost: Number(tokens.estimatedCost || 0),
    },
  };
}

export function buildReportDoc({
  userId,
  reportId,
  type,
  period,
  content,
  pdfUrl = null,
  readByUser = false,
}) {
  return {
    userId,
    reportId,
    type, // daily|weekly|monthly|quarterly
    generatedAt: now(),
    period: {
      start: period?.start || now(),
      end: period?.end || now(),
    },
    content: content || {},
    pdfUrl,
    readByUser,
  };
}

export function buildPeerDoc({ userId, peerId, publicData, category = "peer_level", notes = "" }) {
  return {
    userId,
    peerId,
    addedAt: now(),
    publicData: publicData || {},
    category,
    notes,
  };
}

export function buildPromptTemplateDoc({
  promptType,
  version,
  template,
  variables = [],
  metadata = {},
}) {
  return {
    promptType,
    version,
    template,
    variables,
    metadata: {
      createdAt: metadata.createdAt || now(),
      createdBy: metadata.createdBy || "system",
      description: metadata.description || "",
      isActive: metadata.isActive ?? true,
      avgInputTokens: metadata.avgInputTokens ?? null,
      avgOutputTokens: metadata.avgOutputTokens ?? null,
      avgUserSatisfaction: metadata.avgUserSatisfaction ?? null,
    },
  };
}
