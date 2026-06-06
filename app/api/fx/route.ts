import { NextResponse } from 'next/server';

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY  = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const FX_API_KEY    = process.env.EXCHANGE_RATE_API_KEY;
const SPREAD_BUFFER = 0.015;
const CACHE_TTL_MS  = 60 * 60 * 1000;

let memCache: { rates: FxRates; fetchedAt: number } | null = null;

export interface FxRates {
  USD_ZAR:     number;
  EUR_ZAR:     number;
  GBP_ZAR:     number;
  USD_ZAR_mid: number;
  EUR_ZAR_mid: number;
  GBP_ZAR_mid: number;
  source:      string;
  fetched_at:  string;
}

const FALLBACK_RATES: FxRates = {
  USD_ZAR:     18.90,
  EUR_ZAR:     20.44,
  GBP_ZAR:     23.83,
  USD_ZAR_mid: 18.62,
  EUR_ZAR_mid: 20.14,
  GBP_ZAR_mid: 23.48,
  source:      'fallback',
  fetched_at:  new Date().toISOString(),
};

async function fetchLiveRates(): Promise<FxRates | null> {
  try {
    const url = FX_API_KEY
      ? `https://v6.exchangerate-api.com/v6/${FX_API_KEY}/latest/ZAR`
      : `https://api.exchangerate-api.com/v4/latest/ZAR`;

    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();

    const usdMid = 1 / (data.rates?.USD ?? (1 / 18.62));
    const eurMid = 1 / (data.rates?.EUR ?? (1 / 20.14));
    const gbpMid = 1 / (data.rates?.GBP ?? (1 / 23.48));

    return {
      USD_ZAR:     +(usdMid * (1 + SPREAD_BUFFER)).toFixed(4),
      EUR_ZAR:     +(eurMid * (1 + SPREAD_BUFFER)).toFixed(4),
      GBP_ZAR:     +(gbpMid * (1 + SPREAD_BUFFER)).toFixed(4),
      USD_ZAR_mid: +usdMid.toFixed(4),
      EUR_ZAR_mid: +eurMid.toFixed(4),
      GBP_ZAR_mid: +gbpMid.toFixed(4),
      source:      'exchangerate-api',
      fetched_at:  new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function fetchFromSupabaseCache(): Promise<FxRates | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/fx_rates_cache?base_currency=eq.ZAR&order=fetched_at.desc&limit=3`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    if (!res.ok) return null;
    const rows: any[] = await res.json();
    if (!rows.length) return null;

    const usdRow = rows.find(r => r.quote_currency === 'USD');
    const eurRow = rows.find(r => r.quote_currency === 'EUR');
    const gbpRow = rows.find(r => r.quote_currency === 'GBP');
    if (!usdRow) return null;

    return {
      USD_ZAR:     +(usdRow.display_rate),
      EUR_ZAR:     +(eurRow?.display_rate ?? FALLBACK_RATES.EUR_ZAR),
      GBP_ZAR:     +(gbpRow?.display_rate ?? FALLBACK_RATES.GBP_ZAR),
      USD_ZAR_mid: +(usdRow.mid_rate),
      EUR_ZAR_mid: +(eurRow?.mid_rate ?? FALLBACK_RATES.EUR_ZAR_mid),
      GBP_ZAR_mid: +(gbpRow?.mid_rate ?? FALLBACK_RATES.GBP_ZAR_mid),
      source:      'supabase_cache',
      fetched_at:  usdRow.fetched_at,
    };
  } catch {
    return null;
  }
}

async function persistToSupabase(rates: FxRates) {
  const validUntil = new Date(Date.now() + CACHE_TTL_MS).toISOString();
  const rows = [
    { base_currency:'ZAR', quote_currency:'USD', mid_rate:rates.USD_ZAR_mid, spread_buffer:SPREAD_BUFFER, source:rates.source, valid_until:validUntil },
    { base_currency:'ZAR', quote_currency:'EUR', mid_rate:rates.EUR_ZAR_mid, spread_buffer:SPREAD_BUFFER, source:rates.source, valid_until:validUntil },
    { base_currency:'ZAR', quote_currency:'GBP', mid_rate:rates.GBP_ZAR_mid, spread_buffer:SPREAD_BUFFER, source:rates.source, valid_until:validUntil },
  ];
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/fx_rates_cache`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    });
  } catch { /* non-critical */ }
}

export async function GET() {
  if (memCache && Date.now() - memCache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ ...memCache.rates, cache: 'memory' });
  }

  const live = await fetchLiveRates();
  if (live) {
    memCache = { rates: live, fetchedAt: Date.now() };
    persistToSupabase(live);
    return NextResponse.json({ ...live, cache: 'live' });
  }

  const cached = await fetchFromSupabaseCache();
  if (cached) {
    memCache = { rates: cached, fetchedAt: Date.now() };
    return NextResponse.json({ ...cached, cache: 'supabase' });
  }

  return NextResponse.json({ ...FALLBACK_RATES, cache: 'fallback' });
}
