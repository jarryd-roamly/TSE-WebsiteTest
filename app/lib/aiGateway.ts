// ─── AI GATEWAY ──────────────────────────────────────────────────────────────
// ALL Claude calls go through here. Nothing calls /api/claude directly.
// Cost ceiling: plannerModel (Sonnet) for builds, chatModel (Haiku) for chat.
// HANDOVER: Change models or token limits in EditionConfig, not here.

import type { KBEntry, Itinerary, EditionConfig } from './types';

// Default config — Safari Edition. Overridden by EDITION below.
const DEFAULT_AI = {
  plannerModel:  'claude-sonnet-4-20250514',
  chatModel:     'claude-haiku-4-5-20251001',
  maxPlanTokens: 1200,
  maxChatTokens: 400,
};

// ── KB Injection ──────────────────────────────────────────────────────────────
// One canonical format. If the injection format changes, it changes here only.
// Entries filtered by edition_id — an Edition only sees its own KB.
export function buildKBContext(entries: KBEntry[], selectedIds: string[], editionId: string): string {
  const active = entries.filter(e =>
    selectedIds.includes(e.id) && e.active && e.edition_id === editionId
  );
  if (!active.length) return '';
  const lines = [
    '=== PRIORITY KNOWLEDGE BASE — USE OVER GENERAL KNOWLEDGE ===',
    'Verified by our safari specialists. Prioritise over web search.\n',
  ];
  for (const e of active) {
    lines.push(`--- ${e.title.toUpperCase()} ---`);
    for (const [k, v] of Object.entries(e.structuredFields)) {
      lines.push(`${k.replace(/_/g,' ').toUpperCase()}: ${v}`);
    }
    if (e.specialistNotes) lines.push(`SPECIALIST NOTES: ${e.specialistNotes}`);
    lines.push('');
  }
  lines.push('=== END KNOWLEDGE BASE ===\n');
  return lines.join('\n');
}

// ── Core fetch wrapper ────────────────────────────────────────────────────────
async function callAI(body: object): Promise<any[]> {
  const res = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`AI API ${res.status}`);
  const data = await res.json();
  return data.content ?? [];
}

function getText(content: any[]): string {
  return content.filter(b => b.type === 'text').map(b => b.text).join('');
}

function parseJSON<T>(text: string): T | null {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s === -1 || e <= s) return null;
  try { return JSON.parse(text.slice(s, e + 1)); } catch { return null; }
}

// ── Public API ─────────────────────────────────────────────────────────────────

// Used by ALL three input modes (Socratic, Builder, My Brief)
// The prompt changes by mode — the JSON output schema is identical.
export async function runPlannerEngine(params: {
  kbContext:    string;
  promptBody:   string;   // mode-specific context, pre-built by caller
  ai?:          typeof DEFAULT_AI;
}): Promise<Itinerary> {
  const ai = params.ai ?? DEFAULT_AI;
  const content = await callAI({
    model: ai.plannerModel,
    max_tokens: ai.maxPlanTokens,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{
      role: 'user',
      content: `${params.kbContext}${params.promptBody}

Respond ONLY in this JSON (no markdown, no backticks):
{"title":"","summary":"","routing":"","bestTiming":"","briefInterpretation":"","cities":[{"city":"","country":"","nights":0,"why":"","highlights":[""],"estimatedCost":0,"hotelRate":0,"flightCost":0,"transferCost":0,"activityCost":0,"arrivalGap":"","departureGap":""}],"totalEstimate":0,"aiInsights":[""],"warnings":[""]}`,
    }],
  });
  const parsed = parseJSON<Itinerary>(getText(content));
  if (!parsed) throw new Error('No JSON in planner response');
  return parsed;
}

// Cheap factual Q&A — visa, weather, packing. Haiku, 400 tokens max.
export async function answerFactual(question: string, city: string, ai = DEFAULT_AI): Promise<string> {
  const content = await callAI({
    model: ai.chatModel,
    max_tokens: ai.maxChatTokens,
    messages: [{ role: 'user', content: `Safari specialist. Answer warmly in 2 sentences max: "${question}". Context: ${city}.` }],
  });
  return getText(content) || 'Happy to help with that.';
}

// Creative itinerary diff — returns only changed cities. Haiku, 600 tokens.
export async function applyCreativeDiff(params: {
  message:   string;
  itinerary: Itinerary;
  budget:    number;
  nights:    number;
  ai?:       typeof DEFAULT_AI;
}): Promise<{ reply: string; cities?: any[]; totalEstimate?: number }> {
  const ai = params.ai ?? DEFAULT_AI;
  const ctx = JSON.stringify({
    cities: params.itinerary.cities.map(c => ({
      city: c.city, country: c.country, nights: c.nights,
      hotelRate: c.hotelRate, estimatedCost: c.estimatedCost,
      flightCost: c.flightCost || 0, transferCost: c.transferCost || 0, activityCost: c.activityCost || 0,
    })),
    totalEstimate: params.itinerary.totalEstimate,
  });
  const content = await callAI({
    model: ai.chatModel,
    max_tokens: 600,
    messages: [{ role: 'user', content: `Safari itinerary editor. Current: ${ctx}\nRequest: "${params.message}"\nBudget: R${Math.round(params.budget).toLocaleString()}, Nights: ${params.nights}\n\nReturn ONLY JSON diff (no markdown):\n{"reply":"1 sentence","cities":[ONLY_CHANGED_CITIES],"totalEstimate":NEW_TOTAL}\nOnly changed cities. Keep existing fields.` }],
  });
  const diff = parseJSON<any>(getText(content));
  return diff ?? { reply: getText(content) || 'Done.' };
}

// General specialist chat (floating drawer)
export async function chatWithSpecialist(question: string, ai = DEFAULT_AI): Promise<string> {
  const content = await callAI({
    model: ai.plannerModel,
    max_tokens: Math.min(ai.maxPlanTokens, 600),
    messages: [{ role: 'user', content: `You are a luxury safari specialist at The Safari Edition. Be warm, knowledgeable, concise. Question: ${question}` }],
  });
  return getText(content) || 'Happy to help.';
}