'use client';

// ─────────────────────────────────────────────────────────────────────────────
// JourneyLoadingScreen.tsx
// Cinematic pre-checkout experience.
// Shows after "Validate & Pay", before the checkout form.
// Timeline on left · Specialist notes streaming on right · Looping video bg
// Auto-advances after 7 seconds via onComplete().
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';

// ── Slug lookup ───────────────────────────────────────────────────────────────
const SLUG_MAP: Record<string, string> = {
  'kruger':'kruger-sabi-sand','sabi sand':'kruger-sabi-sand',
  'kruger / sabi sand':'kruger-sabi-sand','sabi sands':'kruger-sabi-sand',
  'okavango':'okavango-delta','okavango delta':'okavango-delta',
  'cape town':'cape-town','madikwe':'madikwe',
  'chobe':'chobe-vic-falls','victoria falls':'chobe-vic-falls',
  'chobe / victoria falls':'chobe-vic-falls','vic falls':'chobe-vic-falls',
  'masai mara':'masai-mara','masai mara, kenya':'masai-mara',
  'phinda':'phinda','mozambique':'mozambique','bwindi':'bwindi',
};

// ── Transfer descriptors ──────────────────────────────────────────────────────
const TRANSFER_LABELS: Record<string, { label: string; duration: string }> = {
  'kruger-sabi-sand→okavango-delta':  { label: 'Federal Air charter', duration: '2h 15m' },
  'okavango-delta→kruger-sabi-sand':  { label: 'Federal Air charter', duration: '2h 15m' },
  'kruger-sabi-sand→chobe-vic-falls': { label: 'Charter flight',      duration: '2h 30m' },
  'chobe-vic-falls→kruger-sabi-sand': { label: 'Charter flight',      duration: '2h 30m' },
  'kruger-sabi-sand→cape-town':       { label: 'Airlink via JNB',     duration: '3h' },
  'cape-town→kruger-sabi-sand':       { label: 'Airlink via JNB',     duration: '3h' },
  'okavango-delta→chobe-vic-falls':   { label: 'Air Botswana charter', duration: '1h 30m' },
  'okavango-delta→cape-town':         { label: 'Airlink via JNB',     duration: '4h' },
  'cape-town→madikwe':                { label: 'Airlink JNB + drive', duration: '4h' },
  'madikwe→cape-town':                { label: 'Drive JNB + Airlink', duration: '4h' },
  'masai-mara→okavango-delta':        { label: 'Charter via Nairobi', duration: '3h 30m' },
};

function getTransfer(fromSlug: string, toSlug: string) {
  return TRANSFER_LABELS[`${fromSlug}→${toSlug}`]
    || TRANSFER_LABELS[`${toSlug}→${fromSlug}`]
    || { label: 'Charter flight', duration: 'TBC' };
}

// ── Specialist notes database ─────────────────────────────────────────────────
const REGION_NOTES: Record<string, string[]> = {
  'kruger-sabi-sand': [
    "Sabi Sand has the highest leopard density on Earth. No other destination comes close.",
    "Private traversing rights mean no other vehicles at sightings. Just you.",
    "Your June–August window: peak dry season. Short grass. Animals at waterholes.",
    "Lion, leopard, elephant, rhino, buffalo — all resident. The Big Five on your doorstep.",
    "Your rate is 27% below what you'd pay booking direct. Contracted access.",
    "The guiding here is generational — families who have tracked this land for decades.",
  ],
  'okavango-delta': [
    "The Okavango is one of the last truly wild places on Earth.",
    "You arrive by light aircraft. There are no roads into the Delta.",
    "The flood peaks July–August. Channels navigable, game concentrates on islands.",
    "Wild dog: the rarest of Africa's large predators. Your concession has an active pack.",
    "A mokoro at dawn through the papyrus: nothing else sounds like the Delta.",
    "20kg soft-bag limit on charters. Travel light. The experience is weightless.",
  ],
  'cape-town': [
    "Cape Town is the perfect bookend to any safari. Culture, wine, mountain, ocean.",
    "Malaria-free. No prophylactics required. Just arrive and exhale.",
    "Table Mountain: one of the New Seven Wonders of Nature.",
    "The Winelands are 45 minutes from your lodge. World-class restaurants along the way.",
    "Best pairing: 4 nights bush, 4 nights Cape Town. You have the balance exactly right.",
  ],
  'chobe-vic-falls': [
    "Victoria Falls is one of the Seven Natural Wonders of the World.",
    "The spray is visible from 40km away. You'll hear it before you see it.",
    "Chobe has the highest elephant concentration anywhere in Africa — 50,000 strong.",
    "The Zambezi sundowner cruise is the finest way to end a day anywhere in Africa.",
    "Zimbabwe is Africa's best-kept secret. The access is extraordinary.",
  ],
  'madikwe': [
    "Madikwe is malaria-free. No prophylactics required — perfect for families.",
    "One of only a handful of Big Five reserves in South Africa with no malaria risk.",
    "Your guide ratio: one vehicle, maximum four guests. The way it should be.",
    "Wild dog are frequently spotted here — one of the rarest sightings in Africa.",
    "90 minutes north of Johannesburg. No flights, no connections. Pure simplicity.",
  ],
  'masai-mara': [
    "The Great Migration: 1.5 million wildebeest. No words do it justice.",
    "Mara River crossings are the greatest wildlife spectacle on Earth. Full stop.",
    "22 resident lion prides in the Mara ecosystem. The density is extraordinary.",
    "Hot air balloon at dawn over the Mara: a different planet entirely.",
    "Your charter lands directly at the airstrip. No transfers, no delays.",
  ],
  'phinda': [
    "Phinda sits in one of the world's most biodiverse ecosystems.",
    "Seven distinct habitats in one reserve. Rare white rhino and cheetah.",
    "The forest lodge at Phinda is one of the most distinctive buildings in Africa.",
    "Malaria-free. Perfect for families or those avoiding prophylactics.",
    "Walking safaris here are exceptional — the terrain rewards the explorer.",
  ],
  'bwindi': [
    "Mountain gorilla trekking: the most profoundly moving wildlife experience on Earth.",
    "Half the world's mountain gorilla population lives in Bwindi Impenetrable Forest.",
    "Your permit is secured. Each trek limited to eight people. Intimate and extraordinary.",
    "The gorillas show no fear. You will spend one hour with a family group.",
    "Bwindi is a UNESCO World Heritage Site. Primordial forest. Ancient silence.",
  ],
};

const LODGE_NOTES: Record<string, string[]> = {
  'singita': [
    "Singita: rated the world's #1 luxury safari operator — seven consecutive years.",
    "Their guides hold the highest field guide certification in Africa.",
    "Singita's rates are rarely discounted. You have access most travellers don't.",
  ],
  'londolozi': [
    "Londolozi has been perfecting the safari experience for over 40 years.",
    "The Varty family started the private reserve conservation movement here.",
    "Three generations of guiding. The leopards here are practically ambassadors.",
  ],
  'mombo': [
    "Mombo translates as 'place of plenty'. The name is earned every morning.",
    "Chief's Island: the highest predator concentration in the entire Delta.",
    "Little Mombo has just 6 tents. The most intimate guiding in Botswana.",
  ],
  'ellerman': [
    "Ellerman House has just 11 suites. One of the most private hotels in Africa.",
    "The wine collection is among the finest in South Africa.",
    "The views over the Atlantic from the pool terrace are unmatched.",
  ],
  'matetsi': [
    "Matetsi occupies a private 26km stretch of the Zambezi.",
    "The river suite sunrise will change your understanding of beauty.",
    "Electric boats only. The silence on the Zambezi at dawn is complete.",
  ],
};

const UNIVERSAL_NOTES = [
  "Your preferred dates are being held while we finalise your journey.",
  "Rate lock confirmed — your prices will not change.",
  "Your Journey Specialist is being assigned right now.",
  "All suppliers will be notified within 2 hours of confirmation.",
  "Your personalised journey companion launches the moment payment clears.",
  "Our contracted rates beat OTA pricing by an average of 22%.",
];

function getNotesForSlug(slug: string, lodgeName: string): string[] {
  const regionNotes = REGION_NOTES[slug] || [];
  // Try to match lodge notes by lodge name keywords
  const lodgeKey = Object.keys(LODGE_NOTES).find(k => lodgeName.toLowerCase().includes(k));
  const lodgeNotes = lodgeKey ? LODGE_NOTES[lodgeKey] : [];
  return [...lodgeNotes.slice(0, 1), ...regionNotes.slice(0, 2)];
}

function buildAllNotes(cities: any[], cityStays: any[], hotelsByMargin: any[]): string[] {
  const notes: string[] = [];

  // Opening affirmation based on number of destinations
  if (cities.length === 1) {
    notes.push(`A focused ${cities[0]?.nights || 4}-night journey. The depth this gives you is irreplaceable.`);
  } else {
    notes.push(`${cities.length} destinations. ${cities.reduce((s: number, c: any) => s + (c.nights || 0), 0)} nights. This is exactly how it should be done.`);
  }

  // Per-destination notes
  cities.forEach((city: any, i: number) => {
    const slug = SLUG_MAP[city.city?.toLowerCase().trim() ?? ''] ?? '';
    const stay = cityStays[i];
    const hotel = stay
      ? hotelsByMargin.find((h: any) => String(h.id) === String(stay.hotelId))
      : hotelsByMargin.find((h: any) => h.subRegion === slug);
    const lodgeName = hotel?.name ?? '';
    const cityNotes = getNotesForSlug(slug, lodgeName);
    notes.push(...cityNotes);
  });

  // Universal closing notes
  notes.push(...UNIVERSAL_NOTES.slice(0, 3));

  return notes;
}

// ── Timeline node types ───────────────────────────────────────────────────────
type TimelineNode =
  | { type: 'departure' }
  | { type: 'lodge';    city: string; country: string; lodgeName: string; nights: number; slug: string; fact: string }
  | { type: 'transfer'; label: string; duration: string }
  | { type: 'return' };

function buildTimeline(
  itinerary:      any,
  cityStays:      any[],
  hotelsByMargin: any[],
): TimelineNode[] {
  const nodes: TimelineNode[] = [{ type: 'departure' }];

  (itinerary.cities || []).forEach((city: any, i: number) => {
    const slug = SLUG_MAP[city.city?.toLowerCase().trim() ?? ''] ?? city.city?.toLowerCase() ?? '';
    const stay = cityStays[i];
    const hotel = stay
      ? hotelsByMargin.find((h: any) => String(h.id) === String(stay.hotelId))
      : hotelsByMargin.find((h: any) => h.subRegion === slug);
    const lodgeName = hotel?.name ?? city.city;
    const regionFacts = REGION_NOTES[slug] || [];
    const fact = regionFacts[0] ?? '';

    nodes.push({
      type: 'lodge',
      city: city.city,
      country: city.country,
      lodgeName,
      nights: stay?.nights ?? city.nights ?? 3,
      slug,
      fact,
    });

    if (i < (itinerary.cities || []).length - 1) {
      const nextSlug = SLUG_MAP[(itinerary.cities[i + 1]?.city ?? '').toLowerCase().trim()] ?? '';
      const xfer = getTransfer(slug, nextSlug);
      nodes.push({ type: 'transfer', label: xfer.label, duration: xfer.duration });
    }
  });

  nodes.push({ type: 'return' });
  return nodes;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  itinerary:      any;
  cityStays:      Array<{ hotelId: string | number; nights: number; prefs: any }>;
  hotelsByMargin: any[];
  checkinDate:    string;
  nights:         number;
  grandTotal:     number;
  fmt:            (n: number) => string;
  edition:        { name: string };
  selectedRegions:string[];
  onComplete:     () => void;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function JourneyLoadingScreen({
  itinerary, cityStays, hotelsByMargin,
  checkinDate, nights, grandTotal, fmt, edition,
  selectedRegions, onComplete,
}: Props) {

  const [bgVideo,        setBgVideo]        = useState<string | null>(null);
  const [visibleNodes,   setVisibleNodes]   = useState(0);
  const [shownNotes,     setShownNotes]     = useState<string[]>([]);
  const [progress,       setProgress]       = useState(0);
  const [progStarted,    setProgStarted]    = useState(false);
  const [revealed,       setRevealed]       = useState(false);
  const notesRef = useRef<HTMLDivElement>(null);
  const timers   = useRef<ReturnType<typeof setTimeout>[]>([]);

  const addTimer = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(fn, ms);
    timers.current.push(id);
    return id;
  }, []);

  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  // Build data
  const timeline = buildTimeline(itinerary, cityStays, hotelsByMargin);
  const notes    = buildAllNotes(itinerary?.cities ?? [], cityStays, hotelsByMargin);
  const primarySlug = SLUG_MAP[(itinerary?.cities?.[0]?.city ?? '').toLowerCase().trim()] ?? (selectedRegions[0] ?? '');

  // Load background video
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key || !primarySlug) return;
    fetch(
      `${url}/rest/v1/cinematic_videos?or=(region.eq.${primarySlug}-journey,region.eq.${primarySlug})&select=region,url&limit=2`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    )
      .then(r => r.json())
      .then((rows: any[]) => {
        // Prefer -journey variant
        const journey = rows.find((r: any) => r.region === `${primarySlug}-journey`);
        const fallback = rows.find((r: any) => r.region === primarySlug);
        const chosen = journey || fallback;
        if (chosen?.url) setBgVideo(chosen.url);
      })
      .catch(() => {});
  }, [primarySlug]);

  // Orchestrate the animation sequence
  useEffect(() => {
    // Small delay before anything appears
    addTimer(() => setRevealed(true), 300);

    // Reveal timeline nodes one by one
    for (let i = 0; i < timeline.length; i++) {
      addTimer(() => setVisibleNodes(v => v + 1), 600 + i * 900);
    }

    // Stream notes
    const noteDelay = 1200;
    notes.slice(0, 6).forEach((note, i) => {
      addTimer(() => {
        setShownNotes(prev => [...prev, note]);
        setTimeout(() => {
          if (notesRef.current) notesRef.current.scrollTop = notesRef.current.scrollHeight;
        }, 50);
      }, 1000 + i * noteDelay);
    });

    // Start progress bar after timeline fully revealed
    const progStart = 600 + timeline.length * 900 + 400;
    addTimer(() => setProgStarted(true), progStart);

    // Complete
    addTimer(() => onComplete(), progStart + 2400);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Progress bar animation
  useEffect(() => {
    if (!progStarted) return;
    let p = 0;
    const iv = setInterval(() => {
      p += 1.8;
      setProgress(Math.min(p, 100));
      if (p >= 100) clearInterval(iv);
    }, 40);
    return () => clearInterval(iv);
  }, [progStarted]);

  const formatDate = (d: string) => {
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
    catch { return d; }
  };

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400&display=swap');

        .jls-root {
          position:fixed; inset:0; z-index:500; overflow:hidden;
          background:#0a0800; font-family:'Jost',sans-serif; color:#f5f0e8;
        }

        /* Background */
        .jls-bg { position:absolute; inset:0; overflow:hidden; }
        .jls-bg video { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:0.28; filter:saturate(0.6); }
        .jls-bg-ov { position:absolute; inset:0; background:linear-gradient(135deg,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.55) 50%,rgba(0,0,0,0.82) 100%); }
        .jls-grain {
          position:absolute; inset:0; z-index:2; pointer-events:none; opacity:0.022;
          background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size:160px; animation:jlsGrain .5s steps(1) infinite;
        }
        @keyframes jlsGrain { 0%{background-position:0 0}25%{background-position:-18px 9px}50%{background-position:9px -14px}75%{background-position:-9px 18px}100%{background-position:5px -5px} }

        /* Layout */
        .jls-layout {
          position:relative; z-index:10;
          height:100vh; display:flex; flex-direction:column;
        }
        .jls-topbar {
          flex-shrink:0; height:58px; display:flex; align-items:center;
          justify-content:space-between; padding:0 clamp(20px,4vw,56px);
          border-bottom:0.5px solid rgba(200,169,110,0.1);
          background:rgba(0,0,0,0.22); backdrop-filter:blur(12px);
        }
        .jls-brand {
          display:flex; align-items:center; gap:9px;
          font-family:'Cormorant Garamond',serif; font-weight:300;
          font-size:15px; color:rgba(200,169,110,0.9); letter-spacing:0.07em;
        }
        .jls-diamond { position:relative; width:20px; height:20px; flex-shrink:0; }
        .jls-diamond::before { content:''; position:absolute; inset:0; border:1.5px solid rgba(200,169,110,0.7); transform:rotate(45deg); }
        .jls-diamond::after  { content:''; position:absolute; inset:5px; background:rgba(200,169,110,0.85); transform:rotate(45deg); }
        .jls-status {
          font-size:10px; font-weight:200; letter-spacing:0.4em;
          text-transform:uppercase; color:rgba(200,169,110,0.6);
          display:flex; align-items:center; gap:8px;
        }
        .jls-pulse {
          width:6px; height:6px; border-radius:50%;
          background:rgba(200,169,110,0.8);
          animation:jlsPulse 1.4s ease-in-out infinite;
        }
        @keyframes jlsPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(1.5)} }

        /* Main panels */
        .jls-main {
          flex:1; display:grid; grid-template-columns:1fr 1fr;
          gap:0; overflow:hidden; min-height:0;
        }

        /* ── LEFT: TIMELINE ── */
        .jls-left {
          padding:clamp(24px,4vh,48px) clamp(24px,4vw,60px);
          border-right:0.5px solid rgba(200,169,110,0.08);
          overflow:hidden; display:flex; flex-direction:column;
        }
        .jls-left-eyebrow {
          font-weight:200; font-size:9px; letter-spacing:0.5em;
          text-transform:uppercase; color:rgba(200,169,110,0.6);
          margin-bottom:6px;
        }
        .jls-left-title {
          font-family:'Cormorant Garamond',serif; font-weight:300;
          font-size:clamp(18px,2.5vw,28px); color:#f5f0e8; line-height:1.2;
          margin-bottom:clamp(20px,4vh,40px); letter-spacing:0.02em;
        }
        .jls-left-title em { font-style:italic; color:rgba(200,169,110,0.9); }

        /* Timeline */
        .jls-timeline { flex:1; display:flex; flex-direction:column; gap:0; min-height:0; overflow:hidden; }
        .jls-node {
          display:flex; gap:16px; opacity:0; transform:translateY(12px);
          transition:opacity 0.55s ease, transform 0.55s ease;
        }
        .jls-node.show { opacity:1; transform:translateY(0); }

        /* Left column: dot + line */
        .jls-node-left { display:flex; flex-direction:column; align-items:center; flex-shrink:0; width:20px; }
        .jls-dot-depart {
          width:12px; height:12px; border-radius:50%;
          border:1.5px solid rgba(200,169,110,0.8);
          background:transparent; flex-shrink:0; margin-top:2px;
        }
        .jls-dot-lodge {
          width:14px; height:14px; flex-shrink:0; margin-top:1px;
          border:1.5px solid rgba(200,169,110,0.7);
          transform:rotate(45deg);
          position:relative;
        }
        .jls-dot-lodge::after {
          content:''; position:absolute; inset:3px;
          background:rgba(200,169,110,0.8);
        }
        .jls-dot-transfer {
          width:8px; height:8px; flex-shrink:0; margin-top:4px;
          border-radius:50%;
          background:rgba(200,169,110,0.3);
          border:0.5px solid rgba(200,169,110,0.5);
        }
        .jls-dot-return {
          width:10px; height:10px; flex-shrink:0; margin-top:2px;
          border-radius:50%;
          border:1.5px solid rgba(245,240,232,0.3);
          background:transparent;
        }
        .jls-line {
          flex:1; width:0.5px; background:linear-gradient(to bottom, rgba(200,169,110,0.35), rgba(200,169,110,0.08));
          min-height:14px; margin:4px 0;
        }

        /* Right column: content */
        .jls-node-content { flex:1; min-width:0; padding-bottom:clamp(12px,2.5vh,22px); }

        /* Departure */
        .jls-depart-label {
          font-weight:200; font-size:10px; letter-spacing:0.36em;
          text-transform:uppercase; color:rgba(245,240,232,0.3);
          padding-top:1px;
        }

        /* Lodge node */
        .jls-lodge-city {
          font-weight:200; font-size:9px; letter-spacing:0.32em;
          text-transform:uppercase; color:rgba(200,169,110,0.6);
          margin-bottom:3px; padding-top:0;
        }
        .jls-lodge-name {
          font-family:'Cormorant Garamond',serif; font-weight:400;
          font-size:clamp(14px,1.8vw,19px); color:#f5f0e8; line-height:1.2;
          margin-bottom:4px;
        }
        .jls-lodge-meta {
          font-weight:200; font-size:10px; color:rgba(245,240,232,0.35);
          letter-spacing:0.1em; margin-bottom:5px;
        }
        .jls-lodge-fact {
          font-weight:300; font-size:11px; color:rgba(200,169,110,0.65);
          line-height:1.55; font-style:italic;
          padding:5px 10px; border-left:1.5px solid rgba(200,169,110,0.25);
          background:rgba(200,169,110,0.03);
        }

        /* Transfer node */
        .jls-transfer-row {
          display:flex; align-items:center; gap:8px;
          padding-top:0; padding-bottom:0;
        }
        .jls-transfer-line { flex:1; height:0.5px; background:rgba(255,255,255,0.07); }
        .jls-transfer-label {
          font-weight:200; font-size:9px; letter-spacing:0.2em;
          text-transform:uppercase; color:rgba(245,240,232,0.3);
          white-space:nowrap;
        }

        /* Return node */
        .jls-return-label {
          font-weight:200; font-size:10px; letter-spacing:0.36em;
          text-transform:uppercase; color:rgba(245,240,232,0.3);
          padding-top:1px;
        }

        /* ── RIGHT: SPECIALIST NOTES ── */
        .jls-right {
          padding:clamp(24px,4vh,48px) clamp(24px,4vw,60px);
          display:flex; flex-direction:column; overflow:hidden;
        }
        .jls-right-eyebrow {
          font-weight:200; font-size:9px; letter-spacing:0.5em;
          text-transform:uppercase; color:rgba(200,169,110,0.5);
          margin-bottom:20px; flex-shrink:0;
        }
        .jls-notes-stream {
          flex:1; overflow:hidden; position:relative; min-height:0;
          mask-image:linear-gradient(to bottom,transparent 0%,black 10%,black 85%,transparent 100%);
          -webkit-mask-image:linear-gradient(to bottom,transparent 0%,black 10%,black 85%,transparent 100%);
        }
        .jls-notes-inner {
          padding:16px 0; display:flex; flex-direction:column;
          overflow-y:auto; max-height:100%;
          scrollbar-width:none;
        }
        .jls-notes-inner::-webkit-scrollbar { display:none; }
        .jls-note-item {
          display:flex; align-items:flex-start; gap:12px;
          padding:10px 0; border-bottom:0.5px solid rgba(255,255,255,0.03);
          opacity:0; transform:translateY(8px);
          animation:jlsNoteIn 0.5s ease forwards;
        }
        @keyframes jlsNoteIn { to { opacity:1; transform:translateY(0); } }
        .jls-note-item.latest { border-bottom-color:rgba(200,169,110,0.1); }
        .jls-note-icon { width:14px; height:14px; flex-shrink:0; margin-top:2px; display:flex; align-items:center; justify-content:center; }
        .jls-note-dot {
          width:5px; height:5px; border-radius:50%;
          background:rgba(200,169,110,0.35);
        }
        .jls-note-dot-active {
          width:8px; height:8px; border-radius:50%;
          background:rgba(200,169,110,0.9);
          box-shadow:0 0 10px rgba(200,169,110,0.7);
          animation:jlsPulse 1.2s ease-in-out infinite;
        }
        .jls-note-text {
          font-weight:300; font-size:12.5px; line-height:1.65;
          color:rgba(245,240,232,0.35); letter-spacing:0.01em;
        }
        .jls-note-item.latest .jls-note-text {
          color:rgba(245,240,232,0.88); font-weight:400;
        }

        /* Journey summary strip (below notes) */
        .jls-summary {
          flex-shrink:0; margin-top:20px;
          display:flex; gap:24px; flex-wrap:wrap;
          padding-top:16px; border-top:0.5px solid rgba(255,255,255,0.06);
        }
        .jls-sum-item { }
        .jls-sum-label { font-weight:200; font-size:9px; letter-spacing:0.3em; text-transform:uppercase; color:rgba(245,240,232,0.25); margin-bottom:3px; }
        .jls-sum-val   { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:18px; color:rgba(200,169,110,0.85); }

        /* ── BOTTOM: PROGRESS ── */
        .jls-bottom {
          flex-shrink:0; padding:16px clamp(20px,4vw,56px);
          border-top:0.5px solid rgba(255,255,255,0.05);
          background:rgba(0,0,0,0.3); backdrop-filter:blur(8px);
        }
        .jls-progress-meta {
          display:flex; justify-content:space-between;
          margin-bottom:10px; align-items:baseline;
        }
        .jls-progress-label { font-weight:200; font-size:10px; letter-spacing:0.3em; text-transform:uppercase; color:rgba(245,240,232,0.25); }
        .jls-progress-pct   { font-family:'Cormorant Garamond',serif; font-weight:300; font-size:16px; color:rgba(200,169,110,0.7); }
        .jls-progress-track { height:1px; background:rgba(255,255,255,0.06); position:relative; overflow:visible; }
        .jls-progress-fill  {
          height:1px;
          background:linear-gradient(90deg, rgba(200,169,110,0.9), rgba(240,200,64,0.6));
          transition:width 0.08s linear; position:relative;
          box-shadow:0 0 8px rgba(200,169,110,0.5);
        }
        .jls-progress-fill::after {
          content:''; position:absolute; right:-1px; top:-3px;
          width:7px; height:7px; border-radius:50%;
          background:rgba(200,169,110,0.9); box-shadow:0 0 12px rgba(200,169,110,0.8);
        }
        .jls-corner { position:absolute; width:16px; height:16px; opacity:0.2; }
        .jls-corner::before,.jls-corner::after { content:''; position:absolute; background:rgba(200,169,110,0.7); }
        .jls-corner.tl{top:16px;left:16px}.jls-corner.tl::before{top:0;left:0;width:16px;height:0.5px}.jls-corner.tl::after{top:0;left:0;width:0.5px;height:16px}
        .jls-corner.tr{top:16px;right:16px}.jls-corner.tr::before{top:0;right:0;width:16px;height:0.5px}.jls-corner.tr::after{top:0;right:0;width:0.5px;height:16px}
        .jls-corner.bl{bottom:16px;left:16px}.jls-corner.bl::before{bottom:0;left:0;width:16px;height:0.5px}.jls-corner.bl::after{bottom:0;left:0;width:0.5px;height:16px}
        .jls-corner.br{bottom:16px;right:16px}.jls-corner.br::before{bottom:0;right:0;width:16px;height:0.5px}.jls-corner.br::after{bottom:0;right:0;width:0.5px;height:16px}

        @media(max-width:700px) {
          .jls-main { grid-template-columns:1fr; grid-template-rows:auto auto; }
          .jls-left { border-right:none; border-bottom:0.5px solid rgba(200,169,110,0.08); max-height:50vh; overflow-y:auto; }
          .jls-right { max-height:30vh; }
          .jls-summary { display:none; }
        }
      `}</style>

      <div className="jls-root">
        {/* Background */}
        <div className="jls-bg">
          {bgVideo && <video src={bgVideo} autoPlay muted loop playsInline />}
          <div className="jls-bg-ov" />
          <div className="jls-grain" />
        </div>

        {/* Corner marks */}
        <div className="jls-corner tl" style={{ position: 'fixed' as const }} />
        <div className="jls-corner tr" style={{ position: 'fixed' as const }} />
        <div className="jls-corner bl" style={{ position: 'fixed' as const }} />
        <div className="jls-corner br" style={{ position: 'fixed' as const }} />

        <div className="jls-layout">
          {/* Top bar */}
          <div className="jls-topbar">
            <div className="jls-brand">
              <div className="jls-diamond" />
              {edition.name}
            </div>
            <div className="jls-status">
              <div className="jls-pulse" />
              Securing your journey
            </div>
          </div>

          {/* Main two-panel */}
          <div className="jls-main">

            {/* ── LEFT: TIMELINE ── */}
            <div className="jls-left" style={{ opacity: revealed ? 1 : 0, transition: 'opacity 0.6s ease' }}>
              <div className="jls-left-eyebrow">Your itinerary</div>
              <div className="jls-left-title">
                <em>{itinerary.title || `${nights}-Night Journey`}</em>
              </div>

              <div className="jls-timeline">
                {timeline.map((node, i) => (
                  <div key={i} className={`jls-node ${i < visibleNodes ? 'show' : ''}`}>

                    {/* Dot + connecting line */}
                    <div className="jls-node-left">
                      {node.type === 'departure' && <div className="jls-dot-depart" />}
                      {node.type === 'lodge'     && <div className="jls-dot-lodge" />}
                      {node.type === 'transfer'  && <div className="jls-dot-transfer" />}
                      {node.type === 'return'    && <div className="jls-dot-return" />}
                      {i < timeline.length - 1  && <div className="jls-line" />}
                    </div>

                    {/* Content */}
                    <div className="jls-node-content">
                      {node.type === 'departure' && (
                        <div className="jls-depart-label">
                          {checkinDate
                            ? new Date(checkinDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                            : 'Departure'}
                        </div>
                      )}

                      {node.type === 'lodge' && (
                        <>
                          <div className="jls-lodge-city">{node.city} · {node.country}</div>
                          <div className="jls-lodge-name">{node.lodgeName}</div>
                          <div className="jls-lodge-meta">{node.nights} nights · All-inclusive</div>
                          {node.fact && <div className="jls-lodge-fact">"{node.fact}"</div>}
                        </>
                      )}

                      {node.type === 'transfer' && (
                        <div className="jls-transfer-row">
                          <div className="jls-transfer-line" />
                          <div className="jls-transfer-label">{node.label} · {node.duration}</div>
                          <div className="jls-transfer-line" />
                        </div>
                      )}

                      {node.type === 'return' && (
                        <div className="jls-return-label">Return home</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── RIGHT: SPECIALIST NOTES ── */}
            <div className="jls-right" style={{ opacity: revealed ? 1 : 0, transition: 'opacity 0.6s ease 0.2s' }}>
              <div className="jls-right-eyebrow">✦ Specialist notes · your journey</div>

              <div className="jls-notes-stream">
                <div className="jls-notes-inner" ref={notesRef}>
                  {shownNotes.map((note, i) => {
                    const isLatest = i === shownNotes.length - 1;
                    return (
                      <div key={i} className={`jls-note-item ${isLatest ? 'latest' : ''}`}>
                        <div className="jls-note-icon">
                          {isLatest
                            ? <div className="jls-note-dot-active" />
                            : <div className="jls-note-dot" />
                          }
                        </div>
                        <div className="jls-note-text">{note}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Journey summary */}
              <div className="jls-summary">
                <div className="jls-sum-item">
                  <div className="jls-sum-label">Package total</div>
                  <div className="jls-sum-val">{fmt(grandTotal)}</div>
                </div>
                <div className="jls-sum-item">
                  <div className="jls-sum-label">Nights</div>
                  <div className="jls-sum-val">{nights}</div>
                </div>
                {(itinerary?.cities?.length ?? 0) > 0 && (
                  <div className="jls-sum-item">
                    <div className="jls-sum-label">Destinations</div>
                    <div className="jls-sum-val">{itinerary.cities.length}</div>
                  </div>
                )}
                <div className="jls-sum-item">
                  <div className="jls-sum-label">Deposit today</div>
                  <div className="jls-sum-val">{fmt(Math.round(grandTotal * 0.30))}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="jls-bottom">
            <div className="jls-progress-meta">
              <div className="jls-progress-label">
                {progress < 40 ? 'Confirming lodge availability…'
                  : progress < 70 ? 'Rate lock confirmed — securing your dates…'
                  : progress < 90 ? 'Building your journey companion…'
                  : 'Almost there…'}
              </div>
              <div className="jls-progress-pct">{Math.round(progress)}%</div>
            </div>
            <div className="jls-progress-track">
              <div className="jls-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
