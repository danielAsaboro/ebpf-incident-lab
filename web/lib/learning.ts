"use client";
import { useMemo, useSyncExternalStore } from "react";
import { labs } from "./labs";
import type { RunnerEvent } from "./notebooks";
export type { RunnerEvent } from "./notebooks";
export type LearningPhase = "readiness" | "predict" | "observe" | "explain" | "transfer" | "review";
export type Attempt = { stage: string; at: string; value: unknown; assisted: boolean };
export type HintUse = { index: number; phase: LearningPhase; at: string };
export type RunReceipt = { scenario: string; sessionId?: string; status: string; events: RunnerEvent[]; at: string };
export type LearningRecord = {
  version: 2; labId: string; phase: LearningPhase; source: "hosted" | "local";
  readiness: { answer: number | null; checked: boolean; correct: boolean };
  prediction: { hypothesis: number | null; evidence: string };
  events: RunnerEvent[]; runHistory?: RunReceipt[]; transferSessionId?: string; recallSessionId?: string; transferRunState?: string; recallRunState?: string; transferEvents?: RunnerEvent[]; recallEvents?: RunnerEvent[]; citations: number[]; reasoning: { claim: string; mechanism: string; unknown: string; nextStep: string };
  transfer: { answer: string; assisted: boolean; outsideHelp?: boolean; submittedAt?: string }; recall: { answer: string; assisted?: boolean; outsideHelp?: boolean; submittedAt?: string };
  assistance?: { phase: LearningPhase; kind: string; at: string }[]; attempts: Attempt[]; hints: HintUse[]; runState: string; sessionId?: string; updatedAt: string; reviewDueAt?: string; legacy?: unknown;
};
export const learningStorageKey = "incident-lab:learning:v2";
const legacyKey = "incident-lab:notebooks:v1";
const changed = "incident-learning-changed";
export function newLearningRecord(labId: string): LearningRecord {
  return { version: 2, labId, phase: "readiness", source: labs.find(l=>l.id===labId)?.hosted ? "hosted" : "local", readiness: {answer:null,checked:false,correct:false}, prediction:{hypothesis:null,evidence:""}, events:[],citations:[],reasoning:{claim:"",mechanism:"",unknown:"",nextStep:""},transfer:{answer:"",assisted:false},recall:{answer:""},attempts:[],hints:[],runState:"idle",updatedAt:new Date().toISOString() };
}
export function parseRunnerEvent(raw: string): RunnerEvent | null {
  try { const e = JSON.parse(raw); return e && Number.isSafeInteger(e.sequence) && e.sequence >= 0 && Number.isFinite(e.timestamp) && Math.abs(e.timestamp) < 8.64e12 && ["status","observation","diagnostic","terminal"].includes(e.kind) && typeof e.data === "string" ? e : null; } catch { return null; }
}
function object(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
export function parseLearningRecords(raw: string): Record<string, LearningRecord> {
  try { const all: unknown = JSON.parse(raw); if(!object(all)) return {}; return Object.fromEntries(Object.entries(all).filter(([id,n])=> {
    if(!object(n) || !labs.some(l=>l.id===id) || n.version!==2 || n.labId!==id || !["readiness","predict","observe","explain","transfer","review"].includes(String(n.phase)) || !["hosted","local"].includes(String(n.source))) return false;
    if(!object(n.readiness)||!object(n.prediction)||!object(n.reasoning)||!object(n.transfer)||!object(n.recall)) return false;
    return (n.readiness.answer===null || Number.isInteger(n.readiness.answer)) && typeof n.readiness.checked==='boolean' && typeof n.readiness.correct==='boolean' && (n.prediction.hypothesis===null||Number.isInteger(n.prediction.hypothesis)) && typeof n.prediction.evidence==='string' && ['claim','mechanism','unknown','nextStep'].every(k=>typeof (n.reasoning as Record<string,unknown>)[k]==='string') && typeof n.transfer.answer==='string' && typeof n.transfer.assisted==='boolean' && typeof n.recall.answer==='string' && Array.isArray(n.events)&&n.events.every(e=>parseRunnerEvent(JSON.stringify(e))) && Array.isArray(n.citations)&&n.citations.every(Number.isSafeInteger) && Array.isArray(n.attempts)&&n.attempts.every(a=>object(a)&&typeof a.stage==='string'&&typeof a.at==='string'&&typeof a.assisted==='boolean') && Array.isArray(n.hints)&&n.hints.every(h=>object(h)&&Number.isInteger(h.index)&&typeof h.at==='string'&&typeof h.phase==='string') && ['transferEvents','recallEvents'].every(k=>n[k]===undefined||(Array.isArray(n[k])&&(n[k] as unknown[]).every(e=>parseRunnerEvent(JSON.stringify(e))))) && ['sessionId','transferSessionId','recallSessionId','transferRunState','recallRunState'].every(k=>n[k]===undefined||typeof n[k]==='string') && (n.runHistory===undefined||(Array.isArray(n.runHistory)&&n.runHistory.every(h=>object(h)&&typeof h.scenario==='string'&&typeof h.status==='string'&&typeof h.at==='string'&&(h.sessionId===undefined||typeof h.sessionId==='string')&&Array.isArray(h.events)&&h.events.every(e=>parseRunnerEvent(JSON.stringify(e)))))) && [n.transfer.outsideHelp,n.recall.outsideHelp,n.recall.assisted].every(b=>b===undefined||typeof b==='boolean') && (n.reviewDueAt===undefined||(typeof n.reviewDueAt==='string'&&Number.isFinite(Date.parse(n.reviewDueAt)))) && [n.transfer.submittedAt,n.recall.submittedAt].every(d=>d===undefined||(typeof d==='string'&&Number.isFinite(Date.parse(d)))) && (n.assistance===undefined||(Array.isArray(n.assistance)&&n.assistance.every(a=>object(a)&&typeof a.phase==='string'&&typeof a.kind==='string'&&typeof a.at==='string'))) && typeof n.runState==='string' && typeof n.updatedAt==='string' && Number.isFinite(Date.parse(n.updatedAt));
  })) as Record<string,LearningRecord>; } catch { return {}; }
}
function rawSnapshot() { try { return window.localStorage.getItem(learningStorageKey) ?? "{}"; } catch { return "{}"; } }
function legacySnapshot() { try { return window.localStorage.getItem(legacyKey) ?? "{}"; } catch { return "{}"; } }
export function migrateLegacy(raw: string): Record<string, LearningRecord> {
  try { const old:unknown=JSON.parse(raw); if(!object(old))return {}; return Object.fromEntries(Object.entries(old).filter(([id,n])=>labs.some(l=>l.id===id)&&object(n)).map(([id,n])=>[id,{...newLearningRecord(id),legacy:n,updatedAt:object(n)&&typeof n.updatedAt==='string'&&Number.isFinite(Date.parse(n.updatedAt))?n.updatedAt:new Date(0).toISOString()}])); } catch {return {};}
}
function merged(raw: string, legacy: string) { return {...migrateLegacy(legacy),...parseLearningRecords(raw)}; }
export function readLearningRecord(id: string) { const n=merged(rawSnapshot(),legacySnapshot())[id]; if(!n)return n; const state=(s:string|undefined)=>s&&['running','connecting','queued'].includes(s)?'interrupted':s; return {...n,runState:state(n.runState)!,transferRunState:state(n.transferRunState),recallRunState:state(n.recallRunState)}; }
export function saveLearningRecord(record: LearningRecord) { try { window.localStorage.setItem(learningStorageKey, JSON.stringify({...merged(rawSnapshot(),legacySnapshot()),[record.labId]:record})); window.dispatchEvent(new Event(changed)); return true; } catch{return false;} }
export function deleteLearningRecord(id: string) { try { const all=merged(rawSnapshot(),legacySnapshot()); delete all[id]; window.localStorage.setItem(learningStorageKey,JSON.stringify(all)); const old=JSON.parse(legacySnapshot()); if(object(old)){delete old[id]; window.localStorage.setItem(legacyKey,JSON.stringify(old));} window.dispatchEvent(new Event(changed)); return true;}catch{return false;} }
function subscribe(cb:()=>void) {window.addEventListener(changed,cb);window.addEventListener("storage",cb);return()=>{window.removeEventListener(changed,cb);window.removeEventListener("storage",cb);};}
export function useLearningRecords(){const raw=useSyncExternalStore(subscribe,rawSnapshot,()=>"{}");const legacy=useSyncExternalStore(subscribe,legacySnapshot,()=>"{}");return useMemo(()=>merged(raw,legacy),[raw,legacy]);}
export function explanationComplete(n:LearningRecord) {return Object.values(n.reasoning).every(s=>s.trim().length>0)&&n.citations.some(s=>n.events.some(e=>e.sequence===s&&(e.kind==='observation'||e.kind==='diagnostic')));}
export function learningStatus(n:LearningRecord) {return n.recall.submittedAt?"Recall recorded · review needed":n.transfer.submittedAt?`${n.transfer.assisted||n.transfer.outsideHelp?'Help recorded':'No in-app help recorded'} transfer · review needed`:n.legacy&&n.attempts.length===0?"Legacy notebook · readiness available":"Investigation in progress";}
export function downloadLearningRecord(record:LearningRecord){const url=URL.createObjectURL(new Blob([JSON.stringify(record,null,2)],{type:"application/json"}));const a=document.createElement('a');a.href=url;a.download=`incident-${record.labId}-learning-v2.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
