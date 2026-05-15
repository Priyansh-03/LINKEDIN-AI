import type { LinkedinPdfParseResponse } from "./types";

const API = "/api/studio";

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    return JSON.stringify(j.detail ?? j);
  } catch {
    return await res.text();
  }
}

export async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}

export async function postJSON<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}

export async function putJSON<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<T>;
}

export async function deleteJSON(path: string): Promise<void> {
  const res = await fetch(`${API}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function postLinkedinProfilePdf(userId: string, file: File): Promise<LinkedinPdfParseResponse> {
  const fd = new FormData();
  fd.append("file", file, file.name);
  const res = await fetch(`${API}/users/${encodeURIComponent(userId)}/profile/parse-linkedin-pdf`, {
    method: "POST",
    body: fd,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<LinkedinPdfParseResponse>;
}
