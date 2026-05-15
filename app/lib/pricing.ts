// ─── PRICING UTILITIES ───────────────────────────────────────────────────────
// Pure functions. No React, no side effects. Fully testable.
// HANDOVER: All margin logic lives here. Never calculate margins inline in components.

import type { Hotel, PropertyStay, UpgradeOption } from './types';

// ── Currency formatter factory ────────────────────────────────────────────────
// Returns a formatter function. Call once per currency change, not per render.
export function makeFmt(symbol: string, rate: number) {
  return (zarAmount: number) => {
    const converted = zarAmount / rate;
    if (converted >= 1_000_000) return `${symbol}${(converted / 1_000_000).toFixed(1)}M`;
    if (converted >= 1_000)     return `${symbol}${Math.round(converted / 1_000)}k`;
    return `${symbol}${Math.round(converted).toLocaleString()}`;
  };
}

// ── Destination matcher ───────────────────────────────────────────────────────
// Maps AI city names → Supabase destination values.
// To add Edition 2 destinations: extend this map only.
const DESTINATION_MAP: Record<string, string> = {
  'sabi sand':        'Kruger / Sabi Sand',
  'singita sabi':     'Kruger / Sabi Sand',
  'kruger':           'Kruger / Sabi Sand',
  'sabi sands':       'Kruger / Sabi Sand',
  'londolozi':        'Kruger / Sabi Sand',
  'okavango':         'Okavango Delta',
  'okavango delta':   'Okavango Delta',
  'delta':            'Okavango Delta',
  'cape town':        'Cape Town',
  'cape':             'Cape Town',
  'madikwe':          'Madikwe',
  'victoria falls':   'Victoria Falls',
  'vic falls':        'Victoria Falls',
  'masai mara':       'Masai Mara',
  'mara':             'Masai Mara',
  'serengeti':        'Serengeti',
  'ngorongoro':       'Ngorongoro',
  'zanzibar':         'Zanzibar',
  'bazaruto':         'Bazaruto',
  'seychelles':       'Seychelles',
  'maldives':         'Maldives',
  'bwindi':           'Bwindi / Uganda',
  'gorilla':          'Bwindi / Uganda',
  'rwanda':           'Rwanda',
  'tswalu':           'Northern Cape',
  'kalahari':         'Northern Cape',
};

export function matchDestination(city: string): string | null {
  const lower = city.toLowerCase();
  for (const [key, val] of Object.entries(DESTINATION_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

// ── Resolve hotel upgrades ────────────────────────────────────────────────────
// Matches traveller preferences (tier numbers) to available upgrade options.
// Returns resolved options and a list of fields where the preferred tier wasn't available.
export function resolveHotelUpgrades(
  hotel: Hotel,
  prefs: Record<string, number>
): { resolved: Record<string, UpgradeOption>; mismatches: string[] } {
  const resolved: Record<string, UpgradeOption> = {};
  const mismatches: string[] = [];

  for (const [key, prefTier] of Object.entries(prefs)) {
    const opts = (hotel.upgrades as any)[key] as UpgradeOption[] | undefined;
    if (!opts?.length) continue;
    const exact = opts.find(o => o.tier === prefTier);
    const below = [...opts].reverse().find(o => o.tier <= prefTier);
    const match = exact ?? below ?? opts[0];
    resolved[key] = match;
    if (!exact && prefTier > 0) mismatches.push(key);
  }

  return { resolved, mismatches };
}

// ── Total with margins ────────────────────────────────────────────────────────
// Takes net components and applies Edition margins.
// margins come from EditionConfig.margins — never hardcoded.
export function calculateTotal(params: {
  hotelNet:    number;
  flightNet:   number;
  intlNet:     number;
  transferNet: number;
  activityNet: number;
  margins: {
    hotels: number; flights: number; intl: number; transfers: number; activities: number;
  };
}): number {
  const { hotelNet, flightNet, intlNet, transferNet, activityNet, margins: M } = params;
  return Math.round(
    hotelNet    * M.hotels    +
    flightNet   * M.flights   +
    intlNet     * M.intl      +
    transferNet * M.transfers +
    activityNet * M.activities
  );
}