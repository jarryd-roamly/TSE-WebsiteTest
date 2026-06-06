'use client';

// ─────────────────────────────────────────────────────────────────────────────
// components/RegionChapter.tsx
//
// Wraps each destination in the builder with an immersive chapter layout.
// The existing carousels (NestedPropertyCarousel, ActivitySpool, TransferCarousel)
// are passed as children — this component NEVER replaces them.
//
// Layout:
//   Full-bleed faint regional background (10% opacity, static)
//   Left sidebar  — KB tips, skeleton findings, "did you know" — fade on scroll
//   Center        — children (carousels, activities, transfers — passed as-is)
//   Right sidebar — seasonal context, specialist note, inclusion flags
//
// On mobile: single column, sidebars collapse above/below center.
// Background image transitions on chapter change via CSS opacity.
//
// PropertyMiniSite is exported separately — launched from within
// NestedPropertyCarousel via the "Explore →" button.
// ─────────────────────────────────────────────────────────────────────────────

import {
  useState, useEffect, useRef, useCallback, type ReactNode,
} from 'react';
import { T } from '@/app/lib/theme';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RegionChapterProps {
  // Identity
  chapterIndex:    number;    // 0-based, used for chapter number display
  totalChapters:   number;
  regionSlug:      string;
  regionLabel:     string;    // "Kruger / Sabi Sand"
  countryLabel:    string;    // "South Africa"
  nights:          number;
  checkinDate?:    string;    // ISO date — used for seasonal note lookup

  // Background
  bgImageUrl?:     string;    // From regionImageMap in page.tsx

  // KB + skeleton data
  kbHighlights:    string[];  // From KB region entry highlights[]
  kbTips:          string[];  // From KB region entry tips[] (non-internal)
  skeletonFindings: SkeletonFinding[];  // Filtered to this region

  // Inclusions
  selectedHotelName?:    string;
  selectedHotelIncludes: string[];  // rate_includes array from suppliers table
  malariaFree:           boolean;

  // Seasonal note (pre-resolved from KB by parent)
  seasonalNote?:   string;

  // Specialist note (from skeleton or KB)
  specialistNote?: string;

  // Content
  children:        ReactNode;
}

export interface SkeletonFinding {
  id:               string;
  category:         string;
  severity:         'block' | 'warning' | 'recommendation' | 'confirmed';
  title:            string;
  traveller_message: string;
  kb_entry_id?:     string;
  traveller_flagged: boolean;
}

// PropertyMiniSite props
export interface PropertyMiniSiteProps {
  hotel: {
    id:          string | number;
    name:        string;
    destination: string;
    trustScore:  number;
    image:       string;
    funFact?:    string;
    malariaFree?: boolean;
  };
  supplierId?:   string;  // Supabase UUID for room type fetch
  kbEntries:     any[];   // Full KB entries — filtered inside
  includes:      string[];
  onClose:       () => void;
}

// ── Static region data ────────────────────────────────────────────────────────

const REGION_BG_FALLBACK: Record<string, string> = {
  'kruger-sabi-sand': 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1400&q=60',
  'okavango-delta':   'https://images.unsplash.com/photo-1523805009345-7448845a9e53?w=1400&q=60',
  'cape-town':        'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=1400&q=60',
  'madikwe':          'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1400&q=60',
  'chobe-vic-falls':  'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1400&q=60',
  'masai-mara':       'https://images.unsplash.com/photo-1535083783855-aaab70b8f9b3?w=1400&q=60',
};

const REGION_CHAPTER_LABEL: Record<string, string> = {
  'kruger-sabi-sand': 'The Bush',
  'okavango-delta':   'The Delta',
  'cape-town':        'The Cape',
  'madikwe':          'The Reserve',
  'chobe-vic-falls':  'The Falls',
  'masai-mara':       'The Mara',
};

const INCLUSION_ICONS: Record<string, { icon: string; label: string }> = {
  accommodation:   { icon: '🏕', label: 'Accommodation' },
  all_meals:       { icon: '🍽', label: 'All meals' },
  game_drives:     { icon: '🐘', label: 'Game drives' },
  mokoro:          { icon: '🛶', label: 'Mokoro' },
  laundry:         { icon: '👕', label: 'Laundry' },
  park_fees:       { icon: '🌿', label: 'Park fees' },
  local_drinks:    { icon: '🍷', label: 'Local drinks' },
  premium_drinks:  { icon: '🥂', label: 'Premium drinks' },
  spa_treatments:  { icon: '💆', label: 'Spa' },
  transfers_to_airstrip: { icon: '✈', label: 'Airstrip transfers' },
};

const SEVERITY_STYLE: Record<string, { color: string; bg: string; icon: string }> = {
  block:          { color: T.red,   bg: 'rgba(248,113,113,0.08)',  icon: '⚠' },
  warning:        { color: T.amber, bg: 'rgba(251,146,60,0.07)',   icon: '◈' },
  recommendation: { color: T.blue,  bg: 'rgba(96,165,250,0.07)',   icon: '✦' },
  confirmed:      { color: T.green, bg: 'rgba(74,222,128,0.07)',   icon: '✓' },
};

// ── Fade-on-scroll hook ───────────────────────────────────────────────────────

function useFadeOnScroll(threshold = 0.15) {
  const ref  = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVis(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setVis(entry.intersectionRatio > threshold),
      { threshold: [0, threshold, 0.5] }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, vis };
}

// ── Inclusions strip ──────────────────────────────────────────────────────────

function InclusionStrip({ includes, malariaFree }: { includes: string[]; malariaFree: boolean }) {
  const hasIncludes = includes.length > 0;
  const isRoomOnly  = includes.length <= 1 && includes[0] === 'accommodation';
  const hasMeals    = includes.includes('all_meals');
  const hasLocal    = includes.includes('local_drinks');
  const hasPremium  = includes.includes('premium_drinks');

  if (!hasIncludes) return null;

  return (
    <div style={{
      padding: '10px 14px',
      background: isRoomOnly ? 'rgba(251,146,60,0.06)' : 'rgba(74,222,128,0.05)',
      border: `0.5px solid ${isRoomOnly ? 'rgba(251,146,60,0.2)' : 'rgba(74,222,128,0.15)'}`,
      borderRadius: 10,
      marginBottom: 14,
    }}>
      <div style={{ fontSize: 10, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 7, fontWeight: 600 }}>
        What's included
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {isRoomOnly ? (
          <span style={{ fontSize: 11, color: T.amber, background: 'rgba(251,146,60,0.1)', border: '0.5px solid rgba(251,146,60,0.25)', borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>
            ⚑ Room only — meals not included
          </span>
        ) : (
          includes.filter(k => k !== 'accommodation').map(key => {
            const inc = INCLUSION_ICONS[key];
            if (!inc) return null;
            return (
              <span key={key} style={{ fontSize: 11, color: T.green, background: 'rgba(74,222,128,0.08)', border: '0.5px solid rgba(74,222,128,0.2)', borderRadius: 20, padding: '3px 10px' }}>
                {inc.icon} {inc.label}
              </span>
            );
          })
        )}
        {!isRoomOnly && !hasPremium && hasMeals && (
          <span style={{ fontSize: 10, color: T.textDim, padding: '4px 8px', alignSelf: 'center' }}>
            Premium drinks on request
          </span>
        )}
        {malariaFree && (
          <span style={{ fontSize: 11, color: T.gold, background: T.goldDim, border: `0.5px solid ${T.borderGold}`, borderRadius: 20, padding: '3px 10px', fontWeight: 600 }}>
            ✦ Malaria-free
          </span>
        )}
      </div>
    </div>
  );
}

// ── Left sidebar ──────────────────────────────────────────────────────────────

function LeftSidebar({
  kbHighlights,
  skeletonFindings,
  chapterIndex,
  regionLabel,
}: {
  kbHighlights:    string[];
  skeletonFindings: SkeletonFinding[];
  chapterIndex:    number;
  regionLabel:     string;
}) {
  const { ref, vis } = useFadeOnScroll(0.1);

  const regionFindings = skeletonFindings.filter(f =>
    f.severity === 'warning' || f.severity === 'recommendation'
  );

  return (
    <div
      ref={ref}
      style={{
        opacity:    vis ? 1 : 0,
        transform:  vis ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.55s ease, transform 0.55s ease',
      }}
    >
      {/* Chapter number */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.4em',
          textTransform: 'uppercase', color: T.textDim, marginBottom: 6,
        }}>
          Chapter {chapterIndex + 1}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 600, color: T.gold,
          fontFamily: "'Cormorant Garamond',serif",
          letterSpacing: '0.03em',
        }}>
          {regionLabel}
        </div>
      </div>

      {/* Skeleton findings for this region */}
      {regionFindings.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          {regionFindings.slice(0, 3).map(f => {
            const s = SEVERITY_STYLE[f.severity] ?? SEVERITY_STYLE.recommendation;
            return (
              <div key={f.id} style={{
                background: s.bg,
                border: `0.5px solid ${s.color}22`,
                borderLeft: `2px solid ${s.color}`,
                borderRadius: '0 8px 8px 0',
                padding: '8px 10px',
                marginBottom: 8,
              }}>
                <div style={{ fontSize: 10, color: s.color, fontWeight: 700, marginBottom: 3 }}>
                  {s.icon} {f.title}
                </div>
                <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.55 }}>
                  {f.traveller_message}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* KB highlights — "Did you know" */}
      {kbHighlights.slice(0, 4).map((highlight, i) => (
        <div key={i} style={{
          marginBottom: 12,
          padding: '8px 0',
          borderBottom: i < Math.min(kbHighlights.length, 4) - 1
            ? `0.5px solid ${T.border}`
            : 'none',
        }}>
          <div style={{
            fontSize: 9, color: T.gold, fontWeight: 700,
            letterSpacing: '0.15em', textTransform: 'uppercase',
            marginBottom: 4,
          }}>
            ✦ Did you know
          </div>
          <div style={{
            fontSize: 12, color: T.textMid, lineHeight: 1.65,
            fontStyle: 'italic',
          }}>
            {highlight}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Right sidebar ─────────────────────────────────────────────────────────────

function RightSidebar({
  seasonalNote,
  specialistNote,
  kbTips,
  nights,
  checkinDate,
  regionLabel,
  selectedHotelName,
  selectedHotelIncludes,
  malariaFree,
}: {
  seasonalNote?:        string;
  specialistNote?:      string;
  kbTips:               string[];
  nights:               number;
  checkinDate?:         string;
  regionLabel:          string;
  selectedHotelName?:   string;
  selectedHotelIncludes: string[];
  malariaFree:          boolean;
}) {
  const { ref, vis } = useFadeOnScroll(0.1);

  const monthName = checkinDate
    ? new Date(checkinDate).toLocaleString('en', { month: 'long' })
    : null;

  return (
    <div
      ref={ref}
      style={{
        opacity:    vis ? 1 : 0,
        transform:  vis ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.55s ease 0.1s, transform 0.55s ease 0.1s',
      }}
    >
      {/* Seasonal context */}
      {seasonalNote && monthName && (
        <div style={{
          marginBottom: 18,
          padding: '12px 14px',
          background: 'rgba(212,175,55,0.05)',
          border: `0.5px solid ${T.borderGold}`,
          borderRadius: 10,
        }}>
          <div style={{ fontSize: 10, color: T.gold, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 5 }}>
            ✦ {monthName} in {regionLabel}
          </div>
          <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.65, fontStyle: 'italic' }}>
            {seasonalNote}
          </div>
        </div>
      )}

      {/* Stay summary */}
      {selectedHotelName && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 9, color: T.textDim, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 600, marginBottom: 6 }}>
            Your selection
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: "'Cormorant Garamond',serif", marginBottom: 3 }}>
            {selectedHotelName}
          </div>
          <div style={{ fontSize: 11, color: T.textDim }}>
            {nights} night{nights !== 1 ? 's' : ''} · {regionLabel}
          </div>
        </div>
      )}

      {/* Inclusions strip */}
      <InclusionStrip includes={selectedHotelIncludes} malariaFree={malariaFree} />

      {/* Specialist note */}
      {specialistNote && (
        <div style={{
          marginBottom: 18,
          padding: '10px 12px',
          background: 'rgba(96,165,250,0.05)',
          border: `0.5px solid rgba(96,165,250,0.15)`,
          borderLeft: `2px solid rgba(96,165,250,0.5)`,
          borderRadius: '0 8px 8px 0',
        }}>
          <div style={{ fontSize: 10, color: T.blue, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
            ✦ Specialist note
          </div>
          <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.65 }}>
            {specialistNote}
          </div>
        </div>
      )}

      {/* KB tips */}
      {kbTips.slice(0, 3).map((tip, i) => (
        <div key={i} style={{
          marginBottom: 10,
          padding: '7px 0',
          borderBottom: i < Math.min(kbTips.length, 3) - 1
            ? `0.5px solid ${T.border}`
            : 'none',
        }}>
          <div style={{ fontSize: 11, color: T.textMid, lineHeight: 1.6 }}>
            <span style={{ color: T.gold, marginRight: 5 }}>›</span>
            {tip}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main RegionChapter component ──────────────────────────────────────────────

export default function RegionChapter({
  chapterIndex,
  totalChapters,
  regionSlug,
  regionLabel,
  countryLabel,
  nights,
  checkinDate,
  bgImageUrl,
  kbHighlights,
  kbTips,
  skeletonFindings,
  selectedHotelName,
  selectedHotelIncludes,
  malariaFree,
  seasonalNote,
  specialistNote,
  children,
}: RegionChapterProps) {

  const chapterRef = useRef<HTMLDivElement>(null);
  const [chapterVisible, setChapterVisible] = useState(false);
  const bgUrl = bgImageUrl ?? REGION_BG_FALLBACK[regionSlug] ?? '';
  const chapterLabel = REGION_CHAPTER_LABEL[regionSlug] ?? regionLabel;

  // Chapter entrance animation
  useEffect(() => {
    const el = chapterRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setChapterVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setChapterVisible(true); },
      { threshold: 0.05 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hasSidebars = kbHighlights.length > 0 || kbTips.length > 0 ||
    skeletonFindings.length > 0 || seasonalNote || specialistNote;

  return (
    <div
      ref={chapterRef}
      style={{
        position: 'relative',
        marginBottom: 8,
        // Subtle top border as chapter divider (not first chapter)
        borderTop: chapterIndex > 0 ? `0.5px solid ${T.border}` : 'none',
        paddingTop: chapterIndex > 0 ? 32 : 0,
      }}
    >
      {/* ── Background image ── */}
      {bgUrl && (
        <div style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          borderRadius: 0,
          pointerEvents: 'none',
          zIndex: 0,
        }}>
          <img
            src={bgUrl}
            alt=""
            aria-hidden="true"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 35%',
              opacity: chapterVisible ? 0.055 : 0,
              transition: 'opacity 1.2s ease',
              filter: 'saturate(0.7) contrast(0.9)',
            }}
          />
          {/* Gradient vignette so the image doesn't compete with content */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(to bottom,
              rgba(10,10,10,0.7) 0%,
              rgba(10,10,10,0.3) 20%,
              rgba(10,10,10,0.3) 80%,
              rgba(10,10,10,0.85) 100%)`,
          }} />
        </div>
      )}

      {/* ── Chapter header ── */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        marginBottom: 20,
        opacity: chapterVisible ? 1 : 0,
        transform: chapterVisible ? 'translateY(0)' : 'translateY(10px)',
        transition: 'opacity 0.6s ease, transform 0.6s ease',
      }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: '0.4em',
          textTransform: 'uppercase', color: T.gold, opacity: 0.7,
          flexShrink: 0,
        }}>
          {String(chapterIndex + 1).padStart(2, '0')} / {String(totalChapters).padStart(2, '0')}
        </div>
        <div style={{ flex: 1, height: '0.5px', background: T.borderGold, opacity: 0.4 }} />
        <div style={{
          fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase',
          color: T.textDim, flexShrink: 0,
        }}>
          {chapterLabel} · {countryLabel}
        </div>
      </div>

      {/* ── Three-column layout ── */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'grid',
        gridTemplateColumns: hasSidebars ? '200px 1fr 200px' : '1fr',
        gap: '0 24px',
        alignItems: 'start',
      }}>

        {/* Left sidebar */}
        {hasSidebars && (
          <div style={{ paddingTop: 4 }}>
            <LeftSidebar
              kbHighlights={kbHighlights}
              skeletonFindings={skeletonFindings}
              chapterIndex={chapterIndex}
              regionLabel={regionLabel}
            />
          </div>
        )}

        {/* Center — all existing carousels, unchanged */}
        <div>
          {children}
        </div>

        {/* Right sidebar */}
        {hasSidebars && (
          <div style={{ paddingTop: 4 }}>
            <RightSidebar
              seasonalNote={seasonalNote}
              specialistNote={specialistNote}
              kbTips={kbTips}
              nights={nights}
              checkinDate={checkinDate}
              regionLabel={regionLabel}
              selectedHotelName={selectedHotelName}
              selectedHotelIncludes={selectedHotelIncludes}
              malariaFree={malariaFree}
            />
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .region-chapter-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PropertyMiniSite
// Launched from NestedPropertyCarousel via "Explore →" button.
// Full-screen overlay showing room types from Supabase, KB entries, inclusions.
// ─────────────────────────────────────────────────────────────────────────────

interface RoomType {
  id:          string;
  name:        string;
  description: string | null;
  max_guests:  number | null;
  size_sqm:    number | null;
  images:      string[];
  features:    string[];
  extra_zar:   number;
}

export function PropertyMiniSite({ hotel, supplierId, kbEntries, includes, onClose }: PropertyMiniSiteProps) {
  const [rooms, setRooms]       = useState<RoomType[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeRoom, setActiveRoom] = useState(0);
  const [activeImg, setActiveImg]   = useState(0);

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  // Fetch room types from Supabase
  useEffect(() => {
    if (!supplierId || !SUPABASE_URL || !SUPABASE_KEY) {
      setLoading(false);
      return;
    }
    fetch(
      `${SUPABASE_URL}/rest/v1/supplier_rooms?supplier_id=eq.${supplierId}&is_active=eq.true&order=sort_order.asc`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    )
      .then(r => r.json())
      .then((rows: any[]) => {
        if (Array.isArray(rows) && rows.length > 0) {
          setRooms(rows.map(r => ({
            id:          r.id,
            name:        r.name ?? 'Suite',
            description: r.description ?? null,
            max_guests:  r.max_guests ?? null,
            size_sqm:    r.size_sqm ?? null,
            images:      r.images ?? [],
            features:    r.features ?? [],
            extra_zar:   r.extra_zar ?? 0,
          })));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [supplierId, SUPABASE_URL, SUPABASE_KEY]);

  // KB entries for this property
  const propKB = kbEntries.filter((e: any) =>
    e.status === 'active' &&
    e.entry_type === 'property' &&
    e.claim_type !== 'commercial' &&
    !e.internal_only &&
    e.linked_name?.toLowerCase().includes(hotel.name.toLowerCase())
  );

  const highlights = propKB.flatMap((e: any) => e.highlights ?? []);
  const tips       = propKB.flatMap((e: any) => e.tips ?? []);

  const currentRoom = rooms[activeRoom];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      padding: '0',
    }}>
      <div style={{
        width: '100%', maxWidth: 720,
        height: '92vh',
        background: T.bg,
        border: `0.5px solid ${T.borderGold}`,
        borderRadius: '20px 20px 0 0',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideUp 0.35s ease',
      }}>

        {/* Header */}
        <div style={{
          flexShrink: 0,
          padding: '16px 20px 14px',
          borderBottom: `0.5px solid ${T.border}`,
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, marginBottom: 3 }}>
              ✦ Property detail
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.text, fontFamily: "'Cormorant Garamond',serif", lineHeight: 1.2 }}>
              {hotel.name}
            </div>
            <div style={{ fontSize: 11, color: T.textDim, marginTop: 3 }}>
              {hotel.destination} · ★ {hotel.trustScore}/100
              {hotel.malariaFree && <span style={{ color: T.gold, marginLeft: 8 }}>✦ Malaria-free</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: `0.5px solid ${T.border}`,
              color: T.textMid,
              width: 34, height: 34,
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: 16,
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >×</button>
        </div>

        {/* Hero image */}
        <div style={{ flexShrink: 0, height: 200, position: 'relative', overflow: 'hidden' }}>
          <img
            src={hotel.image}
            alt={hotel.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 50%)' }} />
          {hotel.funFact && (
            <div style={{
              position: 'absolute', bottom: 12, left: 16, right: 16,
              fontSize: 12, color: 'rgba(255,255,255,0.85)',
              fontStyle: 'italic', lineHeight: 1.5,
            }}>
              "{hotel.funFact}"
            </div>
          )}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 32px' }}>

          {/* Inclusions */}
          <InclusionStrip includes={includes} malariaFree={hotel.malariaFree ?? false} />

          {/* Room types */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 12 }}>
              Room types
            </div>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 0', color: T.textDim, fontSize: 12 }}>
                <div className="spinner" style={{ width: 18, height: 18 }} />
                Loading room types…
              </div>
            ) : rooms.length === 0 ? (
              <div style={{ fontSize: 12, color: T.textDim, fontStyle: 'italic', padding: '8px 0' }}>
                Room type details will be confirmed by your specialist.
              </div>
            ) : (
              <>
                {/* Room type tabs */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  {rooms.map((room, i) => (
                    <button
                      key={room.id}
                      onClick={() => { setActiveRoom(i); setActiveImg(0); }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 20,
                        border: `1.5px solid ${i === activeRoom ? T.gold : T.border}`,
                        background: i === activeRoom ? T.goldDim : 'transparent',
                        color: i === activeRoom ? T.gold : T.textMid,
                        fontSize: 12,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        fontWeight: i === activeRoom ? 600 : 400,
                        transition: 'all 0.15s',
                      }}
                    >
                      {room.name}
                      {room.extra_zar > 0 && (
                        <span style={{ fontSize: 10, color: T.textDim, marginLeft: 4 }}>
                          +R{Math.round(room.extra_zar / 1000)}k
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Active room detail */}
                {currentRoom && (
                  <div style={{
                    background: T.surface,
                    border: `0.5px solid ${T.border}`,
                    borderRadius: 12,
                    overflow: 'hidden',
                  }}>
                    {/* Room images */}
                    {currentRoom.images.length > 0 && (
                      <div style={{ position: 'relative', height: 180 }}>
                        <img
                          src={currentRoom.images[activeImg]}
                          alt={currentRoom.name}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        {currentRoom.images.length > 1 && (
                          <>
                            {activeImg > 0 && (
                              <button
                                onClick={() => setActiveImg(i => i - 1)}
                                style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >‹</button>
                            )}
                            {activeImg < currentRoom.images.length - 1 && (
                              <button
                                onClick={() => setActiveImg(i => i + 1)}
                                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: '50%', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >›</button>
                            )}
                            <div style={{ position: 'absolute', bottom: 8, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 4 }}>
                              {currentRoom.images.map((_, i) => (
                                <div key={i} onClick={() => setActiveImg(i)} style={{ width: i === activeImg ? 16 : 5, height: 5, borderRadius: 3, background: i === activeImg ? T.gold : 'rgba(255,255,255,0.4)', cursor: 'pointer', transition: 'all 0.2s' }} />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Room info */}
                    <div style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: "'Cormorant Garamond',serif" }}>
                          {currentRoom.name}
                        </div>
                        <div style={{ display: 'flex', gap: 12, flexShrink: 0, marginLeft: 12 }}>
                          {currentRoom.max_guests && (
                            <span style={{ fontSize: 11, color: T.textDim }}>
                              👥 {currentRoom.max_guests} guests max
                            </span>
                          )}
                          {currentRoom.size_sqm && (
                            <span style={{ fontSize: 11, color: T.textDim }}>
                              {currentRoom.size_sqm}m²
                            </span>
                          )}
                        </div>
                      </div>
                      {currentRoom.description && (
                        <div style={{ fontSize: 12, color: T.textMid, lineHeight: 1.65, marginBottom: 10 }}>
                          {currentRoom.description}
                        </div>
                      )}
                      {currentRoom.features.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                          {currentRoom.features.map((f, i) => (
                            <span key={i} style={{ fontSize: 10, color: T.textMid, background: 'rgba(255,255,255,0.05)', border: `0.5px solid ${T.border}`, borderRadius: 20, padding: '2px 8px' }}>
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* KB highlights for this property */}
          {highlights.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: T.gold, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 10 }}>
                Why this property
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {highlights.map((h, i) => (
                  <span key={i} style={{
                    fontSize: 11, color: T.gold,
                    background: T.goldDim,
                    border: `0.5px solid ${T.borderGold}`,
                    borderRadius: 6, padding: '4px 10px',
                    lineHeight: 1.4,
                  }}>
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* KB tips */}
          {tips.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, color: T.blue, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700, marginBottom: 10 }}>
                Specialist tips
              </div>
              {tips.map((tip, i) => (
                <div key={i} style={{
                  fontSize: 12, color: T.textMid, lineHeight: 1.65,
                  padding: '6px 0',
                  borderBottom: i < tips.length - 1 ? `0.5px solid ${T.border}` : 'none',
                }}>
                  <span style={{ color: T.blue, marginRight: 6 }}>›</span>
                  {tip}
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {highlights.length === 0 && tips.length === 0 && !loading && (
            <div style={{ fontSize: 12, color: T.textDim, fontStyle: 'italic', padding: '4px 0 16px' }}>
              Your specialist will brief you on this property before travel.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
