// app/lib/airlines.ts
// Airline data access — logos, baggage rules, Duffel flags
// Used by journey tile component to resolve carrier logos and baggage display

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export type AirlineType = 'commercial_scheduled' | 'charter_safari' | 'helicopter';

export interface Airline {
  id:                    string;
  iata_code:             string;
  icao_code:             string | null;
  name:                  string;
  short_name:            string | null;
  logo_url:              string | null;   // Cloudflare R2 public URL
  logo_white_url:        string | null;   // White version for dark backgrounds
  logo_updated_at:       string | null;
  airline_type:          AirlineType;
  is_duffel:             boolean;
  is_active:             boolean;
  baggage_standard_kg:   number;
  baggage_hard_case:     boolean;
  baggage_upgrade_label: string | null;
  baggage_upgrade_kg:    number | null;
  baggage_upgrade_pct:   number | null;
  baggage_carryon_kg:    number;
  ops_note:              string | null;
  duffel_note:           string | null;
}

// ── In-memory cache — avoids repeated Supabase calls per render ───────────────
let _cache: Map<string, Airline> | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getCache(): Promise<Map<string, Airline>> {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL_MS) return _cache;

  const { data, error } = await supabase
    .from('airlines')
    .select('*')
    .eq('is_active', true);

  if (error) throw new Error(`Failed to load airlines: ${error.message}`);

  _cache = new Map((data || []).map(a => [a.iata_code, a as Airline]));
  _cacheTime = now;
  return _cache;
}

// ── Get single airline by IATA ────────────────────────────────────────────────
export async function getAirline(iata: string): Promise<Airline | null> {
  const cache = await getCache();
  return cache.get(iata.toUpperCase()) ?? null;
}

// ── Get all airlines ──────────────────────────────────────────────────────────
export async function getAllAirlines(): Promise<Airline[]> {
  const cache = await getCache();
  return Array.from(cache.values());
}

// ── Get logo URL for IATA code ────────────────────────────────────────────────
// Returns colour logo by default, white logo if variant = 'white'
// Falls back to null if not set (UI should show IATA badge)
export async function getAirlineLogo(
  iata: string,
  variant: 'colour' | 'white' = 'colour'
): Promise<string | null> {
  const airline = await getAirline(iata);
  if (!airline) return null;
  return variant === 'white' ? airline.logo_white_url : airline.logo_url;
}

// ── Baggage summary string ────────────────────────────────────────────────────
// Returns display-ready string for use in tile detail line
// e.g. "20kg · hard cases ok" or "20kg soft bag only · X Class 32kg available"
export function baggageSummary(airline: Airline): string {
  const parts: string[] = [];
  parts.push(`${airline.baggage_standard_kg}kg`);

  if (!airline.baggage_hard_case) {
    parts.push('soft bag only');
  }

  if (airline.baggage_upgrade_label && airline.baggage_upgrade_kg) {
    parts.push(`${airline.baggage_upgrade_label} ${airline.baggage_upgrade_kg}kg available`);
  }

  return parts.join(' · ');
}

// ── Baggage warning — for tile warn pill ─────────────────────────────────────
// Returns a warning string if the airline has restrictions, null if no warning needed
export function baggageWarning(airline: Airline): string | null {
  if (!airline.baggage_hard_case) {
    return `Soft bag only (${airline.baggage_standard_kg}kg) — no hard cases`;
  }
  return null;
}

// ── Resolve multiple airlines at once ────────────────────────────────────────
// Pass array of IATA codes, get back a map — efficient for tile rendering
export async function resolveAirlines(iataCodes: string[]): Promise<Record<string, Airline>> {
  const cache = await getCache();
  const result: Record<string, Airline> = {};
  for (const code of iataCodes) {
    const airline = cache.get(code.toUpperCase());
    if (airline) result[code.toUpperCase()] = airline;
  }
  return result;
}

// ── Static fallback map ───────────────────────────────────────────────────────
// Used when Supabase is unavailable or during SSR without await
// Keeps tiles rendering even if DB call fails
export const AIRLINE_FALLBACKS: Record<string, { name: string; short: string }> = {
  '4Z': { name: 'Airlink',               short: 'Airlink'    },
  'FA': { name: 'Federal Airlines',      short: 'FedAir'     },
  'FR': { name: 'FlySafair',             short: 'FlySafair'  },
  '5Z': { name: 'CemAir',               short: 'CemAir'     },
  'SA': { name: 'South African Airways', short: 'SAA'        },
  'FN': { name: 'Fastjet Zimbabwe',      short: 'Fastjet'    },
  'BP': { name: 'Air Botswana',          short: 'Air Botswana'},
  'KQ': { name: 'Kenya Airways',         short: 'Kenya Air'  },
  'ET': { name: 'Ethiopian Airlines',    short: 'Ethiopian'  },
  'WA': { name: 'Wilderness Air',        short: 'Wilderness' },
  'MK': { name: 'Mack Air',             short: 'Mack Air'   },
  'UC': { name: 'United Air Charters',   short: 'United Air' },
  'HH': { name: 'Helicopter Horizons',   short: 'Heli Horizons'},
};
