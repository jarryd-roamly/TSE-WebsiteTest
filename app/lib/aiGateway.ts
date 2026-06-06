// ─── AI GATEWAY ──────────────────────────────────────────────────────────────
// ALL Claude calls go through here. Nothing calls /api/claude directly.
// Cost ceiling: plannerModel (Sonnet) for builds, chatModel (Haiku) for chat.
// HANDOVER: Change models or token limits in EditionConfig, not here.
//
// KB CONTEXT: buildKBContext is now in app/lib/kb.ts.
// The four-tier priority hierarchy (override → commercial → strong → advisory)
// is enforced there. Import and use buildKBContext from kb.ts — never
// re-implement KB injection here.
// ─────────────────────────────────────────────────────────────────────────────

import type { Itinerary, EditionConfig } from './types';
import {
  buildKBContext,
  fetchKBForRegions,
  fetchOverrideEntries,
  type KBEntry,
} from './kb';

// Re-export buildKBContext so existing callers that import from aiGateway
// don't break during the transition. Remove this once all callers are updated.
export { buildKBContext } from './kb';

// Default config — Safari Edition. Overridden by EDITION below.
const DEFAULT_AI = {
  plannerModel:  'claude-sonnet-4-5',
  chatModel:     'claude-haiku-4-5-20251001',
  maxPlanTokens: 1200,
  maxChatTokens: 400,
};

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

// Used by ALL three input modes (Socratic, Builder, My Brief).
// kbContext is now built by buildKBContext from kb.ts — pass it in pre-built.
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
    system: `You are a luxury safari journey designer. You follow instructions exactly.
CRITICAL RULES — never break these:
1. When a specific destination or region is provided, use ONLY that destination. Never add extra destinations.
2. Use ONLY the property names from the supplier list provided. Never invent or substitute properties.
3. Total nights across all cities must exactly match the number specified. Not one more, not one less.
4. If one destination is specified, that destination gets ALL the nights. One city in the response.
5. Respond ONLY with the requested JSON structure. No markdown, no backticks, no explanation, no preamble.`,
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

/**
 * Build KB context and run the planner in one call.
 * Convenience wrapper used by build-itinerary route.
 * Fetches KB from Supabase, builds context with full priority hierarchy,
 * then runs the planner.
 */
export async function runPlannerWithKB(params: {
  promptBody:   string;
  regions:      string[];
  editionId?:   string;
  ai?:          typeof DEFAULT_AI;
}): Promise<Itinerary> {
  const editionId = params.editionId ?? 'safari';

  // Fetch KB entries for the journey's regions
  const entries = await fetchKBForRegions(params.regions, editionId);

  // Build context with full four-tier priority hierarchy
  const kbContext = buildKBContext(entries, params.regions, editionId);

  return runPlannerEngine({
    kbContext,
    promptBody: params.promptBody,
    ai:         params.ai,
  });
}

// Cheap factual Q&A — visa, weather, packing. Haiku, 400 tokens max.
export async function answerFactual(
  question: string,
  city:     string,
  ai        = DEFAULT_AI
): Promise<string> {
  const content = await callAI({
    model:      ai.chatModel,
    max_tokens: ai.maxChatTokens,
    messages: [{
      role:    'user',
      content: `Safari specialist. Answer warmly in 2 sentences max: "${question}". Context: ${city}.`,
    }],
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
      city:          c.city,
      country:       c.country,
      nights:        c.nights,
      hotelRate:     c.hotelRate,
      estimatedCost: c.estimatedCost,
      flightCost:    c.flightCost    || 0,
      transferCost:  c.transferCost  || 0,
      activityCost:  c.activityCost  || 0,
    })),
    totalEstimate: params.itinerary.totalEstimate,
  });
  const content = await callAI({
    model:      ai.chatModel,
    max_tokens: 600,
    messages: [{
      role:    'user',
      content: `Safari itinerary editor. Current: ${ctx}\nRequest: "${params.message}"\nBudget: R${Math.round(params.budget).toLocaleString()}, Nights: ${params.nights}\n\nReturn ONLY JSON diff (no markdown):\n{"reply":"1 sentence","cities":[ONLY_CHANGED_CITIES],"totalEstimate":NEW_TOTAL}\nOnly changed cities. Keep existing fields.`,
    }],
  });
  const diff = parseJSON<any>(getText(content));
  return diff ?? { reply: getText(content) || 'Done.' };
}

// General specialist chat (floating drawer)
export async function chatWithSpecialist(
  question: string,
  ai        = DEFAULT_AI
): Promise<string> {
  const content = await callAI({
    model:      ai.plannerModel,
    max_tokens: Math.min(ai.maxPlanTokens, 600),
    messages: [{
      role:    'user',
      content: `You are a luxury safari specialist at The Safari Edition. Be warm, knowledgeable, concise. Question: ${question}`,
    }],
  });
  return getText(content) || 'Happy to help.';
}
