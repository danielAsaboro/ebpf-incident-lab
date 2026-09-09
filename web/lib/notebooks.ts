"use client";
import { useMemo, useSyncExternalStore } from "react";
import { labs } from "./labs";
export type Phase = "predict" | "observe" | "explain" | "transfer" | "complete";
export type RunnerEvent = { sequence: number; kind: string; timestamp: number; data: string };
export type Notebook = { labId: string; source: "hosted" | "local"; phase: Phase; prediction: string; explanation: string; choice: number | null; events: RunnerEvent[]; localEvidence?: string; sessionId?: string; runState: string; updatedAt: string };
const key = "incident-lab:notebooks:v1";
const eventName = "incident-notebooks-changed";
function snapshot() { try { return window.localStorage.getItem(key) ?? "{}"; } catch { return "{}"; } }
function parse(raw: string): Record<string, Notebook> {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([id, candidate]) => {
      const n = candidate as Notebook;
      return labs.some(lab => lab.id === id) && n && n.labId === id && ["hosted", "local"].includes(n.source) && ["predict", "observe", "explain", "transfer", "complete"].includes(n.phase) && typeof n.prediction === "string" && typeof n.explanation === "string" && typeof n.runState === "string" && typeof n.updatedAt === "string" && Number.isFinite(Date.parse(n.updatedAt)) && (n.choice === null || Number.isInteger(n.choice)) && (n.localEvidence === undefined || typeof n.localEvidence === "string") && Array.isArray(n.events) && n.events.every(e => e && typeof e.data === "string" && typeof e.kind === "string" && Number.isFinite(e.sequence) && Number.isFinite(e.timestamp));
    })) as Record<string, Notebook>;
  } catch { return {}; }
}
export function readNotebook(id: string) { return parse(snapshot())[id]; }
export function saveNotebook(notebook: Notebook) {
  try { window.localStorage.setItem(key, JSON.stringify({ ...parse(snapshot()), [notebook.labId]: notebook })); window.dispatchEvent(new Event(eventName)); return true; } catch { return false; }
}
export function removeNotebook(id: string) {
  try { const notes = parse(snapshot()); delete notes[id]; window.localStorage.setItem(key, JSON.stringify(notes)); window.dispatchEvent(new Event(eventName)); return true; } catch { return false; }
}
function subscribe(callback: () => void) { window.addEventListener("storage", callback); window.addEventListener(eventName, callback); return () => { window.removeEventListener("storage", callback); window.removeEventListener(eventName, callback); }; }
export function useNotebooks() { const raw = useSyncExternalStore(subscribe, snapshot, () => "{}"); return useMemo(() => parse(raw), [raw]); }
export function downloadNotebook(note: Notebook) {
  const lab = labs.find(item => item.id === note.labId)!;
  const content = [`# Incident ${lab.id}: ${lab.title}`, `Evidence source: ${note.source === "local" ? "User-provided local output; not verified by this application" : "Saved hosted runner events; not a current live run"}`, `Session: ${note.sessionId ?? "local notebook"}`, `Hook: ${lab.hook}`, `Saved: ${note.updatedAt}`, "## Prediction", note.prediction, "## Evidence", note.source === "local" ? note.localEvidence ?? "No output recorded." : note.events.map(e => `${new Date(e.timestamp * 1000).toISOString()} [${e.kind}] ${e.data}`).join("\n"), "## Interpretation", note.explanation, "## Limits", ...lab.limits].join("\n\n");
  const url = URL.createObjectURL(new Blob([content], { type: "text/markdown" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `incident-${lab.id}-notebook.md`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
