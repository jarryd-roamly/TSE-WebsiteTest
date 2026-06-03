// ─── BRIEF EXTRACTOR ──────────────────────────────────────────────────────────
// Replaces the regex-based detection in MyBriefScreen.
// Splits travel intent into 6 INDEPENDENT categories — each with a confidence score.
// Powered by Haiku (cheap, fast, ~30ms typical) — no Sonnet for extraction.
//
// Returns structured fields the UI can use to:
//   1. Light up the correct category checkboxes (party/occasion/style/etc)
//   2. Generate follow-up questions for missing high-value fields
//   3. Feed personalised loading messages into the cinematic spinner
//   4. Populate the BuildRequest for /api/build-itinerary
// ─────────────────────────────────────────────────────────────────────────────

export interface ExtractedField<T> {
  value:      T | null;
  confidence: number;   // 0–1: how sure the extractor is
  source:     'explicit' | 'inferred' | 'absent';
}

export interface BriefExtraction {
  party:        ExtractedField<'family'|'couple'|'solo'|'friends'|'group'|'multigenerational'>;
  occasion:     ExtractedField<'honeymoon'|'anniversary'|'birthday'|'babymoon'|'retirement'|'graduation'|'none'>;
  style:        ExtractedField<'adventure'|'wildlife'|'photography'|'conservation'|'romantic'|'luxury'|'cultural'|'mixed'>;
  duration:     ExtractedField<number>;  // nights
  budget:       ExtractedField<number>;  // ZAR equivalent
  destinations: ExtractedField<string[]>;  // region slugs
  travelDates:  ExtractedField<string>;   // 'June 2026' or '2026-06' style
  partySize: {
    adults:   ExtractedField<number>;
    children: ExtractedField<number>;
    infants:  ExtractedField<number>;
  };
  themes: string[];   // tag keywords for KB matching and property scoring
  followUps: string[]; // generated questions for missing/low-confidence fields
  rawBrief: string;
}

// ── Confidence thresholds ────────────────────────────────────────────────────
export const CONFIDENT  = 0.7;   // UI checkbox lights up at this level
export const MAYBE      = 0.4;   // UI shows muted indicator
export const ABSENT     = 0.0;

// ── Regex pre-pass (instant, no AI cost) ─────────────────────────────────────
// Used to short-circuit obvious cases before calling Haiku.
// Also extracts numerical values that AI sometimes hallucinates.
export function regexPrePass(text: string): Partial<BriefExtraction> {
  const t = text.toLowerCase();
  const result: any = {};

  // ── Currency amounts: only counts if currency symbol/word present ─────────
  const currencyMatch =
    t.match(/(r\s?|zar\s?)\s?([\d\s,]+)\s?(k|000|m)?/i) ||
    t.match(/\$\s?([\d\s,]+)\s?(k|000|m)?/i) ||
    t.match(/£\s?([\d\s,]+)\s?(k|000|m)?/i) ||
    t.match(/budget.{0,15}?([\d\s,]+)\s?(k|m|usd|gbp|zar|rand)?/i);

  if (currencyMatch) {
    const numStr = currencyMatch[1].replace(/[\s,]/g, '');
    let num = parseFloat(numStr);
    const suffix = (currencyMatch[2] || '').toLowerCase();
    if (suffix === 'k') num *= 1000;
    if (suffix === 'm') num *= 1000000;
    // FX rough convert to ZAR for internal use (refresh from XE in production)
    if (t.includes('$') || /usd/i.test(t)) num *= 18.5;
    if (t.includes('£') || /gbp/i.test(t)) num *= 23.5;
    if (num >= 10000) result.budget = { value: Math.round(num), confidence: 0.9, source: 'explicit' };
  }

  // ── Nights/days: "10 nights", "12 days", "two weeks" ─────────────────────
  const nightsMatch = t.match(/(\d+)\s*(night|nite|day)/i);
  if (nightsMatch) {
    const n = parseInt(nightsMatch[1]);
    if (n >= 2 && n <= 30) result.duration = { value: n, confidence: 0.95, source: 'explicit' };
  } else if (/\btwo\s+week/i.test(t)) {
    result.duration = { value: 14, confidence: 0.85, source: 'explicit' };
  } else if (/\bone\s+week|a\s+week/i.test(t)) {
    result.duration = { value: 7, confidence: 0.85, source: 'explicit' };
  }

  // ── Adults: "for two", "couple", "2 of us" ────────────────────────────────
  if (/\bcouple|\bjust\s+us\b|\btwo\s+of\s+us\b|\bmy\s+wife|my\s+husband|my\s+partner/i.test(t)) {
    result.partySize = { adults: { value: 2, confidence: 0.9, source: 'inferred' } };
  }
  const adultsMatch = t.match(/(\d+)\s*adult|adults?\s*:?\s*(\d+)/i);
  if (adultsMatch) {
    const n = parseInt(adultsMatch[1] || adultsMatch[2]);
    if (n >= 1 && n <= 20) result.partySize = { ...(result.partySize || {}), adults: { value: n, confidence: 0.95, source: 'explicit' } };
  }

  // ── Children / infants ───────────────────────────────────────────────────
  const childMatch = t.match(/(\d+)\s*(child|kid)/i);
  if (childMatch) {
    result.partySize = { ...(result.partySize || {}), children: { value: parseInt(childMatch[1]), confidence: 0.95, source: 'explicit' } };
  }
  const infantMatch = t.match(/(\d+)\s*(infant|baby|babies)/i);
  if (infantMatch) {
    result.partySize = { ...(result.partySize || {}), infants: { value: parseInt(infantMatch[1]), confidence: 0.95, source: 'explicit' } };
  }

  // ── Travel month/date ─────────────────────────────────────────────────────
  const months = ['january','february','march','april','may','june','july','august','september','october','november','december'];
  const mIdx = months.findIndex(m => t.includes(m));
  if (mIdx >= 0) {
    const yearMatch = t.match(/20\d{2}/);
    result.travelDates = { value: `${months[mIdx]}${yearMatch ? ` ${yearMatch[0]}` : ''}`, confidence: 0.85, source: 'explicit' };
  }

  // ── Region keywords (NOT party/occasion — those go through AI) ────────────
  const regionMap: Array<[RegExp, string]> = [
    [/sabi\s*sand|kruger|south\s*african\s*safari/i, 'kruger-sabi-sand'],
    [/okavango|botswana\s*delta|chitabe|vumbura|mombo/i, 'okavango-delta'],
    [/cape\s*town|table\s*mountain|winelands/i, 'cape-town'],
    [/madikwe|malaria.?free.{0,30}(big.?five|safari)/i, 'madikwe'],
    [/vic(toria)?\s*falls|chobe|zambezi/i, 'chobe-vic-falls'],
    [/masai\s*mara|mara|kenya/i, 'masai-mara'],
    [/bwindi|gorilla|uganda|rwanda/i, 'bwindi'],
  ];
  const slugs = regionMap.filter(([re]) => re.test(text)).map(([, slug]) => slug);
  if (slugs.length > 0) {
    result.destinations = { value: slugs, confidence: 0.85, source: 'explicit' };
  }

  return result;
}

// ── Haiku extraction (called server-side from /api/build-itinerary) ──────────
// This is the call the SERVER makes — never expose API keys to client.
export async function callBriefExtractor(text: string, anthropicKey: string): Promise<BriefExtraction | null> {
  if (!text || text.trim().length < 10) return null;

  const regex = regexPrePass(text);

  const SYSTEM = `You extract structured travel intent from a free-text brief.
Return ONLY a JSON object. No preamble. No explanation.

Categorise INDEPENDENTLY (a brief can have multiple at once):
- party (who is travelling): family, couple, solo, friends, group, multigenerational
- occasion (why now): honeymoon, anniversary, birthday, babymoon, retirement, graduation, none
- style (the experience): adventure, wildlife, photography, conservation, romantic, luxury, cultural, mixed

Critical:
- "family" is PARTY, never occasion. A family holiday has occasion=none.
- "honeymoon" is OCCASION. Style is usually romantic.
- "anniversary" is OCCASION. Style depends on context.
- "wanted to see X" or "lifelong dream" → style includes "wildlife" or relevant.
- "celebrating" without specifying → occasion=none (don't guess).

For confidence: 0.9+ = stated explicitly, 0.6–0.85 = strongly implied, 0.3–0.5 = guess from context, below 0.3 = absent.`;

  const USER = `Brief: "${text.replace(/"/g, '\\"')}"

Return this exact JSON shape:
{
  "party":    {"value": <type or null>, "confidence": <0-1>},
  "occasion": {"value": <type or null>, "confidence": <0-1>},
  "style":    {"value": <type or null>, "confidence": <0-1>},
  "themes":   [<tag keywords for property/KB matching, max 5>]
}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: SYSTEM,
        messages: [{ role: 'user', content: USER }],
      }),
    });

    const data = await res.json();
    const raw = (data?.content?.[0]?.text || '').trim();
    const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
    if (start === -1) return null;

    const parsed = JSON.parse(raw.slice(start, end + 1));

    // Merge regex pre-pass (which is more reliable for numbers) with AI categories
    const result: BriefExtraction = {
      party:        parsed.party        || { value: null, confidence: 0, source: 'absent' },
      occasion:     parsed.occasion     || { value: null, confidence: 0, source: 'absent' },
      style:        parsed.style        || { value: null, confidence: 0, source: 'absent' },
      duration:     regex.duration      || { value: null, confidence: 0, source: 'absent' },
      budget:       regex.budget        || { value: null, confidence: 0, source: 'absent' },
      destinations: regex.destinations  || { value: [],   confidence: 0, source: 'absent' },
      travelDates:  regex.travelDates   || { value: null, confidence: 0, source: 'absent' },
      partySize: {
        adults:   regex.partySize?.adults   || { value: 2, confidence: 0.3, source: 'inferred' },
        children: regex.partySize?.children || { value: 0, confidence: 0.5, source: 'inferred' },
        infants:  regex.partySize?.infants  || { value: 0, confidence: 0.5, source: 'inferred' },
      },
      themes:    Array.isArray(parsed.themes) ? parsed.themes : [],
      followUps: [],
      rawBrief:  text,
    };

    result.followUps = generateFollowUps(result);
    return result;

  } catch (e) {
    console.error('[briefExtractor]', e);
    // Graceful degradation — return regex-only result
    return {
      party:        { value: null, confidence: 0, source: 'absent' },
      occasion:     { value: null, confidence: 0, source: 'absent' },
      style:        { value: null, confidence: 0, source: 'absent' },
      duration:     regex.duration      || { value: null, confidence: 0, source: 'absent' },
      budget:       regex.budget        || { value: null, confidence: 0, source: 'absent' },
      destinations: regex.destinations  || { value: [],   confidence: 0, source: 'absent' },
      travelDates:  regex.travelDates   || { value: null, confidence: 0, source: 'absent' },
      partySize: {
        adults:   regex.partySize?.adults   || { value: 2, confidence: 0.3, source: 'inferred' },
        children: regex.partySize?.children || { value: 0, confidence: 0.5, source: 'inferred' },
        infants:  regex.partySize?.infants  || { value: 0, confidence: 0.5, source: 'inferred' },
      },
      themes:    [],
      followUps: [],
      rawBrief:  text,
    };
  }
}

// ── Generate follow-up questions for missing high-value fields ───────────────
// Returns up to 3 questions. Asked AFTER the cinematic spinner if needed.
function generateFollowUps(e: BriefExtraction): string[] {
  const qs: string[] = [];

  // Budget is the highest-value missing field for accurate planning
  if (!e.budget.value || e.budget.confidence < MAYBE) {
    qs.push('What total budget are you comfortable with for the journey? (per couple, all-in)');
  }

  // Duration matters next
  if (!e.duration.value || e.duration.confidence < MAYBE) {
    qs.push('Roughly how many nights are you planning?');
  }

  // Infants + malaria warning is a critical health issue
  if (e.partySize.children.value && e.partySize.children.value > 0 && e.partySize.infants.confidence < MAYBE) {
    qs.push('How old are the children? (We avoid malaria regions for under-6s.)');
  }

  // Occasion clarification — only if party detected but occasion absent
  if (e.party.value && !e.occasion.value && e.party.confidence > CONFIDENT) {
    if (e.party.value === 'couple') {
      qs.push('Is there a special occasion we should plan around — anniversary, honeymoon, or just a getaway?');
    }
  }

  // Travel dates — only if everything else is missing
  if (qs.length < 3 && !e.travelDates.value) {
    qs.push('When are you hoping to travel? Even a rough month helps us plan around seasons.');
  }

  return qs.slice(0, 3);
}

// ── Category detection helpers for UI checkbox lighting ──────────────────────
export const detected = {
  destination: (e: BriefExtraction) => (e.destinations.value?.length || 0) > 0 && e.destinations.confidence > MAYBE,
  party:       (e: BriefExtraction) => e.party.value !== null  && e.party.confidence    > MAYBE,
  occasion:    (e: BriefExtraction) => e.occasion.value !== null && e.occasion.confidence > MAYBE && e.occasion.value !== 'none',
  style:       (e: BriefExtraction) => e.style.value !== null && e.style.confidence    > MAYBE,
  duration:    (e: BriefExtraction) => e.duration.value !== null && e.duration.confidence > MAYBE,
  budget:      (e: BriefExtraction) => e.budget.value !== null && e.budget.confidence   > MAYBE,
  dates:       (e: BriefExtraction) => e.travelDates.value !== null && e.travelDates.confidence > MAYBE,
};

// ── Personalised loading messages for cinematic spinner ──────────────────────
// Used by buildThoughts.ts to render context-aware "thinking" lines.
export function buildLoadingMessages(e: BriefExtraction): string[] {
  const msgs: string[] = [];
  const dests = e.destinations.value || [];
  const REGION_LABELS: Record<string, string> = {
    'kruger-sabi-sand': 'Sabi Sand',
    'okavango-delta':   'Okavango Delta',
    'cape-town':        'Cape Town',
    'madikwe':          'Madikwe',
    'chobe-vic-falls':  'Victoria Falls',
    'masai-mara':       'Masai Mara',
    'bwindi':           'Bwindi',
  };

  // Region-specific messages — one per region in the brief
  for (const slug of dests) {
    const label = REGION_LABELS[slug] || slug;
    msgs.push(`Examining lodges in ${label}...`);
  }

  // Theme-driven message
  if (e.occasion.value === 'honeymoon')   msgs.push('Filtering for romantic, private retreats...');
  if (e.occasion.value === 'anniversary') msgs.push('Selecting properties known for special moments...');
  if (e.party.value === 'family')         msgs.push('Prioritising family-friendly camps with children\'s programmes...');
  if (e.style.value === 'photography')    msgs.push('Reviewing photography-specialist guides and hides...');
  if (e.style.value === 'adventure')      msgs.push('Sourcing walking safaris and active itineraries...');

  // Budget-aware message
  if (e.budget.value && e.budget.value < 200000) msgs.push('Optimising for value without compromising quality...');
  if (e.budget.value && e.budget.value > 800000) msgs.push('Considering exclusive-use options and helicopter transfers...');

  // Infant detection drives malaria messaging
  if ((e.partySize.infants.value || 0) > 0) msgs.push('Filtering to malaria-free regions for infant travellers...');

  // Generic fallbacks if we have few region-specific
  if (msgs.length < 4) {
    msgs.push('Checking seasonal weather patterns...');
    msgs.push('Comparing rates across all preferred suppliers...');
    msgs.push('Building the routing that minimises transit time...');
  }

  return msgs.slice(0, 8);
}
