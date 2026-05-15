import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { AnalysisSplitView, InputSnapshotView } from "./analysisUi";
import { getJSON, postJSON, putJSON, deleteJSON, postLinkedinProfilePdf } from "./api";
import {
  defaultScoringTuningState,
  loadScoringTuningState,
  PostScoringTuningPanel,
  ProfileScoringTuningPanel,
  saveScoringTuningState,
} from "./scoringTuningPanels";
import type { AnalyzeResponse, ExperienceRow, ProfilePayload, RefineAudienceResponse, StudioRunDetail, StudioRunSummary, StudioTrashedUser, StudioUser } from "./types";

type Tab =
  | "profile"
  | "draft"
  | "results";

const METRIC_NUMBER_KEYS = new Set([
  "connections",
  "followers",
  "following",
  "profileViewsLast7d",
  "profileViewsLast90d",
  "searchAppearancesLast7d",
  "postImpressionsLast7d",
  "postImpressionsLast365d",
  "chartPctPostImp",
  "chartPctFollow",
  "chartPctPv",
  "chartPctSearch",
]);

const CHART_WINDOW_OPTIONS: ReadonlyArray<{ value: string; label: string; days: number }> = [
  { value: "7d", label: "7 days", days: 7 },
  { value: "14d", label: "14 days", days: 14 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "60d", label: "2 months", days: 60 },
  { value: "90d", label: "90 days", days: 90 },
  { value: "180d", label: "6 months", days: 180 },
  { value: "365d", label: "1 year", days: 365 },
];

const CHART_MAX_POLYLINE_POINTS = 96;

/** Resolve window token to day count (pure). */
function windowTokenToDays(token: string, fallbackDays: number): number {
  const t = String(token || "").trim().toLowerCase();
  const hit = CHART_WINDOW_OPTIONS.find((o) => o.value === t);
  if (hit) return hit.days;
  const n = Number(t.replace(/d$/i, ""));
  if (Number.isFinite(n) && n >= 2 && n <= 3660) return Math.floor(n);
  return fallbackDays;
}

/** Number of polyline samples: one per day up to CHART_MAX_POLYLINE_POINTS (pure). */
function stepsFromWindowDays(days: number): number {
  const d = Math.max(2, Math.floor(days));
  return Math.min(d, CHART_MAX_POLYLINE_POINTS);
}

/**
 * Signed % change for the whole window: +p = grew p% from start→end, −p = fell p% (pure).
 * Uses numeric chart Δ % and direction; if Δ % is empty, charts use a default ramp (see syntheticSeriesPure).
 */
function signedPctFromInputs(pctStr: string, dir: string): number | null {
  const raw = String(pctStr ?? "").trim().replace(/,/g, "");
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) {
    const d = String(dir || "up").toLowerCase();
    return d === "down" ? -Math.abs(n) : Math.abs(n);
  }
  return null;
}

/**
 * Linear series over `days` calendar span, sampled in `stepsFromWindowDays(days)` equal time steps,
 * ending at `endVal`. start = end / (1 + signedPct/100) when signedPct set (pure).
 */
function syntheticSeriesPure(endVal: number, days: number, signedPct: number | null): number[] {
  const steps = stepsFromWindowDays(days);
  const end = Number(endVal);
  if (!Number.isFinite(end) || end <= 0) return Array.from({ length: steps }, () => 0);
  let start = end * 0.94;
  if (signedPct != null && Number.isFinite(signedPct) && signedPct > -99.999 && Math.abs(signedPct) < 1e6) {
    const r = 1 + signedPct / 100;
    if (Math.abs(r) > 1e-12) start = end / r;
  }
  if (!Number.isFinite(start) || start < 0) start = end * 0.9;
  start = Math.min(Math.max(0, start), end * 10);
  return Array.from({ length: steps }, (_, i) => {
    const t = steps === 1 ? 1 : i / (steps - 1);
    return start + (end - start) * t;
  });
}

function polylineFromSeries(values: number[], viewW = 100, viewH = 44): string {
  if (values.length === 0) return "";
  const maxV = Math.max(...values, 1e-9);
  const minV = Math.min(...values, 0);
  const span = Math.max(maxV - minV, 1e-9);
  const step = values.length > 1 ? viewW / (values.length - 1) : 0;
  return values
    .map((v, idx) => {
      const x = values.length === 1 ? viewW / 2 : idx * step;
      const y = viewH - ((v - minV) / span) * viewH;
      return `${x},${y}`;
    })
    .join(" ");
}

function xLabelsSparse(days: number, steps: number): string[] {
  const out: string[] = Array.from({ length: steps }, () => "");
  if (steps === 0) return out;
  out[0] = "0";
  out[steps - 1] = `${days}d`;
  if (steps > 2) {
    const mid = Math.floor((steps - 1) / 2);
    if (mid > 0 && mid < steps - 1) out[mid] = `${Math.round(days / 2)}d`;
  }
  return out;
}

const LINKEDIN_LIMITS = {
  headline: 220,
  about: 3000,
  experienceDescriptionMax: 2000,
  experienceDescriptionRecommendedMin: 1000,
  skillPerItem: 80,
  postDraft: 3000,
} as const;
const ABOUT_PREVIEW_CHAR_LIMIT = 209;
/** Visible snippet per role before expanding the full description editor */
const EXPERIENCE_DESCRIPTION_PREVIEW_CHAR_LIMIT = 193;

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

function isEmptyProfileScalar(v: unknown): boolean {
  return v == null || String(v).trim() === "";
}

function experienceItemsAllEmpty(items: unknown): boolean {
  if (!Array.isArray(items) || items.length === 0) return true;
  return items.every((raw) => {
    const o = asRecord(raw) ?? {};
    return !String(o.title ?? "").trim() && !String(o.company ?? "").trim();
  });
}

function mergePdfProfileIntoPayload(payload: ProfilePayload, patch: Record<string, unknown>): ProfilePayload {
  const profPatch = asRecord(patch.profile);
  if (!profPatch) return payload;
  const cur = asRecord(payload.profile) ?? {};
  const next: Record<string, unknown> = { ...cur };

  const limits: Record<string, number> = {
    name: 200,
    headline: LINKEDIN_LIMITS.headline,
    about: LINKEDIN_LIMITS.about,
    location: 200,
    clientLinkedinUrl: 500,
    yearsExperienceHint: 120,
  };

  for (const key of ["name", "headline", "about", "location", "clientLinkedinUrl", "yearsExperienceHint"] as const) {
    const incoming = profPatch[key];
    if (typeof incoming !== "string" || !incoming.trim()) continue;
    if (!isEmptyProfileScalar(cur[key])) continue;
    const lim = limits[key] ?? 500;
    next[key] = incoming.trim().slice(0, lim);
  }

  const incSkills = profPatch.skills;
  if (Array.isArray(incSkills) && incSkills.length) {
    const existing = Array.isArray(cur.skills)
      ? cur.skills.map(String).filter(Boolean)
      : typeof cur.skills === "string" && String(cur.skills).trim()
        ? String(cur.skills)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
        : [];
    if (existing.length === 0) {
      next.skills = incSkills
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, 60);
    }
  }

  const incExp = profPatch.experienceItems;
  if (Array.isArray(incExp) && incExp.length && experienceItemsAllEmpty(cur.experienceItems)) {
    const mapped = incExp
      .map((raw) => {
        const o = asRecord(raw) ?? {};
        return {
          title: String(o.title ?? "").trim(),
          company: String(o.company ?? "").trim(),
          duration: String(o.duration ?? "").trim(),
          description: String(o.description ?? "").trim().slice(0, LINKEDIN_LIMITS.experienceDescriptionMax),
        };
      })
      .filter((r) => r.title || r.company);
    if (mapped.length) next.experienceItems = mapped;
  }

  return { ...payload, profile: next };
}

function metricStr(ms: Record<string, unknown>, key: string): string {
  const v = ms[key];
  if (v == null || v === "") return "";
  return String(v);
}

function buildAboutPreview(text: string): { preview: string; truncated: boolean } {
  const src = String(text || "").replace(/\s+/g, " ").trim();
  if (!src) return { preview: "", truncated: false };
  if (src.length <= ABOUT_PREVIEW_CHAR_LIMIT) {
    return { preview: src, truncated: false };
  }
  return { preview: src.slice(0, ABOUT_PREVIEW_CHAR_LIMIT), truncated: true };
}

function buildExpDescriptionPreview(text: string): { preview: string; truncated: boolean } {
  const src = String(text || "").replace(/\s+/g, " ").trim();
  if (!src) return { preview: "", truncated: false };
  if (src.length <= EXPERIENCE_DESCRIPTION_PREVIEW_CHAR_LIMIT) {
    return { preview: src, truncated: false };
  }
  return { preview: src.slice(0, EXPERIENCE_DESCRIPTION_PREVIEW_CHAR_LIMIT), truncated: true };
}

function inferCurrentAudience(profile: Record<string, unknown>): string {
  const text = `${String(profile.headline ?? "")} ${String(profile.about ?? "")} ${String(profile.skills ?? "")}`.toLowerCase();
  const has = (arr: string[]) => arr.some((k) => text.includes(k));
  if (has(["hr", "recruit", "talent acquisition", "hiring manager", "resume"])) return "HR / Recruiters";
  if (has(["founder", "startup", "cxo", "gtm", "growth leader"])) return "Founders / Leaders";
  if (has(["machine learning", "ai", "llm", "nlp", "python", "deep learning"])) return "AI/ML Engineers";
  if (has(["product manager", "roadmap", "user research", "pm"])) return "Product Managers";
  if (has(["sales", "pipeline", "lead gen", "account executive", "sdr"])) return "Sales Professionals";
  return "General professional audience";
}

export default function App() {
  const [users, setUsers] = useState<StudioUser[]>([]);
  const [trashedUsers, setTrashedUsers] = useState<StudioTrashedUser[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [payload, setPayload] = useState<ProfilePayload | null>(null);
  const [tab, setTab] = useState<Tab>("profile");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [lastOut, setLastOut] = useState<AnalyzeResponse | null>(null);
  const [skillsText, setSkillsText] = useState("");
  const [skillDraft, setSkillDraft] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftFormat, setDraftFormat] = useState("text");
  const [draftWhen, setDraftWhen] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [pastRuns, setPastRuns] = useState<StudioRunSummary[]>([]);
  const [runDetail, setRunDetail] = useState<StudioRunDetail | null>(null);
  const [runsBusy, setRunsBusy] = useState(false);
  const [runDetailBusy, setRunDetailBusy] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  /** Per experience row: full description editor vs 193-char preview */
  const [expDescExpanded, setExpDescExpanded] = useState<Record<number, boolean>>({});
  const [editingMetricKey, setEditingMetricKey] = useState<string | null>(null);
  const [audienceRefineBusy, setAudienceRefineBusy] = useState(false);
  const [audienceRefineMeta, setAudienceRefineMeta] = useState<{ segments: string[]; rationale: string; usedLlm: boolean } | null>(null);
  const [editingConnectionsLine, setEditingConnectionsLine] = useState(false);
  /** Home = Kanban only; account = profile / draft / results workspace */
  const [workspaceView, setWorkspaceView] = useState<"board" | "account">("board");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfInfo, setPdfInfo] = useState<string | null>(null);
  const [scoringTuning, setScoringTuning] = useState(loadScoringTuningState);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const aboutTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const focusField = (id: string) => {
    const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!el) return;
    el.focus();
    if (typeof el.setSelectionRange === "function") {
      const len = el.value?.length ?? 0;
      el.setSelectionRange(len, len);
    }
  };

  const refreshUsers = useCallback(async () => {
    const list = await getJSON<StudioUser[]>("/users");
    setUsers(list);
    try {
      const trash = await getJSON<StudioTrashedUser[]>("/users/trash");
      setTrashedUsers(trash);
    } catch {
      setTrashedUsers([]);
    }
  }, []);

  useEffect(() => {
    refreshUsers().catch((e: unknown) => setErr(e instanceof Error ? e.message : String(e)));
  }, [refreshUsers]);

  useEffect(() => {
    document.title = "LinkedIn AI — Profile Studio";
  }, []);

  useEffect(() => {
    saveScoringTuningState(scoringTuning);
  }, [scoringTuning]);

  useEffect(() => {
    setPdfInfo(null);
  }, [userId]);

  const loadProfile = useCallback(async (id: string): Promise<boolean> => {
    setBusy(true);
    setErr(null);
    try {
      const res = await getJSON<{ userId: string; payload: ProfilePayload }>(`/users/${id}/profile`);
      setPayload(res.payload);
      const pr = asRecord(res.payload.profile);
      const sk = pr?.skills;
      setSkillsText(Array.isArray(sk) ? sk.map(String).join(", ") : "");
      setUserId(id);
      setLastOut(null);
      setRunDetail(null);
      setExpDescExpanded({});
      setAudienceRefineMeta(null);
      return true;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!draftWhen) {
      const d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      setDraftWhen(d.toISOString().slice(0, 16));
    }
  }, [draftWhen]);

  useEffect(() => {
    if (tab !== "results" || !userId) return;
    let cancelled = false;
    setRunsBusy(true);
    getJSON<StudioRunSummary[]>(`/users/${userId}/runs`)
      .then((r) => {
        if (!cancelled) setPastRuns(r);
      })
      .catch(() => {
        if (!cancelled) setPastRuns([]);
      })
      .finally(() => {
        if (!cancelled) setRunsBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, userId, lastOut]);

  useEffect(() => {
    setRunDetail(null);
  }, [lastOut]);

  const visibleTabs: ReadonlyArray<readonly [Tab, string]> = [
    ["profile", "Profile"],
    ["draft", "Draft post"],
    ["results", "Results"],
  ];

  const profile = useMemo(() => asRecord(payload?.profile) ?? {}, [payload]);
  const userContext = useMemo(() => asRecord(payload?.userContext) ?? {}, [payload]);
  const expectedAudience = String(userContext.target_audience ?? "").trim();
  const inferredAudience = useMemo(() => inferCurrentAudience(profile), [profile]);

  const setProfileField = (key: string, value: string) => {
    setPayload((p) => {
      if (!p) return p;
      return { ...p, profile: { ...asRecord(p.profile), [key]: value } };
    });
  };

  const setContextField = (key: string, value: string) => {
    setPayload((p) => {
      if (!p) return p;
      return { ...p, userContext: { ...asRecord(p.userContext), [key]: value } };
    });
  };


  const handleRefineTargetAudience = async () => {
    if (!userId) return;
    const rough = expectedAudience.trim();
    if (!rough) {
      setErr("Type a rough target audience first (e.g. AIML engineers, people in AI).");
      return;
    }
    setAudienceRefineBusy(true);
    setErr(null);
    try {
      const res = await postJSON<RefineAudienceResponse>(`/users/${userId}/refine-target-audience`, { roughText: rough });
      setContextField("target_audience", res.target_audience);
      setAudienceRefineMeta({ segments: res.segments ?? [], rationale: res.rationale ?? "", usedLlm: !!res.usedLlm });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setAudienceRefineBusy(false);
    }
  };

  const metricsSummary = useMemo(() => asRecord(payload?.metricsSummary) ?? {}, [payload]);
  const aboutText = String(profile.about ?? "");
  const aboutPreviewState = useMemo(() => buildAboutPreview(aboutText), [aboutText]);
  useEffect(() => {
    if (!aboutExpanded) return;
    const el = aboutTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [aboutExpanded, aboutText]);
  const followersCount = metricStr(metricsSummary, "followers") || "0";
  const connectionsCount = metricStr(metricsSummary, "connections") || "0";
  const analyticsCards = useMemo(
    () =>
      [
        { label: "Profile views", key: "profileViewsLast90d", sub: "Past 90 days", fallbackKey: "profileViewsLast7d" as const },
        { label: "Post impressions", key: "postImpressionsLast7d", sub: "Past 7 days" },
        { label: "Search appearances", key: "searchAppearancesLast7d", sub: "Previous week" },
        { label: "Followers", key: "followers", sub: "Past 7 days" },
        { label: "Connections", key: "connections", sub: "Network size" },
      ] as const,
    []
  );

  const analyticsTimeBlocks = useMemo(() => {
    type Def = {
      id: string;
      title: string;
      valueKey: string;
      winKey: string;
      dirKey: string;
      pctKey: string;
      defaultWin: string;
      profileViewsDual?: true;
    };

    const defs: Def[] = [
      {
        id: "postImp",
        title: "Post impressions",
        valueKey: "postImpressionsLast7d",
        winKey: "chartWinPostImp",
        dirKey: "chartDirPostImp",
        pctKey: "chartPctPostImp",
        defaultWin: "7d",
      },
      {
        id: "followers",
        title: "Followers",
        valueKey: "followers",
        winKey: "chartWinFollow",
        dirKey: "chartDirFollow",
        pctKey: "chartPctFollow",
        defaultWin: "7d",
      },
      {
        id: "profileViews",
        title: "Profile views",
        valueKey: "profileViewsLast90d",
        winKey: "chartWinPv",
        dirKey: "chartDirPv",
        pctKey: "chartPctPv",
        defaultWin: "90d",
        profileViewsDual: true,
      },
      {
        id: "search",
        title: "Search appearances",
        valueKey: "searchAppearancesLast7d",
        winKey: "chartWinSearch",
        dirKey: "chartDirSearch",
        pctKey: "chartPctSearch",
        defaultWin: "7d",
      },
    ];

    return defs.map((def) => {
      const winTok = metricStr(metricsSummary, def.winKey) || def.defaultWin;
      const fbDays = CHART_WINDOW_OPTIONS.find((o) => o.value === def.defaultWin)?.days ?? 7;
      const days = windowTokenToDays(winTok, fbDays);
      const winLabel = CHART_WINDOW_OPTIONS.find((o) => o.value === winTok)?.label ?? `${days}-day window`;
      const dirRaw = (metricStr(metricsSummary, def.dirKey) || "up").toLowerCase();
      const dir: "up" | "down" = dirRaw === "down" ? "down" : "up";
      const signed = signedPctFromInputs(metricStr(metricsSummary, def.pctKey), dir);

      let endVal = 0;
      let display = "—";
      if (def.profileViewsDual) {
        const pv90 = Number(metricsSummary.profileViewsLast90d);
        const pv7 = Number(metricsSummary.profileViewsLast7d);
        endVal = Number.isFinite(pv90) && pv90 > 0 ? pv90 : Number.isFinite(pv7) ? pv7 : 0;
        display =
          Number.isFinite(pv90) && pv90 > 0
            ? String(Math.round(pv90))
            : Number.isFinite(pv7) && pv7 > 0
              ? `${Math.round(pv7)} (7d — set 90d)`
              : "—";
      } else {
        endVal = Number(metricsSummary[def.valueKey]);
        display = Number.isFinite(endVal) && endVal > 0 ? String(Math.round(endVal)) : "—";
      }

      const vals = syntheticSeriesPure(endVal, days, signed);
      const steps = vals.length;
      const xLabels = xLabelsSparse(days, steps);
      const period = `${winLabel} · end = current total · start = end ÷ (1 + Δ%)`;

      return {
        ...def,
        display,
        points: polylineFromSeries(vals),
        xLabels,
        period,
        days,
        dir,
        winLabel,
        winTok,
        signedApplied: signed,
      };
    });
  }, [metricsSummary]);
  const skillItems = useMemo(
    () =>
      skillsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [skillsText]
  );
  const longSkills = useMemo(
    () => skillItems.filter((s) => s.length > LINKEDIN_LIMITS.skillPerItem),
    [skillItems]
  );
  const setSkillsFromItems = (items: string[]) => {
    setSkillsText(items.join(", "));
  };
  const addSkill = () => {
    const next = skillDraft.trim();
    if (!next) return;
    if (skillItems.some((s) => s.toLowerCase() === next.toLowerCase())) {
      setSkillDraft("");
      return;
    }
    setSkillsFromItems([...skillItems, next]);
    setSkillDraft("");
  };
  const removeSkill = (idx: number) => {
    setSkillsFromItems(skillItems.filter((_, i) => i !== idx));
  };

  const setMetricField = (key: string, raw: string) => {
    setPayload((p) => {
      if (!p) return p;
      const cur = { ...asRecord(p.metricsSummary) };
      const t = raw.trim();
      if (t === "") {
        delete cur[key];
      } else if (METRIC_NUMBER_KEYS.has(key)) {
        const n = Number(t);
        if (Number.isFinite(n)) cur[key] = n;
      } else {
        cur[key] = t;
      }
      const nextMs = Object.keys(cur).length ? cur : null;
      return { ...p, metricsSummary: nextMs };
    });
  };

  const experienceRows: ExperienceRow[] = useMemo(() => {
    const raw = profile.experienceItems;
    if (!Array.isArray(raw) || raw.length === 0) {
      return [{ title: "", company: "", duration: "", description: "" }];
    }
    return raw.map((r) => {
      const o = asRecord(r) ?? {};
      return {
        title: String(o.title ?? ""),
        company: String(o.company ?? ""),
        duration: String(o.duration ?? ""),
        description: String(o.description ?? ""),
      };
    });
  }, [profile.experienceItems]);

  const expDescSizesKey = useMemo(() => experienceRows.map((r) => r.description).join("\x1e"), [experienceRows]);

  useEffect(() => {
    for (const idxStr of Object.keys(expDescExpanded)) {
      const idx = Number(idxStr);
      if (!Number.isFinite(idx) || !expDescExpanded[idx]) continue;
      const el = document.getElementById(`exp-description-${idx}`) as HTMLTextAreaElement | null;
      if (!el) continue;
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [expDescExpanded, expDescSizesKey]);

  const setExpRow = (idx: number, field: keyof ExperienceRow, value: string) => {
    setPayload((p) => {
      if (!p) return p;
      const rows = [...experienceRows];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...p, profile: { ...asRecord(p.profile), experienceItems: rows } };
    });
  };

  const addExpRow = () => {
    setPayload((p) => {
      if (!p) return p;
      const rows = [...experienceRows, { title: "", company: "", duration: "", description: "" }];
      return { ...p, profile: { ...asRecord(p.profile), experienceItems: rows } };
    });
  };

  const removeExpRow = (idx: number) => {
    if (experienceRows.length <= 1) return;
    setExpDescExpanded({});
    setPayload((p) => {
      if (!p) return p;
      const rows = experienceRows.filter((_, i) => i !== idx);
      return { ...p, profile: { ...asRecord(p.profile), experienceItems: rows } };
    });
  };

  const eduRows = useMemo(() => {
    const raw = profile.education;
    if (!Array.isArray(raw) || raw.length === 0) return [{ school: "", degree: "", year: "" }];
    return raw.map(r => ({ school: String(r?.school ?? ""), degree: String(r?.degree ?? ""), year: String(r?.year ?? "") }));
  }, [profile.education]);

  const setEduRow = (idx: number, field: "school" | "degree" | "year", value: string) => {
    setPayload(p => {
      if (!p) return p;
      const rows = [...eduRows];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...p, profile: { ...asRecord(p.profile), education: rows } };
    });
  };

  const addEduRow = () => {
    setPayload(p => {
      if (!p) return p;
      return { ...p, profile: { ...asRecord(p.profile), education: [...eduRows, { school: "", degree: "", year: "" }] } };
    });
  };

  const removeEduRow = (idx: number) => {
    if (eduRows.length <= 1) return;
    setPayload(p => {
      if (!p) return p;
      return { ...p, profile: { ...asRecord(p.profile), education: eduRows.filter((_, i) => i !== idx) } };
    });
  };

  const featuredRows = useMemo(() => {
    const raw = profile.featured;
    if (!Array.isArray(raw) || raw.length === 0) return [{ text: "", format: "text" }];
    return raw.map(r => ({ text: String(r?.text ?? r?.title ?? ""), format: String(r?.format ?? r?.url ?? "text") }));
  }, [profile.featured]);

  const setFeaturedRow = (idx: number, field: "text" | "format", value: string) => {
    setPayload(p => {
      if (!p) return p;
      const rows = [...featuredRows];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...p, profile: { ...asRecord(p.profile), featured: rows } };
    });
  };

  const addFeaturedRow = () => {
    setPayload(p => {
      if (!p) return p;
      return { ...p, profile: { ...asRecord(p.profile), featured: [...featuredRows, { text: "", format: "text" }] } };
    });
  };

  const removeFeaturedRow = (idx: number) => {
    if (featuredRows.length <= 1) return;
    setPayload(p => {
      if (!p) return p;
      return { ...p, profile: { ...asRecord(p.profile), featured: featuredRows.filter((_, i) => i !== idx) } };
    });
  };

  const recRows = useMemo(() => {
    const raw = profile.recommendations;
    if (!Array.isArray(raw) || raw.length === 0) return [{ name: "", role: "", message: "" }];
    return raw.map(r => {
      if (typeof r === "string") return { name: "", role: "", message: r }; // Graceful degrade from old strings
      return { name: String(r?.name ?? ""), role: String(r?.role ?? ""), message: String(r?.message ?? "") };
    });
  }, [profile.recommendations]);

  const setRecRow = (idx: number, field: "name" | "role" | "message", value: string) => {
    setPayload(p => {
      if (!p) return p;
      const rows = [...recRows];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...p, profile: { ...asRecord(p.profile), recommendations: rows } };
    });
  };

  const addRecRow = () => {
    setPayload(p => {
      if (!p) return p;
      return { ...p, profile: { ...asRecord(p.profile), recommendations: [...recRows, { name: "", role: "", message: "" }] } };
    });
  };

  const removeRecRow = (idx: number) => {
    if (recRows.length <= 1) return;
    setPayload(p => {
      if (!p) return p;
      return { ...p, profile: { ...asRecord(p.profile), recommendations: recRows.filter((_, i) => i !== idx) } };
    });
  };

  const histPostRows = useMemo(() => {
    const raw = payload?.historicalPosts;
    if (!Array.isArray(raw) || raw.length === 0) return [{ text: "", format: "text" }];
    return raw.map(r => ({ text: String(r?.text ?? ""), format: String(r?.format ?? "text") }));
  }, [payload?.historicalPosts]);

  const setHistPostRow = (idx: number, field: "text" | "format", value: string) => {
    setPayload(p => {
      if (!p) return p;
      const rows = [...histPostRows];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...p, historicalPosts: rows };
    });
  };

  const addHistPostRow = () => {
    setPayload(p => {
      if (!p) return p;
      return { ...p, historicalPosts: [...histPostRows, { text: "", format: "text" }] };
    });
  };

  const removeHistPostRow = (idx: number) => {
    if (histPostRows.length <= 1) return;
    setPayload(p => {
      if (!p) return p;
      return { ...p, historicalPosts: histPostRows.filter((_, i) => i !== idx) };
    });
  };

  const behaviorRows = useMemo(() => {
    const raw = payload?.behaviorSignals;
    if (!raw || typeof raw !== "object" || Object.keys(raw).length === 0) return [{ key: "", value: "" }];
    return Object.entries(raw).map(([k, v]) => ({ key: k, value: String(v) }));
  }, [payload?.behaviorSignals]);

  const setBehaviorRow = (idx: number, field: "key" | "value", value: string) => {
    setPayload(p => {
      if (!p) return p;
      const rows = [...behaviorRows];
      rows[idx] = { ...rows[idx], [field]: value };
      const nextObj: Record<string, string> = {};
      rows.forEach(r => { if (r.key.trim()) nextObj[r.key.trim()] = r.value; });
      return { ...p, behaviorSignals: Object.keys(nextObj).length > 0 ? nextObj : null };
    });
  };

  const addBehaviorRow = () => {
    setPayload(p => {
      if (!p) return p;
      const newOb = { ...(asRecord(p.behaviorSignals) ?? {}) };
      newOb[`new_key_${Date.now()}`] = "";
      return { ...p, behaviorSignals: newOb };
    });
  };

  const removeBehaviorRow = (key: string) => {
    setPayload(p => {
      if (!p) return p;
      const ob = { ...asRecord(p.behaviorSignals) };
      delete ob[key];
      return { ...p, behaviorSignals: Object.keys(ob).length > 0 ? ob : null };
    });
  };

  const peerRows = useMemo(() => {
    const raw = payload?.peerBenchmark;
    if (!raw || typeof raw !== "object" || Object.keys(raw).length === 0) return [{ key: "", value: "" }];
    return Object.entries(raw).map(([k, v]) => ({ key: k, value: String(v) }));
  }, [payload?.peerBenchmark]);

  const setPeerRow = (idx: number, field: "key" | "value", value: string) => {
    setPayload(p => {
      if (!p) return p;
      const rows = [...peerRows];
      rows[idx] = { ...rows[idx], [field]: value };
      const nextObj: Record<string, string> = {};
      rows.forEach(r => { if (r.key.trim()) nextObj[r.key.trim()] = r.value; });
      return { ...p, peerBenchmark: Object.keys(nextObj).length > 0 ? nextObj : null };
    });
  };

  const addPeerRow = () => {
    setPayload(p => {
      if (!p) return p;
      const newOb = { ...(asRecord(p.peerBenchmark) ?? {}) };
      newOb[`new_key_${Date.now()}`] = "";
      return { ...p, peerBenchmark: newOb };
    });
  };

  const removePeerRow = (key: string) => {
    setPayload(p => {
      if (!p) return p;
      const ob = { ...asRecord(p.peerBenchmark) };
      delete ob[key];
      return { ...p, peerBenchmark: Object.keys(ob).length > 0 ? ob : null };
    });
  };

  const mergeOptionalIntoPayload = (base: ProfilePayload): ProfilePayload => {
    const next = { ...base };
    next.profile = { ...asRecord(next.profile) };
    
    const skills = skillsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    (next.profile as Record<string, unknown>).skills = skills;

    return next;
  };

  useEffect(() => {
    if (!userId || !payload) return;
    const ac = new AbortController();
    const tid = window.setTimeout(() => {
      void (async () => {
        try {
          const merged = mergeOptionalIntoPayload(payload);
          const before = JSON.stringify(payload);
          const after = JSON.stringify(merged);
          await putJSON(`/users/${userId}/profile`, { payload: merged }, ac.signal);
          if (ac.signal.aborted) return;
          if (before !== after) setPayload(merged);
        } catch (e: unknown) {
          if (ac.signal.aborted) return;
          setErr(e instanceof Error ? e.message : String(e));
        }
      })();
    }, 550);
    return () => {
      window.clearTimeout(tid);
      ac.abort();
    };
  }, [userId, payload, skillsText]);

  const handleSave = async () => {
    if (!userId || !payload) return;
    setBusy(true);
    setErr(null);
    try {
      const merged = mergeOptionalIntoPayload(payload);
      await putJSON(`/users/${userId}/profile`, { payload: merged });
      setPayload(merged);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAnalyze = async () => {
    if (!userId) return;
    setBusy(true);
    setErr(null);
    try {
      if (payload) {
        const merged = mergeOptionalIntoPayload(payload);
        setPayload(merged);
        await putJSON(`/users/${userId}/profile`, { payload: merged });
      }
      const res = await postJSON<AnalyzeResponse>(`/users/${userId}/analyze`, {
        scoringTuning: { post: scoringTuning.post, profile: scoringTuning.profile },
      });
      setLastOut(res);
      setTab("results");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAnalyzeDraft = async () => {
    if (!userId || !draftText.trim()) {
      setErr("Draft post text is required.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (payload) {
        const merged = mergeOptionalIntoPayload(payload);
        setPayload(merged);
        await putJSON(`/users/${userId}/profile`, { payload: merged });
      }
      const iso = draftWhen.includes("T") ? new Date(draftWhen).toISOString() : new Date().toISOString();
      const res = await postJSON<AnalyzeResponse>(`/users/${userId}/analyze-draft`, {
        postText: draftText,
        intendedFormat: draftFormat,
        intendedPublishAt: iso,
        scoringTuning: { post: scoringTuning.post, profile: scoringTuning.profile },
      });
      setLastOut(res);
      setTab("results");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const u = await postJSON<StudioUser>("/users", { displayName: newName.trim() });
      await refreshUsers();
      setShowNew(false);
      setNewName("");
      const ok = await loadProfile(u.id);
      if (ok) {
        setWorkspaceView("account");
        setTab("profile");
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const loadRunDetail = useCallback(
    async (runId: string) => {
      if (!userId) return;
      setRunDetailBusy(true);
      setErr(null);
      try {
        const d = await getJSON<StudioRunDetail>(`/users/${userId}/runs/${runId}`);
        setRunDetail(d);
      } catch (e: unknown) {
        setErr(e instanceof Error ? e.message : String(e));
      } finally {
        setRunDetailBusy(false);
      }
    },
    [userId]
  );

  const openUser = async (id: string) => {
    const ok = await loadProfile(id);
    if (!ok) return;
    setWorkspaceView("account");
    setTab("profile");
  };

  const goToBoard = () => {
    setWorkspaceView("board");
  };

  const handleDeleteUser = async (u: StudioUser) => {
    const msg = `Remove "${u.displayName}" from the list?\n\nTheir profile and analysis runs stay saved — you can restore this account from "Removed accounts" below. Use "Erase forever" there only if you want to delete all data permanently.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteJSON(`/users/${u.id}`);
      if (userId === u.id) {
        setUserId(null);
        setPayload(null);
        setLastOut(null);
        setRunDetail(null);
        setPastRuns([]);
        setWorkspaceView("board");
        setTab("profile");
        setSkillsText("");
        setSkillDraft("");
        setDraftText("");
        setAboutExpanded(false);
        setExpDescExpanded({});
        setEditingConnectionsLine(false);
        setEditingMetricKey(null);
      }
      await refreshUsers();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRestoreUser = async (t: StudioTrashedUser) => {
    setBusy(true);
    setErr(null);
    try {
      await postJSON(`/users/${t.id}/restore`, {});
      await refreshUsers();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handlePurgeUserForever = async (t: StudioTrashedUser) => {
    const msg = `PERMANENTLY erase "${t.displayName}" and all saved profile + analysis data?\n\nThis cannot be undone.`;
    if (!window.confirm(msg)) return;
    setBusy(true);
    setErr(null);
    try {
      await deleteJSON(`/users/${t.id}/purge`);
      if (userId === t.id) {
        setUserId(null);
        setPayload(null);
        setLastOut(null);
        setRunDetail(null);
        setPastRuns([]);
        setWorkspaceView("board");
        setTab("profile");
        setSkillsText("");
        setSkillDraft("");
        setDraftText("");
        setAboutExpanded(false);
        setExpDescExpanded({});
        setEditingConnectionsLine(false);
        setEditingMetricKey(null);
      }
      await refreshUsers();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onLinkedinPdfSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    input.value = "";
    setPdfInfo(null);
    if (!file || !userId || !payload) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setErr("Please choose a PDF file.");
      return;
    }
    setPdfBusy(true);
    setErr(null);
    try {
      const res = await postLinkedinProfilePdf(userId, file);
      const merged = mergePdfProfileIntoPayload(payload, res.patch);
      setPayload(merged);
      const mergedProf = asRecord(merged.profile);
      const sk = mergedProf?.skills;
      setSkillDraft("");
      setSkillsText(Array.isArray(sk) ? sk.map(String).join(", ") : skillsText);
      setPdfInfo(
        `PDF read (${res.charsExtracted} characters). Empty fields were filled where possible.${res.usedLlm ? "" : " Add OPENAI_API_KEY or OPENROUTER_API_KEY on the server for smarter extraction."
        }`
      );
    } catch (err: unknown) {
      setErr(err instanceof Error ? err.message : String(err));
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="appShell">
      <div className="main">
        <header className={`toolbar ${workspaceView === "board" ? "toolbarBoard" : ""}`}>
          <div className="toolbarBrand">LinkedIn AI</div>
          {workspaceView === "account" && (
            <>
              <button type="button" className="btn btnGhost btnBackBoard" onClick={goToBoard}>
                ← People
              </button>
              <div className="tabs">
                {visibleTabs.map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    className={`tab ${tab === k ? "on" : ""}`}
                    disabled={!userId}
                    onClick={() => setTab(k)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="toolbarSpacer" />
              <button type="button" className="btn btnGhost" onClick={() => setShowNew(true)}>
                New user
              </button>
              <button type="button" className="btn btnGhost" disabled={!userId || busy} onClick={() => void handleSave()}>
                Save
              </button>
              <button type="button" className="btn btnPrimary" disabled={!userId || busy} onClick={() => void handleAnalyze()}>
                Run profile analysis
              </button>
            </>
          )}
          {workspaceView === "board" && (
            <>
              <p className="toolbarBoardHint">Choose someone to open their profile workspace.</p>
              <div className="toolbarSpacer" />
              <button type="button" className="btn btnGhost" onClick={() => setShowNew(true)}>
                New user
              </button>
            </>
          )}
        </header>

        <div className={`content ${workspaceView === "board" ? "contentBoard" : ""}`}>
          {err && <div className="banner bannerErr">{err}</div>}

          {workspaceView === "board" && (
            <>
              <section className="peopleBoard" aria-label="People">
                <div className="peopleBoardInner">
                  <div className="peopleBoardHead">
                    <h2>People</h2>
                    <span className="peopleBoardCount">{users.length}</span>
                  </div>
                  {users.length === 0 ? (
                    <p className="peopleTableEmpty">No people yet. Use New user to add one.</p>
                  ) : (
                    <div className="peopleTableWrap">
                      <table className="peopleTable">
                        <thead>
                          <tr>
                            <th scope="col">Name</th>
                            <th scope="col">Joined</th>
                            <th scope="col" className="peopleTableActionsCol">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((u) => (
                            <tr key={u.id} className={u.id === userId ? "peopleTableRowActive" : undefined}>
                              <td className="peopleTableName">{u.displayName}</td>
                              <td className="peopleTableDate">{new Date(u.createdAt).toLocaleDateString()}</td>
                              <td className="peopleTableActionsCol">
                                <div className="peopleTableActions">
                                  <button type="button" className="btn btnPrimary btnOpenAccount" onClick={() => void openUser(u.id)}>
                                    {u.id === userId ? "Open again" : "Open account"}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btnDangerGhost btnDeletePerson"
                                    disabled={busy}
                                    onClick={() => void handleDeleteUser(u)}
                                  >
                                    Remove
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
              <section className={`peopleBoard peopleBoardTrash ${trashedUsers.length === 0 ? "peopleBoardTrashEmpty" : ""}`} aria-label="Removed accounts">
                <div className="peopleBoardInner">
                  <div className="peopleBoardHead">
                    <h2>Removed accounts</h2>
                    <span className="peopleBoardCount">{trashedUsers.length}</span>
                  </div>
                  {trashedUsers.length === 0 ? (
                    <p className="peopleTableEmpty">
                      {`No removed accounts. "Remove" on a person moves them here instead of deleting data.`}
                    </p>
                  ) : (
                    <div className="peopleTableWrap">
                      <table className="peopleTable">
                        <thead>
                          <tr>
                            <th scope="col">Name</th>
                            <th scope="col">Removed</th>
                            <th scope="col" className="peopleTableActionsCol">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {trashedUsers.map((t) => (
                            <tr key={t.id}>
                              <td className="peopleTableName">{t.displayName}</td>
                              <td className="peopleTableDate">{new Date(t.deletedAt).toLocaleString()}</td>
                              <td className="peopleTableActionsCol">
                                <div className="peopleTableActions">
                                  <button type="button" className="btn btnPrimary btnOpenAccount" disabled={busy} onClick={() => void handleRestoreUser(t)}>
                                    Restore
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btnDangerGhost btnDeletePerson"
                                    disabled={busy}
                                    onClick={() => void handlePurgeUserForever(t)}
                                  >
                                    Erase forever
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}

          {workspaceView === "account" && userId && payload && (
            <div className="panel">
              {tab === "profile" && (
                <div className="fieldGrid">
                  <section className="liHeroCard" style={{ gridColumn: "1 / -1" }}>
                    <div className="liHeroUrlBar">
                      <label htmlFor="hero-url">Profile URL</label>
                      <div className="liHeroUrlControl">
                        <input
                          id="hero-url"
                          className="liHeroUrlInput"
                          value={String(profile.clientLinkedinUrl ?? "")}
                          onChange={(e) => setProfileField("clientLinkedinUrl", e.target.value)}
                          placeholder="https://www.linkedin.com/in/…"
                        />
                        <button type="button" className="liEditIconBtn" onClick={() => focusField("hero-url")} aria-label="Edit profile URL">
                          ✎
                        </button>
                      </div>
                    </div>
                    <div className="liCover" />
                    <div className="liHeroBody">
                      <div className="liAvatar" aria-hidden="true" />
                      <div className="liIdentityRow">
                        <div className="liIdentityMain">
                          <div className="liEditableLine">
                            <label htmlFor="hero-name">Name</label>
                            <div className="liEditableControl">
                              <input
                                id="hero-name"
                                className="liInlineInput liNameInput"
                                value={String(profile.name ?? "")}
                                onChange={(e) => setProfileField("name", e.target.value)}
                                placeholder="Your Name"
                              />
                              <button type="button" className="liEditIconBtn" onClick={() => focusField("hero-name")} aria-label="Edit name">
                                ✎
                              </button>
                            </div>
                          </div>
                          <div className="liEditableLine">
                            <label htmlFor="hero-headline">
                              Headline <span className="liInlineLimit">{String(profile.headline ?? "").length}/{LINKEDIN_LIMITS.headline}</span>
                            </label>
                            <div className="liEditableControl liEditableControlHeadline">
                              <textarea
                                id="hero-headline"
                                className="liInlineInput liHeadlineInput"
                                rows={2}
                                value={String(profile.headline ?? "")}
                                maxLength={LINKEDIN_LIMITS.headline}
                                onChange={(e) => setProfileField("headline", e.target.value)}
                                placeholder="Headline"
                              />
                              <button type="button" className="liEditIconBtn" onClick={() => focusField("hero-headline")} aria-label="Edit headline">
                                ✎
                              </button>
                            </div>
                          </div>
                          <p className="liLocationLine">
                            {String(profile.location ?? "Location")} · <span className="liContact">Contact info</span>
                          </p>
                          <div className="liConnLine">
                            {editingConnectionsLine ? (
                              <div className="liConnEditRow">
                                <input
                                  className="liConnInlineInput"
                                  inputMode="numeric"
                                  value={metricStr(metricsSummary, "followers")}
                                  onChange={(e) => setMetricField("followers", e.target.value)}
                                  placeholder="Followers"
                                />
                                <span>followers</span>
                                <span>·</span>
                                <input
                                  className="liConnInlineInput"
                                  inputMode="numeric"
                                  value={metricStr(metricsSummary, "connections")}
                                  onChange={(e) => setMetricField("connections", e.target.value)}
                                  placeholder="Connections"
                                />
                                <span>connections</span>
                                <button type="button" className="liTinyEditBtn" onClick={() => setEditingConnectionsLine(false)}>
                                  done
                                </button>
                              </div>
                            ) : (
                              <>
                                {followersCount} followers · {connectionsCount} connections
                                <button
                                  type="button"
                                  className="liTinyEditBtn"
                                  onClick={() => setEditingConnectionsLine(true)}
                                  aria-label="Edit followers and connections"
                                >
                                  ✎
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                        <aside className="liPdfUploadPanel" aria-label="Import profile from PDF">
                          <div className="liPdfUploadTitle">LinkedIn profile PDF</div>
                          <p className="liPdfUploadHint">
                            {`Upload a LinkedIn "Save to PDF" export. Only empty fields are filled (name, headline, URL, about, skills, experience, etc.).`}
                          </p>
                          <input
                            ref={pdfInputRef}
                            type="file"
                            accept="application/pdf,.pdf"
                            className="liPdfFileInputHidden"
                            onChange={(e) => void onLinkedinPdfSelected(e)}
                          />
                          <button
                            type="button"
                            className="btn btnGhost liPdfUploadBtn"
                            disabled={busy || pdfBusy}
                            onClick={() => pdfInputRef.current?.click()}
                          >
                            {pdfBusy ? "Reading PDF…" : "Choose PDF"}
                          </button>
                          {pdfInfo ? <p className="liPdfUploadInfo">{pdfInfo}</p> : null}
                        </aside>
                      </div>
                    </div>
                  </section>

                  <div className="liAnalyticsRow" style={{ gridColumn: "1 / -1" }}>
                    {analyticsCards.map((card) => {
                      const primary = metricStr(metricsSummary, card.key);
                      const fallback =
                        "fallbackKey" in card && card.fallbackKey ? metricStr(metricsSummary, card.fallbackKey) : "";
                      const shown = primary || fallback || "—";
                      return (
                        <div key={card.key} className="liMetricCard">
                          <button
                            type="button"
                            className="liMetricEditBtn"
                            onClick={() => setEditingMetricKey((k) => (k === card.key ? null : card.key))}
                            aria-label={`Edit ${card.label}`}
                          >
                            ✎
                          </button>
                          {editingMetricKey === card.key ? (
                            <input
                              className="liMetricInlineInput"
                              inputMode="numeric"
                              value={metricStr(metricsSummary, card.key)}
                              onChange={(e) => setMetricField(card.key, e.target.value)}
                              placeholder={card.label}
                            />
                          ) : (
                            <div className="liMetricValue">{shown}</div>
                          )}
                          <div className="liMetricLabel">{card.label}</div>
                          <div className="liMetricSub">{card.sub}</div>
                        </div>
                      );
                    })}
                  </div>
                  <section className="liSectionCard liTrendCard" style={{ gridColumn: "1 / -1" }}>
                    <div className="liSectionHead">
                      <h3>Analytics</h3>
                    </div>
                    <p className="liAnalyticsExplainer">
                      Each line is <strong>pure math</strong>: pick a <strong>calendar window</strong>, <strong>▲ up</strong> or <strong>▼ down</strong>, and a <strong>% change</strong> over that window.
                      The curve is linear from <code>start = end ÷ (1 + Δ%)</code> to <code>end</code> = your metric total (Δ positive = up, negative = down). If Δ% is empty, we use a small default ramp. Long windows use up to{" "}
                      {CHART_MAX_POLYLINE_POINTS} samples so the SVG stays light.
                    </p>
                    <div className="liAnalyticsTimeGrid">
                      {analyticsTimeBlocks.map((block) => (
                        <div key={block.id} className="liTimeChartCell">
                          <div className="liTimeChartHead">
                            <div className="liTimeChartTitleRow">
                              <span className="liTimeChartTitle">{block.title}</span>
                              <span className="liTimeChartValue">{block.display}</span>
                            </div>
                            <div className="liTimeChartPeriod">{block.period}</div>
                          </div>
                          <div className="liChartControls">
                            <label className="liChartControl">
                              <span className="liChartControlLab">Window</span>
                              <select
                                className="liChartSelect"
                                value={CHART_WINDOW_OPTIONS.some((o) => o.value === block.winTok) ? block.winTok : block.defaultWin}
                                onChange={(e) => setMetricField(block.winKey, e.target.value)}
                              >
                                {CHART_WINDOW_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="liChartControl">
                              <span className="liChartControlLab">Direction</span>
                              <select className="liChartSelect" value={block.dir} onChange={(e) => setMetricField(block.dirKey, e.target.value)}>
                                <option value="up">▲ Up</option>
                                <option value="down">▼ Down</option>
                              </select>
                            </label>
                            <label className="liChartControl">
                              <span className="liChartControlLab">Δ %</span>
                              <input
                                className="liChartPctInput"
                                type="number"
                                min={0}
                                step={0.1}
                                inputMode="decimal"
                                value={metricStr(metricsSummary, block.pctKey)}
                                onChange={(e) => setMetricField(block.pctKey, e.target.value)}
                                placeholder="e.g. 73.8"
                              />
                            </label>
                          </div>
                          {block.signedApplied != null && Number.isFinite(block.signedApplied) ? (
                            <div className="liChartMathPill">
                              Using Δ = <strong>{block.signedApplied > 0 ? "+" : ""}{block.signedApplied.toFixed(2)}%</strong> · {block.days}d span ·{" "}
                              {stepsFromWindowDays(block.days)} points
                            </div>
                          ) : (
                            <div className="liChartMathPill liChartMathPillMuted">Δ from default ramp · {block.days}d · {stepsFromWindowDays(block.days)} points</div>
                          )}
                          <svg
                            className="liTrendSvg liTrendSvgCompact"
                            viewBox="0 0 100 44"
                            preserveAspectRatio="none"
                            aria-label={`${block.title} over ${block.period}`}
                          >
                            <polyline className="liTrendLine" points={block.points} vectorEffect="non-scaling-stroke" />
                          </svg>
                          <div className="liChartXLabels" aria-hidden="true">
                            {block.xLabels.map((lab, i) => (
                              <span key={`${block.id}-x-${i}`}>{lab}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="liSectionCard" style={{ gridColumn: "1 / -1" }}>
                    <div className="liSectionHead">
                      <h3>About</h3>
                      <button type="button" className="liEditIconBtn" onClick={() => { setAboutExpanded(true); requestAnimationFrame(() => focusField("about-main")); }} aria-label="Edit about">
                        ✎
                      </button>
                    </div>
                    {aboutExpanded ? (
                      <textarea
                        id="about-main"
                        ref={aboutTextareaRef}
                        className="liAboutTextarea"
                        value={aboutText}
                        maxLength={LINKEDIN_LIMITS.about}
                        onChange={(e) => {
                          setProfileField("about", e.target.value);
                          e.currentTarget.style.height = "auto";
                          e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                        }}
                      />
                    ) : (
                      <p className="liAboutPreview">
                        {aboutPreviewState.preview || "Add your About summary..."}
                        {aboutPreviewState.truncated && (
                          <>
                            ...{" "}
                            <button type="button" className="liInlineMoreBtn" onClick={() => setAboutExpanded(true)}>
                              more
                            </button>
                          </>
                        )}
                      </p>
                    )}
                    {aboutPreviewState.truncated && aboutExpanded && (
                      <button type="button" className="liReadMoreBtn" onClick={() => setAboutExpanded((v) => !v)}>
                        show less
                      </button>
                    )}
                    <div className="limitHint">
                      {aboutText.length}/{LINKEDIN_LIMITS.about} characters
                    </div>
                  </section>

                  <details className="scoringTuningDetails">
                    <summary className="scoringTuningDetailsSummary">⚙ Headline &amp; About scoring weights (QA)</summary>
                    <ProfileScoringTuningPanel
                      value={scoringTuning.profile}
                      onChange={(profile) => setScoringTuning((s) => ({ ...s, profile }))}
                      onReset={() =>
                        setScoringTuning((s) => ({ ...s, profile: { ...defaultScoringTuningState().profile } }))
                      }
                    />
                  </details>

                  <section className="liSectionCard" style={{ gridColumn: "1 / -1" }}>
                    <div className="liSectionHead">
                      <h3>Audience targeting</h3>
                    </div>
                    <div className="audGrid">
                      <div className="field audienceTargetField">
                        <label>Expected target audience</label>
                        <input
                          id="expected-target-audience"
                          value={expectedAudience}
                          onChange={(e) => {
                            setContextField("target_audience", e.target.value);
                            setAudienceRefineMeta(null);
                          }}
                          placeholder="e.g. AIMLDevelopers, AI engineers, people in ML product"
                        />
                        <div className="limitHint">
                          Rough notes are OK — use <strong>Refine with AI</strong> to turn them into a clear audience line (needs OpenAI or OpenRouter on the server).
                        </div>
                        <div className="audienceRefineActions">
                          <button
                            type="button"
                            className="btn btnGhost"
                            disabled={busy || audienceRefineBusy || !userId}
                            onClick={() => void handleRefineTargetAudience()}
                          >
                            {audienceRefineBusy ? "Refining…" : "Refine with AI"}
                          </button>
                        </div>
                        {audienceRefineMeta ? (
                          <div className="audienceRefinePreview">
                            <div className="limitHint">
                              {audienceRefineMeta.usedLlm ? "Last refinement: LLM" : "Last refinement: heuristic (add API keys for LLM)"}
                            </div>
                            {audienceRefineMeta.rationale ? <p className="audienceRefineRationale">{audienceRefineMeta.rationale}</p> : null}
                            {audienceRefineMeta.segments.length > 0 ? (
                              <ul className="audienceRefineSegments">
                                {audienceRefineMeta.segments.map((s, i) => (
                                  <li key={`${s}-${i}`}>{s}</li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                      <div className="field">
                        <label>Audience targeting</label>
                        <div className="limitHint">
                          Run a profile analysis (Analyze current profile) to see an AI-generated assessment of who your profile is actually targeting.
                        </div>
                      </div>
                    </div>
                  </section>

                  <div className="field">
                    <label>Location</label>
                    <button type="button" className="fieldEditBtn" onClick={() => focusField("profile-location")} aria-label="Edit location">✎</button>
                    <input id="profile-location" value={String(profile.location ?? "")} onChange={(e) => setProfileField("location", e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Years experience hint</label>
                    <button type="button" className="fieldEditBtn" onClick={() => focusField("profile-years")} aria-label="Edit years experience">✎</button>
                    <input id="profile-years" value={String(profile.yearsExperienceHint ?? "")} onChange={(e) => setProfileField("yearsExperienceHint", e.target.value)} />
                  </div>
                  <section className="liSectionCard" style={{ gridColumn: "1 / -1" }}>
                    <div className="liSectionHead">
                      <h3>Experience</h3>
                      <button type="button" className="liEditIconBtn" onClick={() => focusField("exp-title-0")} aria-label="Edit experience">
                        ✎
                      </button>
                    </div>
                    {experienceRows.map((row, idx) => (
                      <div key={idx} className="expRow">
                        <div className="expRowHead">
                          <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>Role {idx + 1}</span>
                          {experienceRows.length > 1 && (
                            <button type="button" className="btn btnGhost" style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }} onClick={() => removeExpRow(idx)}>
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="fieldGrid">
                          <div className="field">
                            <label>Title</label>
                            <input id={`exp-title-${idx}`} value={row.title} onChange={(e) => setExpRow(idx, "title", e.target.value)} />
                          </div>
                          <div className="field">
                            <label>Company</label>
                            <input id={`exp-company-${idx}`} value={row.company} onChange={(e) => setExpRow(idx, "company", e.target.value)} />
                          </div>
                          <div className="field">
                            <label>Duration</label>
                            <input id={`exp-duration-${idx}`} value={row.duration} onChange={(e) => setExpRow(idx, "duration", e.target.value)} />
                          </div>
                          <div className="field" style={{ gridColumn: "1 / -1" }}>
                            <label>Description</label>
                            {(() => {
                              const expDescPrev = buildExpDescriptionPreview(row.description);
                              const expDescOpen = !!expDescExpanded[idx];
                              const showExpDescCollapsed = expDescPrev.truncated && !expDescOpen;
                              return showExpDescCollapsed ? (
                                <>
                                  <p className="liAboutPreview">
                                    {expDescPrev.preview}
                                    <>
                                      ...{" "}
                                      <button
                                        type="button"
                                        className="liInlineMoreBtn"
                                        onClick={() =>
                                          setExpDescExpanded((m) => {
                                            return { ...m, [idx]: true };
                                          })
                                        }
                                      >
                                        more
                                      </button>
                                    </>
                                  </p>
                                  <div className="limitHint">
                                    {row.description.length}/{LINKEDIN_LIMITS.experienceDescriptionMax} chars
                                    {` (preview ${EXPERIENCE_DESCRIPTION_PREVIEW_CHAR_LIMIT} · recommended ${LINKEDIN_LIMITS.experienceDescriptionRecommendedMin}-${LINKEDIN_LIMITS.experienceDescriptionMax})`}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <textarea
                                    id={`exp-description-${idx}`}
                                    className="liAboutTextarea"
                                    value={row.description}
                                    maxLength={LINKEDIN_LIMITS.experienceDescriptionMax}
                                    onChange={(e) => {
                                      setExpRow(idx, "description", e.target.value);
                                      e.currentTarget.style.height = "auto";
                                      e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                                    }}
                                  />
                                  <div className="limitHint">
                                    {row.description.length}/{LINKEDIN_LIMITS.experienceDescriptionMax} chars
                                    {` (recommended ${LINKEDIN_LIMITS.experienceDescriptionRecommendedMin}-${LINKEDIN_LIMITS.experienceDescriptionMax})`}
                                  </div>
                                  {expDescPrev.truncated && (
                                    <button
                                      type="button"
                                      className="liReadMoreBtn"
                                      onClick={() =>
                                        setExpDescExpanded((m) => {
                                          const next = { ...m };
                                          delete next[idx];
                                          return next;
                                        })
                                      }
                                    >
                                      show less
                                    </button>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    ))}
                    <button type="button" className="btn btnGhost" onClick={addExpRow}>
                      + Add role
                    </button>
                  </section>
                  <div className="field">
                    <label>Skills</label>
                    <button type="button" className="fieldEditBtn" onClick={() => focusField("profile-skills")} aria-label="Edit skills">✎</button>
                    <div className="skillChipWrap">
                      {skillItems.map((skill, idx) => (
                        <span key={`${skill}-${idx}`} className="skillChip">
                          {skill}
                          <button type="button" className="skillChipX" onClick={() => removeSkill(idx)} aria-label={`Remove ${skill}`}>
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        id="profile-skills"
                        className="skillChipInput"
                        value={skillDraft}
                        onChange={(e) => setSkillDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            addSkill();
                          }
                        }}
                        placeholder={skillItems.length ? "Add skill..." : "Type skill and press Enter"}
                      />
                    </div>
                    <div className="limitHint">
                      {skillItems.length} skills
                      {longSkills.length > 0
                        ? ` · ${longSkills.length} skill(s) exceed ${LINKEDIN_LIMITS.skillPerItem} chars`
                        : ` · max ${LINKEDIN_LIMITS.skillPerItem} chars per skill`}
                    </div>
                  </div>

                  <section className="liSectionCard" style={{ gridColumn: "1 / -1" }}>
                    <div className="liSectionHead">
                      <h3>Context & Guidance</h3>
                    </div>
                    <p className="liAnalyticsExplainer">
                      This block is <strong>not</strong> for writing a LinkedIn <strong>post</strong> — use the <strong>Draft post</strong> tab for that. Here you add{" "}
                      <strong>extra context</strong> that is saved on this person&apos;s dataset and passed into <strong>profile analysis</strong> (the analyzer /
                      LLM): who they want to reach, career direction, geography, industry, etc. It helps the model interpret the profile (headline, About, experience,
                      skills) and give better scores and suggestions. <strong>Description</strong> is a short note about this workspace or person (not the same as
                      the public About section above). <strong>Task instruction</strong> tells the run what to prioritize (e.g. &quot;focus on headline + experience&quot;).{" "}
                      <strong>Source note</strong> is optional metadata (e.g. where numbers came from, export date).
                    </p>
                    <div className="fieldGrid">
                      {(
                        [
                          ["target_audience", "Expected target audience"],
                          ["career_goal", "Expected goal"],
                          ["geography", "Currently targeting geography"],
                        ] as const
                      ).map(([k, label]) => (
                        <div className="field" key={k}>
                          <label>{label}</label>
                          <input value={String(userContext[k] ?? "")} onChange={(e) => setContextField(k, e.target.value)} />
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="liSectionCard" style={{ gridColumn: "1 / -1" }}>
                    <div className="liSectionHead">
                      <h3>Education</h3>
                      <button type="button" className="actionBtn borderBtn" onClick={addEduRow}>
                        + Add more
                      </button>
                    </div>
                    {eduRows.map((r, i) => (
                      <div key={i} className="fieldGrid" style={{ background: "#f8fafc", padding: "12px", border: "1px solid #e5e7eb", borderRadius: "8px", position: "relative", marginBottom: "8px" }}>
                        {eduRows.length > 1 && (
                          <button type="button" className="removeRowBtn" onClick={() => removeEduRow(i)} aria-label="Remove education item">
                            ×
                          </button>
                        )}
                        <div className="field" style={{ gridColumn: "1 / -1" }}>
                          <label>University / College / School name</label>
                          <input value={r.school} onChange={(e) => setEduRow(i, "school", e.target.value)} placeholder="E.g. Stanford University" />
                        </div>
                        <div className="field">
                          <label>Degree / Diploma / Qualification</label>
                          <input value={r.degree} onChange={(e) => setEduRow(i, "degree", e.target.value)} placeholder="E.g. BS Computer Science" />
                        </div>
                        <div className="field">
                          <label>
                            Year (Start) - Year (End)
                            <span className="infoIcon" title="Enter the start and end years (YYYY). 0/100 scores often appear if dates are missing or illogical.">ⓘ</span>
                          </label>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <input type="number" min="1950" max="2050" step="1" placeholder="YYYY" value={r.year.split(" - ")[0]?.trim() || ""} onChange={(e) => {
                               const end = r.year.split(" - ")[1]?.trim() || "";
                               setEduRow(i, "year", `${e.target.value} - ${end}`);
                            }} />
                            <span style={{color: "#6b7280"}}>—</span>
                            <input type="number" min="1950" max="2050" step="1" placeholder="YYYY" value={r.year.split(" - ")[1]?.trim() || ""} onChange={(e) => {
                               const start = r.year.split(" - ")[0]?.trim() || "";
                               setEduRow(i, "year", `${start} - ${e.target.value}`);
                            }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </section>

                  <section className="liSectionCard" style={{ gridColumn: "1 / -1" }}>
                    <div className="liSectionHead">
                      <h3>Featured</h3>
                      <button type="button" className="actionBtn borderBtn" onClick={addFeaturedRow}>
                        + Add more
                      </button>
                    </div>
                    {featuredRows.map((r, i) => (
                      <div key={i} className="fieldGrid" style={{ background: "#f8fafc", padding: "12px", border: "1px solid #e5e7eb", borderRadius: "8px", position: "relative", marginBottom: "8px" }}>
                        {featuredRows.length > 1 && (
                          <button type="button" className="removeRowBtn" onClick={() => removeFeaturedRow(i)} aria-label="Remove featured item">
                            ×
                          </button>
                        )}
                        <div className="field">
                          <label>Format</label>
                          <select value={r.format} onChange={(e) => setFeaturedRow(i, "format", e.target.value)}>
                            <option value="text">Text only</option>
                            <option value="image">Image only</option>
                            <option value="video">Video only</option>
                            <option value="text_with_image">Text + Image</option>
                            <option value="text_with_video">Text + Video</option>
                            <option value="carousel">Carousel / Document</option>
                            <option value="link">External Link</option>
                            <option value="article">Newsletter / Article</option>
                          </select>
                        </div>
                        <div className="field" style={{ gridColumn: "1 / -1" }}>
                          <label>Post Text / Description</label>
                          <textarea value={r.text} onChange={(e) => setFeaturedRow(i, "text", e.target.value)} style={{ minHeight: "80px" }} placeholder="Paste the post text here..." />
                        </div>
                      </div>
                    ))}
                  </section>

                  <section className="liSectionCard" style={{ gridColumn: "1 / -1" }}>
                    <div className="liSectionHead">
                      <h3>Recommendations</h3>
                      <button type="button" className="actionBtn borderBtn" onClick={addRecRow}>
                        + Add more
                      </button>
                    </div>
                    {recRows.map((r, i) => (
                      <div key={i} className="fieldGrid" style={{ background: "#f8fafc", padding: "12px", border: "1px solid #e5e7eb", borderRadius: "8px", position: "relative", marginBottom: "8px" }}>
                        {recRows.length > 1 && (
                          <button type="button" className="removeRowBtn" onClick={() => removeRecRow(i)} aria-label="Remove recommendation">
                            ×
                          </button>
                        )}
                        <div className="field">
                          <label>Name</label>
                          <input value={r.name} onChange={(e) => setRecRow(i, "name", e.target.value)} placeholder="E.g. Jane Doe" />
                        </div>
                        <div className="field">
                          <label>Title / Role / Position</label>
                          <input value={r.role} onChange={(e) => setRecRow(i, "role", e.target.value)} placeholder="E.g. Senior Manager at Google" />
                        </div>
                        <div className="field" style={{ gridColumn: "1 / -1" }}>
                          <label>Message</label>
                          <textarea value={r.message} onChange={(e) => setRecRow(i, "message", e.target.value)} style={{ minHeight: "80px" }} placeholder="Paste the recommendation message here..." />
                        </div>
                      </div>
                    ))}
                  </section>

                  <section className="liSectionCard" style={{ gridColumn: "1 / -1" }}>
                    <div className="liSectionHead" style={{ flexDirection: "column", alignItems: "flex-start", gap: "4px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                        <h3>Historical Posts</h3>
                        <button type="button" className="actionBtn borderBtn" onClick={addHistPostRow}>
                          + Add more
                        </button>
                      </div>
                      <p style={{ fontSize: "13px", color: "#6b7280", margin: 0, fontWeight: "normal" }}>
                        💡 3 to 5 previous posts is ideal for the AI to accurately calculate your Variety score and detect repetitive habits.
                      </p>
                    </div>
                    {histPostRows.map((r, i) => (
                      <div key={i} className="fieldGrid" style={{ background: "#f8fafc", padding: "12px", border: "1px solid #e5e7eb", borderRadius: "8px", position: "relative", marginBottom: "8px" }}>
                        {histPostRows.length > 1 && (
                          <button type="button" className="removeRowBtn" onClick={() => removeHistPostRow(i)} aria-label="Remove historical post">
                            ×
                          </button>
                        )}
                        <div className="field">
                          <label>Format</label>
                          <select value={r.format} onChange={(e) => setHistPostRow(i, "format", e.target.value)}>
                             <option value="text">Text only</option>
                             <option value="image">Image only</option>
                             <option value="video">Video only</option>
                             <option value="text_with_image">Text + Image</option>
                             <option value="text_with_video">Text + Video</option>
                             <option value="carousel">Carousel / Document</option>
                          </select>
                        </div>
                        <div className="field" style={{ gridColumn: "1 / -1" }}>
                          <label>Post Text</label>
                          <textarea value={r.text} onChange={(e) => setHistPostRow(i, "text", e.target.value)} style={{ minHeight: "80px" }} placeholder="Paste the content of your previous post..." />
                        </div>
                      </div>
                    ))}
                  </section>

                  <section className="liSectionCard" style={{ gridColumn: "1 / -1" }}>
                    <div className="liSectionHead">
                      <h3>Analytic signals (Advanced)</h3>
                    </div>
                    <div className="fieldGrid">
                      <div className="field" style={{ gridColumn: "1 / -1", border: "1px solid #e5e7eb", padding: "16px", borderRadius: "8px", background: "#f8fafc" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
                          <label style={{ margin: 0, fontWeight: 600, color: "#111827" }}>Behavior Signals</label>
                          <button type="button" className="actionBtn borderBtn" style={{ padding: "4px 8px", fontSize: "12px" }} onClick={addBehaviorRow}>+ Add property</button>
                        </div>
                        <datalist id="behavior_keys">
                          <option value="Search history" />
                          <option value="Feed: Avg. time on post" />
                          <option value="Network: Types of connections" />
                          <option value="Network: Types of followers" />
                          <option value="Jobs scrolled" />
                          <option value="Content interests" />
                          <option value="Comment frequency" />
                          <option value="Creator mode active" />
                        </datalist>
                        {behaviorRows.map((r, i) => (
                          <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                            <input list="behavior_keys" value={r.key} onChange={(e) => setBehaviorRow(i, "key", e.target.value)} placeholder="E.g. Content interests" style={{ flex: 1 }} />
                            <input value={r.value} onChange={(e) => setBehaviorRow(i, "value", e.target.value)} placeholder="Type the value or description here..." style={{ flex: 2 }} />
                            <button type="button" style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: "18px", padding: "0 8px" }} onClick={() => removeBehaviorRow(r.key)} aria-label="Remove property">×</button>
                          </div>
                        ))}
                      </div>

                      <div className="field" style={{ gridColumn: "1 / -1", border: "1px solid #e5e7eb", padding: "16px", borderRadius: "8px", background: "#f8fafc" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
                          <label style={{ margin: 0, fontWeight: 600, color: "#111827" }}>Peer Benchmark</label>
                          <button type="button" className="actionBtn borderBtn" style={{ padding: "4px 8px", fontSize: "12px" }} onClick={addPeerRow}>+ Add property</button>
                        </div>
                        <datalist id="peer_keys">
                          <option value="Follower Growth Rank" />
                          <option value="Impressions Percentile" />
                          <option value="Industry Engagement Score" />
                          <option value="Profile Views (vs Peers)" />
                        </datalist>
                        {peerRows.map((r, i) => (
                          <div key={i} style={{ display: "flex", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
                            <input list="peer_keys" value={r.key} onChange={(e) => setPeerRow(i, "key", e.target.value)} placeholder="E.g. Follower Growth Rank" style={{ flex: 1 }} />
                            <input value={r.value} onChange={(e) => setPeerRow(i, "value", e.target.value)} placeholder="E.g. Top 10%" style={{ flex: 2 }} />
                            <button type="button" style={{ border: "none", background: "none", color: "#ef4444", cursor: "pointer", fontSize: "18px", padding: "0 8px" }} onClick={() => removePeerRow(r.key)} aria-label="Remove property">×</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </section>
                </div>
              )}

              {tab === "draft" && (
                <div className="fieldGrid">
                  <div className="field">
                    <label>Draft post</label>
                    <textarea
                      value={draftText}
                      maxLength={LINKEDIN_LIMITS.postDraft}
                      onChange={(e) => setDraftText(e.target.value)}
                      style={{ minHeight: 200 }}
                      placeholder="Paste your LinkedIn draft…"
                    />
                    <div className="limitHint">
                      {draftText.length}/{LINKEDIN_LIMITS.postDraft} characters
                    </div>
                  </div>
                  <div className="field">
                    <label>Format</label>
                    <select value={draftFormat} onChange={(e) => setDraftFormat(e.target.value)}>
                      <option value="text">Text only</option>
                      <option value="text_with_image">Text + Image</option>
                      <option value="text_with_video">Text + Video</option>
                      <option value="text_with_both">Text + Mixed Media (Both)</option>
                      <option value="image_only">Image only</option>
                      <option value="video_only">Video only</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Intended publish (local)</label>
                    <input type="datetime-local" value={draftWhen} onChange={(e) => setDraftWhen(e.target.value)} />
                  </div>
                  <details className="scoringTuningDetails">
                    <summary className="scoringTuningDetailsSummary">⚙ Draft post scoring weights (QA)</summary>
                    <PostScoringTuningPanel
                      value={scoringTuning.post}
                      onChange={(post) => setScoringTuning((s) => ({ ...s, post }))}
                      onReset={() => setScoringTuning((s) => ({ ...s, post: { ...defaultScoringTuningState().post } }))}
                    />
                  </details>
                  <button type="button" className="btn btnPrimary" disabled={busy} onClick={() => void handleAnalyzeDraft()}>
                    Analyze draft (with saved profile)
                  </button>
                </div>
              )}

              {tab === "results" && (
                <div className="resultsLayout">
                  {!lastOut && pastRuns.length === 0 && (
                    <div className="banner">
                      Use <strong>Run profile analysis</strong> in the header to see a structured report. Saved runs from Mongo appear in History below.
                    </div>
                  )}

                  {lastOut?.output && typeof lastOut.output === "object" && !Array.isArray(lastOut.output) && (
                    <section className="resultsSection">
                      <h2 className="sectionTitle">Latest analysis</h2>
                      <div className="audSummary">
                        <span>
                          Expected targeting: <strong>{expectedAudience || "General professional audience (default)"}</strong>
                        </span>
                        <span>
                          AI-inferred profile audience: <strong>{
                            String(asRecord(asRecord(lastOut.output)?.composite_classification)?.predicted_audience || 
                            String(asRecord(asRecord(lastOut.output)?.composite_classification)?.tier || "").replace(/_/g, ' ') || 
                            inferredAudience)
                          }</strong> — <em>{String(asRecord(asRecord(lastOut.output)?.composite_classification)?.inferred_niche || asRecord(asRecord(asRecord(lastOut.output)?.analysis_metadata)?.user_context)?.declared_niche || "Universal")}</em>
                        </span>
                        
                        <div className="scoringLegend">
                          <div className="legendItem">
                            <i className="legendColor legend-authority" /> 90-100: Authority
                          </div>
                          <div className="legendItem">
                            <i className="legendColor legend-specialist" /> 75-89: Specialist
                          </div>
                          <div className="legendItem">
                            <i className="legendColor legend-professional" /> 50-74: Professional
                          </div>
                          <div className="legendItem">
                            <i className="legendColor legend-confused" /> &lt; 50: Confused Signal
                          </div>
                        </div>
                      </div>
                      <div className="runMetaBar">
                        <span className={`badge ${lastOut.ok ? "badgeOk" : "badgeBad"}`}>{lastOut.ok ? "Output valid" : "Check validity"}</span>
                        {asRecord(lastOut.run)?.runId != null && (
                          <span className="mutedSmall">Saved id: {String(asRecord(lastOut.run)?.runId)}</span>
                        )}
                      </div>
                      <AnalysisSplitView output={lastOut.output as Record<string, unknown>} profile={profile} />
                    </section>
                  )}

                  <section className="resultsSection">
                    <h2 className="sectionTitle">History</h2>
                    <p className="mutedSmall" style={{ margin: 0 }}>
                      Open a run to compare saved input vs model output (no raw JSON in the main view).
                    </p>
                    <div className="runList">
                      {runsBusy && <span className="mutedSmall">Loading…</span>}
                      {!runsBusy && pastRuns.length === 0 && <span className="mutedSmall">No saved runs yet.</span>}
                      {pastRuns.map((r) => (
                        <button
                          key={r.runId}
                          type="button"
                          className={`runCard ${runDetail?.runId === r.runId ? "runCardActive" : ""}`}
                          onClick={() => void loadRunDetail(r.runId)}
                        >
                          <span className="runCardDate">{new Date(r.createdAt).toLocaleString()}</span>
                          <div className="runCardMeta">
                            <span className={`badge ${r.ok ? "badgeOk" : "badgeBad"}`}>{r.ok ? "Valid" : "Issues"}</span>
                            {r.model ? <span>{r.model}</span> : null}
                          </div>
                        </button>
                      ))}
                    </div>
                    {runDetailBusy && <p className="mutedSmall">Loading selected run…</p>}
                  </section>

                  {runDetail && !runDetailBusy && runDetail.output && typeof runDetail.output === "object" && !Array.isArray(runDetail.output) && (
                    <section className="resultsSection">
                      <h2 className="sectionTitle">Selected run</h2>
                      <div className="runMetaBar">
                        <span className={`badge ${runDetail.ok ? "badgeOk" : "badgeBad"}`}>{runDetail.ok ? "Output valid" : "Check validity"}</span>
                        <span className="mutedSmall">{new Date(runDetail.createdAt).toLocaleString()}</span>
                        {runDetail.model ? <span className="mutedSmall">{runDetail.model}</span> : null}
                      </div>
                      <InputSnapshotView snapshot={runDetail.inputSnapshot} />
                      <AnalysisSplitView
                        output={runDetail.output as Record<string, unknown>}
                        profile={asRecord(asRecord(runDetail.inputSnapshot)?.profile) ?? profile}
                      />
                    </section>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <div className="modalBackdrop" role="presentation" onClick={() => setShowNew(false)}>
          <div className="modal" role="dialog" onClick={(e) => e.stopPropagation()}>
            <h2>New user</h2>
            <div className="field">
              <label>Display name</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
            </div>
            <div className="rowActions">
              <button type="button" className="btn btnGhost" onClick={() => setShowNew(false)}>
                Cancel
              </button>
              <button type="button" className="btn btnPrimary" disabled={busy || !newName.trim()} onClick={() => void handleCreateUser()}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
