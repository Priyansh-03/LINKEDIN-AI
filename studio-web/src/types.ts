export type StudioUser = {
  id: string;
  displayName: string;
  createdAt: string;
};

export type StudioTrashedUser = {
  id: string;
  displayName: string;
  createdAt: string;
  deletedAt: string;
};

export type ExperienceRow = {
  title: string;
  company: string;
  duration: string;
  description: string;
};

export type ProfilePayload = Record<string, unknown>;

export type AnalyzeResponse = {
  ok: boolean;
  run: Record<string, unknown>;
  output: Record<string, unknown>;
};

export type StudioRunSummary = {
  runId: string;
  createdAt: string;
  ok: boolean;
  model?: string | null;
};

export type StudioRunDetail = StudioRunSummary & {
  inputSnapshot?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
};

/** Response from POST .../refine-target-audience */
export type RefineAudienceResponse = {
  target_audience: string;
  segments: string[];
  rationale: string;
  usedLlm?: boolean;
};

/** Response from POST .../profile/parse-linkedin-pdf */
export type LinkedinPdfParseResponse = {
  patch: Record<string, unknown>;
  usedLlm: boolean;
  charsExtracted: number;
};
