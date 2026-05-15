// ─── AVAILABILITY ENGINE ──────────────────────────────────────────────────────
// Handles live availability checks against the API, with a bounded cache.
// HANDOVER: PMS integrations (ResRequest, Nightsbridge, Opera) plug in here.
// Tier 1 (manual): always returns available, confirmation within 2 hours.
// Tier 3+ (PMS live): real-time check, confirmation within 60 seconds.

import type { AvailResult, AvailOption, AltDate, Hotel } from './types';

// ── Bounded cache — max 200 entries, TTL 10 minutes ───────────────────────────
// Unbounded cache was a bug in the original: it grew forever and was never evicted.
const CACHE_MAX = 200;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes in ms

interface CacheEntry { result: AvailResult; expiresAt: number; }
export const availCache = new Map<string, CacheEntry>();

function cacheKey(supplierId: string, checkIn: string, nights: number, pax: number): string {
  return `${supplierId}:${checkIn}:${nights}:${pax}`;
}

function pruneCache() {
  if (availCache.size < CACHE_MAX) return;
  const now = Date.now();
  // Remove expired entries first
  for (const [k, v] of availCache.entries()) {
    if (v.expiresAt < now) availCache.delete(k);
  }
  // If still over limit, remove oldest (first inserted)
  while (availCache.size >= CACHE_MAX) {
    const firstKey = availCache.keys().next().value;
    if (firstKey) availCache.delete(firstKey);
    else break;
  }
}

// ── Date helpers ──────────────────────────────────────────────────────────────
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayPlusDays(days: number): string {
  return addDays(new Date().toISOString().slice(0, 10), days);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Core availability fetch ───────────────────────────────────────────────────
export async function fetchAvailability(
  supplierId: string,
  checkIn:    string,
  nights:     number,
  pax:        number,
  netRate:    number,
): Promise<AvailResult> {
  const key = cacheKey(supplierId, checkIn, nights, pax);
  const cached = availCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.result;

  const t0 = Date.now();
  try {
    const res = await fetch('/api/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplier_id: supplierId, check_in: checkIn, nights, pax }),
    });
    const data = await res.json();
    const result: AvailResult = {
      supplier_id: supplierId,
      check_in:    checkIn,
      available:   data.available ?? false,
      options:     data.options   ?? [],
      source:      data.source    ?? 'live',
      response_ms: Date.now() - t0,
    };
    pruneCache();
    availCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL });
    return result;
  } catch {
    // API down or timeout — return optimistic demo result (Tier 1 behaviour)
    const demoResult: AvailResult = {
      supplier_id: supplierId,
      check_in: checkIn,
      available: true,
      options: [{
        label: 'Standard Suite',
        available: true,
        rate_zar: netRate,
        display_rate_zar: Math.round(netRate * 1.15),
        meal_basis: 'All-inclusive',
      }],
      source: 'demo',
      response_ms: Date.now() - t0,
    };
    pruneCache();
    availCache.set(key, { result: demoResult, expiresAt: Date.now() + CACHE_TTL });
    return demoResult;
  }
}

// ── Alternative date finder ───────────────────────────────────────────────────
// Checks ±14 days from the requested date to find the closest available window.
// This is the "date arbitrage" engine from the spec.
export async function findAlternativeDate(
  supplierId: string,
  checkIn:    string,
  nights:     number,
  pax:        number,
  netRate:    number,
): Promise<AltDate | null> {
  for (let delta = 1; delta <= 14; delta++) {
    for (const sign of [1, -1]) {
      const candidate = addDays(checkIn, delta * sign);
      try {
        const result = await fetchAvailability(supplierId, candidate, nights, pax, netRate);
        if (result.available) return { date: candidate, delta: delta * sign };
      } catch { continue; }
    }
  }
  return null;
}

// ── Preloader — checks top N hotels before builder screen renders ─────────────
// Runs in background so results appear incrementally (no blocking spinner).
export async function preloadHotels(
  hotels:    Hotel[],
  checkIn:   string,
  nights:    number,
  pax:       number,
  onResult:  (supplierId: string, result: AvailResult) => void,
): Promise<void> {
  const top = hotels.slice(0, 12); // check top 12 only — enough for swipe stack
  await Promise.allSettled(
    top.map(async h => {
      const result = await fetchAvailability(String(h.id), checkIn, nights, pax, h.netRate);
      onResult(String(h.id), result);
    })
  );
}