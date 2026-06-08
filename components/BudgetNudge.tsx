'use client';

// ─────────────────────────────────────────────────────────────────────────────
// app/components/BudgetNudge.tsx
//
// In-flow enhancement nudge. When the itinerary sits under budget, this surfaces
// the highest-value room upgrades that still fit the remaining headroom, as
// one-tap "Enhance" chips. OPT-IN — nothing is applied silently.
//
// The traveller sees experience + price. Margin is NEVER shown here — that lives
// only on /admin/pricing-audit. The chips are ranked by price delta (a proxy for
// margin rand) so the engine quietly steers toward the higher-value options.
// ─────────────────────────────────────────────────────────────────────────────

const T = {
  surface: '#1a1a1a', gold: '#d4af37', goldLight: '#f0c040',
  text: '#f5f0e8', textMid: 'rgba(245,240,232,0.58)', textDim: 'rgba(245,240,232,0.32)',
  border: 'rgba(255,255,255,0.07)', borderGold: 'rgba(212,175,55,0.28)', goldDim: 'rgba(212,175,55,0.10)',
};

const MIN_HEADROOM = 8000;   // don't nudge when within R8k of budget
const MAX_CHIPS    = 3;

interface Stay { hotelId: string | number; nights: number; prefs: { rooms: number; basis: number; flexibility: number }; }
interface RoomOpt { label: string; extra: number; tier: number; }

interface Props {
  cities:    Array<{ city: string }>;
  cityStays: Stay[];
  hotels:    any[];                       // hotelsByMargin
  budget:    number;
  grandTotal: number;
  marginMult: number;                     // M.hotels — to estimate the display delta
  fmt:       (n: number) => string;
  onApply:   (cityIdx: number, tier: number) => void;
}

export default function BudgetNudge({ cities, cityStays, hotels, budget, grandTotal, marginMult, fmt, onApply }: Props) {
  const headroom = budget - grandTotal;
  if (headroom < MIN_HEADROOM) return null;

  // Build candidate upgrades: room tiers above the current pick that still fit headroom.
  type Cand = { cityIdx: number; cityName: string; hotelName: string; label: string; tier: number; delta: number };
  const candidates: Cand[] = [];

  cities.forEach((c, i) => {
    const stay = cityStays[i];
    if (!stay) return;
    const hotel = hotels.find(h => String(h.id) === String(stay.hotelId));
    if (!hotel?.upgrades?.rooms) return;
    const currentTier = stay.prefs?.rooms ?? 0;
    (hotel.upgrades.rooms as RoomOpt[])
      .filter(o => (o.tier ?? 0) > currentTier && (o.extra ?? 0) > 0)
      .forEach(o => {
        const delta = Math.round((o.extra ?? 0) * marginMult);   // ≈ how much the total will rise
        if (delta > 0 && delta <= headroom) {
          candidates.push({ cityIdx: i, cityName: c.city, hotelName: hotel.name, label: o.label, tier: o.tier, delta });
        }
      });
  });

  if (!candidates.length) return null;

  // Rank by price delta desc (proxy for margin rand) — biggest value that fits first.
  const top = candidates.sort((a, b) => b.delta - a.delta).slice(0, MAX_CHIPS);

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${T.border}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: T.gold }}>&#10022;</span>
          <span style={{ fontSize: 12, color: T.gold, fontWeight: 600 }}>
            Room upgrades available — {fmt(headroom)} within budget
          </span>
        </div>
        <div style={{ fontSize: 11, color: T.textDim, paddingLeft: 20, lineHeight: 1.55 }}>
          These are optional room upgrades at your selected lodges. Tap to apply — your total updates immediately.
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {top.map((c, k) => (
          <button
            key={k}
            onClick={() => onApply(c.cityIdx, c.tier)}
            style={{
              background: T.goldDim, border: `0.5px solid ${T.borderGold}`, color: T.text,
              borderRadius: 9, padding: '8px 12px', fontSize: 12, fontFamily: 'inherit',
              cursor: 'pointer', textAlign: 'left', lineHeight: 1.35, maxWidth: 280,
            }}
          >
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: 'rgba(212,175,55,0.7)', marginBottom: 3 }}>Room upgrade</div>
            <div style={{ color: T.gold, fontWeight: 600 }}>{c.hotelName} — {c.label}</div>
            <div style={{ color: T.textMid, fontSize: 11, marginTop: 2 }}>{c.cityName} · +{fmt(c.delta)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
