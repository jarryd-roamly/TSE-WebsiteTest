'use client';

// ─────────────────────────────────────────────────────────────────────────────
// JourneyConfirmation.tsx — "Confirming Your Journey" interstitial
//
// Sits between the builder and /checkout. Shows the traveller exactly what
// they've chosen in a beautiful sequential reveal, then transitions to payment.
//
// Add to page.tsx screen state:
//   type Screen = ... | 'confirming';
//
// Render condition in page.tsx (add after 'builder' block):
//   {screen === 'confirming' && (
//     <JourneyConfirmation
//       itinerary={itinerary!}
//       cityStays={cityStays}
//       hotelsByMargin={hotelsByMargin}
//       selectedTransferIds={selectedTransferIds}
//       selectedActivities={selectedActivities}
//       checkinDate={checkinDate}
//       nights={nights}
//       adults={adults}
//       children={children}
//       grandTotal={grandTotal}
//       fmt={fmt}
//       currency={currency}
//       edition={edition}
//       onConfirm={doCheckout}
//       onBack={() => setScreen('builder')}
//     />
//   )}
//
// Replace handleValidateAndPay with:
//   const handleValidateAndPay = () => {
//     const issues = validateItinerary(...);
//     const hard = issues.filter(i => i.severity === 'hard');
//     if (hard.length > 0) { setShowValidation(true); return; }
//     setScreen('confirming');
//   };
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useMemo } from 'react';
import { T } from '@/app/lib/theme';
const SLUG: Record<string, string> = {
  'kruger':'kruger-sabi-sand','sabi sand':'kruger-sabi-sand',
  'kruger / sabi sand':'kruger-sabi-sand','sabi sands':'kruger-sabi-sand',
  'okavango':'okavango-delta','okavango delta':'okavango-delta',
  'cape town':'cape-town','madikwe':'madikwe',
  'chobe':'chobe-vic-falls','victoria falls':'chobe-vic-falls',
  'chobe / victoria falls':'chobe-vic-falls','vic falls':'chobe-vic-falls',
  'victoria falls, zimbabwe':'chobe-vic-falls',
  'masai mara':'masai-mara','masai mara, kenya':'masai-mara',
  'the masai mara':'masai-mara',
  'phinda':'phinda','mozambique':'mozambique','bwindi':'bwindi',
};
import { resolveHotelUpgrades } from '@/app/lib/pricing';

// ─── Prop types ───────────────────────────────────────────────────────────────
interface ConfirmationProps {
  itinerary:            any;
  cityStays:            Array<{ hotelId: string | number; nights: number; prefs: any }>;
  hotelsByMargin:       any[];
  selectedTransferIds:  Record<string, string>;
  selectedActivities:   Record<string, string[]>;
  activities:           any[];
  checkinDate:          string;
  nights:               number;
  adults:               number;
  children:             number;
  grandTotal:           number;
  fmt:                  (n: number) => string;
  currency:             { code: string; symbol: string; rate: number };
  edition:              { name: string };
  onConfirm:            () => void;
  onBack:               () => void;
}

// Slug map — mirror of CITY_TO_SLUG in page.tsx
const SLUG: Record<string, string> = {
  'kruger': 'kruger-sabi-sand', 'sabi sand': 'kruger-sabi-sand',
  'kruger / sabi sand': 'kruger-sabi-sand', 'sabi sands': 'kruger-sabi-sand',
  'okavango': 'okavango-delta', 'okavango delta': 'okavango-delta',
  'cape town': 'cape-town', 'madikwe': 'madikwe',
  'chobe': 'chobe-vic-falls', 'victoria falls': 'chobe-vic-falls',
  'chobe / victoria falls': 'chobe-vic-falls', 'vic falls': 'chobe-vic-falls',
  'masai mara': 'masai-mara', 'the masai mara': 'masai-mara',
};

function slugFor(city: string) {
  return SLUG[city?.toLowerCase().trim()] ?? city?.toLowerCase().replace(/\s+/g, '-') ?? '';
}

function formatDate(dateStr: string, offsetNights = 0): string {
  if (!dateStr) return 'TBC';
  const d = new Date(dateStr);
  if (offsetNights) d.setDate(d.getDate() + offsetNights);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function addNights(dateStr: string, nights: number): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setDate(d.getDate() + nights);
  return d.toISOString().split('T')[0];
}

const DEPOSIT_PCT = 30;

export default function JourneyConfirmation({
  itinerary,
  cityStays,
  hotelsByMargin,
  selectedTransferIds,
  selectedActivities,
  activities,
  checkinDate,
  nights,
  adults,
  children,
  grandTotal,
  fmt,
  currency,
  edition,
  onConfirm,
  onBack,
}: ConfirmationProps) {

  // Sequential reveal: each card appears after a stagger
  const [visibleCount, setVisibleCount] = useState(0);
  const [allVisible,   setAllVisible]   = useState(false);
  const [confirming,   setConfirming]   = useState(false);

  const cities = itinerary?.cities ?? [];
  const totalItems = cities.length + 2; // cities + payment card + specialist card

  useEffect(() => {
    if (visibleCount >= totalItems) {
      setTimeout(() => setAllVisible(true), 400);
      return;
    }
    const t = setTimeout(() => setVisibleCount(v => v + 1), visibleCount === 0 ? 300 : 520);
    return () => clearTimeout(t);
  }, [visibleCount, totalItems]);

  const depositAmount = Math.round(grandTotal * DEPOSIT_PCT / 100);
  const checkoutDate  = addNights(checkinDate, nights);

  const handleConfirm = () => {
    setConfirming(true);
    setTimeout(() => onConfirm(), 800);
  };

  return (
    <>
      <style suppressHydrationWarning>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400;500&display=swap');

        .jc-root {
          min-height: 100vh; background: #080800;
          font-family: 'Jost', sans-serif; color: #f5f0e8;
          padding-bottom: 140px;
        }
        .jc-topbar {
          position: sticky; top: 0; z-index: 50;
          background: rgba(8,8,0,0.97); backdrop-filter: blur(20px);
          border-bottom: 0.5px solid rgba(200,169,110,0.15);
          padding: 0 20px; height: 58px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .jc-brand {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 17px;
          color: rgba(200,169,110,0.9);
        }
        .jc-back {
          background: none; border: 0.5px solid rgba(255,255,255,0.1);
          color: rgba(245,240,232,0.5); border-radius: 7px;
          padding: 6px 14px; font-size: 12px; cursor: pointer;
          font-family: 'Jost', sans-serif;
          transition: border-color 0.2s, color 0.2s;
        }
        .jc-back:hover { border-color: rgba(200,169,110,0.4); color: rgba(200,169,110,0.8); }

        .jc-body { max-width: 640px; margin: 0 auto; padding: 32px 20px 0; }

        /* Header */
        .jc-header { margin-bottom: 32px; text-align: center; }
        .jc-eyebrow {
          font-weight: 200; font-size: 10px; letter-spacing: 0.44em;
          text-transform: uppercase; color: rgba(200,169,110,0.7);
          margin-bottom: 10px;
        }
        .jc-title {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: clamp(28px, 5vw, 42px);
          color: #f5f0e8; line-height: 1.1; margin-bottom: 8px;
        }
        .jc-title em { font-style: italic; color: rgba(200,169,110,0.9); }
        .jc-subtitle {
          font-weight: 200; font-size: 13px; letter-spacing: 0.06em;
          color: rgba(245,240,232,0.35);
        }

        /* Divider */
        .jc-divider {
          display: flex; align-items: center; gap: 14px;
          margin: 24px 0;
        }
        .jc-divider-line { flex: 1; height: 0.5px; background: rgba(200,169,110,0.15); }
        .jc-divider-diamond {
          width: 7px; height: 7px; flex-shrink: 0;
          border: 1px solid rgba(200,169,110,0.5);
          transform: rotate(45deg);
        }

        /* Sequence item */
        .jc-item {
          opacity: 0; transform: translateY(20px);
          transition: opacity 0.55s cubic-bezier(0.22,1,0.36,1),
                      transform 0.55s cubic-bezier(0.22,1,0.36,1);
          margin-bottom: 14px;
        }
        .jc-item.visible { opacity: 1; transform: translateY(0); }

        /* Destination card */
        .jc-dest-card {
          background: rgba(255,255,255,0.028);
          border: 0.5px solid rgba(255,255,255,0.08);
          border-radius: 14px; overflow: hidden;
        }
        .jc-dest-card.featured {
          border-color: rgba(200,169,110,0.25);
          background: rgba(200,169,110,0.03);
        }
        .jc-dest-hero {
          position: relative; height: 180px; overflow: hidden;
        }
        .jc-dest-hero img {
          width: 100%; height: 100%; object-fit: cover;
          filter: saturate(0.85);
        }
        .jc-dest-hero-ov {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.78) 0%, transparent 55%);
        }
        .jc-dest-hero-text {
          position: absolute; bottom: 0; left: 0; right: 0;
          padding: 14px 18px; display: flex; justify-content: space-between; align-items: flex-end;
        }
        .jc-dest-name {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 22px; color: #fff; line-height: 1.1;
        }
        .jc-dest-nights {
          font-weight: 200; font-size: 10px; letter-spacing: 0.3em;
          text-transform: uppercase; color: rgba(200,169,110,0.8);
        }
        .jc-dest-body { padding: 16px 18px; }

        /* Lodge row */
        .jc-lodge-row {
          display: flex; align-items: flex-start; gap: 14px;
          padding-bottom: 14px; border-bottom: 0.5px solid rgba(255,255,255,0.05);
          margin-bottom: 14px;
        }
        .jc-lodge-img {
          width: 56px; height: 56px; border-radius: 8px;
          object-fit: cover; flex-shrink: 0;
          border: 0.5px solid rgba(200,169,110,0.2);
        }
        .jc-lodge-info { flex: 1; min-width: 0; }
        .jc-lodge-name {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 400; font-size: 16px; color: #f5f0e8;
          margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .jc-lodge-loc {
          font-weight: 200; font-size: 11px; color: rgba(245,240,232,0.38);
          letter-spacing: 0.06em;
        }
        .jc-lodge-trust {
          font-size: 11px; color: rgba(200,169,110,0.7);
          margin-top: 4px;
        }
        .jc-lodge-rate {
          text-align: right; flex-shrink: 0;
        }
        .jc-lodge-rate-num {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 18px;
          color: rgba(200,169,110,0.9);
        }
        .jc-lodge-rate-sub {
          font-weight: 200; font-size: 9px; letter-spacing: 0.12em;
          text-transform: uppercase; color: rgba(245,240,232,0.28);
        }

        /* Date row */
        .jc-date-row {
          display: flex; align-items: center; gap: 10px;
          font-weight: 300; font-size: 12px; color: rgba(245,240,232,0.45);
          margin-bottom: 10px;
        }
        .jc-date-dot {
          width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
          background: rgba(200,169,110,0.6);
        }
        .jc-date-strong { color: rgba(200,169,110,0.8); font-weight: 400; }

        /* Transfer row */
        .jc-transfer-row {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px;
          background: rgba(96,165,250,0.05);
          border: 0.5px solid rgba(96,165,250,0.15);
          border-radius: 8px; margin-bottom: 10px;
        }
        .jc-transfer-icon { font-size: 16px; flex-shrink: 0; }
        .jc-transfer-label {
          flex: 1; font-weight: 300; font-size: 12px;
          color: rgba(245,240,232,0.5);
        }
        .jc-transfer-cost {
          font-weight: 400; font-size: 13px;
          color: rgba(96,165,250,0.8);
        }

        /* Activities */
        .jc-activities { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 8px; }
        .jc-act-tag {
          font-weight: 300; font-size: 11px; letter-spacing: 0.06em;
          color: rgba(200,169,110,0.7);
          background: rgba(200,169,110,0.06);
          border: 0.5px solid rgba(200,169,110,0.2);
          border-radius: 20px; padding: 4px 11px;
        }

        /* Specialist card */
        .jc-specialist-card {
          background: rgba(200,169,110,0.04);
          border: 0.5px solid rgba(200,169,110,0.2);
          border-radius: 14px; padding: 18px;
          display: flex; gap: 16px; align-items: flex-start;
        }
        .jc-specialist-av {
          width: 52px; height: 52px; border-radius: 50%;
          object-fit: cover; flex-shrink: 0;
          border: 1.5px solid rgba(200,169,110,0.35);
        }
        .jc-specialist-name {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 400; font-size: 17px; color: rgba(200,169,110,0.9);
          margin-bottom: 2px;
        }
        .jc-specialist-role {
          font-weight: 200; font-size: 11px; letter-spacing: 0.1em;
          color: rgba(245,240,232,0.38); margin-bottom: 8px;
        }
        .jc-specialist-note {
          font-weight: 300; font-size: 12px; color: rgba(245,240,232,0.55);
          line-height: 1.65; font-style: italic;
        }
        .jc-specialist-avail {
          display: flex; align-items: center; gap: 6px;
          margin-top: 10px; font-weight: 200; font-size: 11px;
          color: rgba(74,222,128,0.7);
        }
        .jc-avail-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: rgba(74,222,128,0.7);
          animation: jcPulse 1.8s ease-in-out infinite;
        }
        @keyframes jcPulse {
          0%,100%{opacity:1;transform:scale(1)}
          50%{opacity:0.5;transform:scale(1.4)}
        }

        /* Payment card */
        .jc-payment-card {
          background: rgba(255,255,255,0.028);
          border: 0.5px solid rgba(200,169,110,0.25);
          border-radius: 14px; padding: 20px 22px;
        }
        .jc-payment-title {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 19px; color: #f5f0e8;
          margin-bottom: 16px;
        }
        .jc-payment-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 9px 0; border-bottom: 0.5px solid rgba(255,255,255,0.05);
        }
        .jc-payment-row:last-child { border-bottom: none; }
        .jc-payment-label {
          font-weight: 300; font-size: 13px; color: rgba(245,240,232,0.5);
        }
        .jc-payment-value {
          font-weight: 400; font-size: 14px; color: rgba(245,240,232,0.85);
        }
        .jc-payment-value.gold {
          font-family: 'Cormorant Garamond', serif;
          font-size: 20px; font-weight: 300;
          color: rgba(200,169,110,0.9);
        }
        .jc-payment-value.deposit {
          font-family: 'Cormorant Garamond', serif;
          font-size: 22px; font-weight: 300;
          color: rgba(200,169,110,1);
        }
        .jc-payment-note {
          margin-top: 12px; font-weight: 200; font-size: 11px;
          letter-spacing: 0.08em; color: rgba(245,240,232,0.28);
          line-height: 1.65;
        }

        /* Sticky CTA */
        .jc-sticky {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 90;
          background: rgba(8,8,0,0.97); backdrop-filter: blur(20px);
          border-top: 0.5px solid rgba(200,169,110,0.2);
          padding: 16px 20px;
          transition: opacity 0.5s ease;
        }
        .jc-sticky.hidden { opacity: 0; pointer-events: none; }
        .jc-sticky-inner {
          max-width: 640px; margin: 0 auto;
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
        }
        .jc-sticky-totals { flex: 1; min-width: 0; }
        .jc-sticky-total-label {
          font-weight: 200; font-size: 10px; letter-spacing: 0.2em;
          text-transform: uppercase; color: rgba(245,240,232,0.3);
          margin-bottom: 2px;
        }
        .jc-sticky-total {
          font-family: 'Cormorant Garamond', serif;
          font-weight: 300; font-size: 26px;
          color: rgba(200,169,110,0.95); line-height: 1;
        }
        .jc-sticky-deposit {
          font-weight: 200; font-size: 11px;
          color: rgba(245,240,232,0.35); margin-top: 3px;
        }
        .jc-confirm-btn {
          padding: 15px 32px;
          background: linear-gradient(135deg, #c8a020, #f0c840);
          border: none; border-radius: 2px;
          color: #080800; font-family: 'Jost', sans-serif;
          font-size: 14px; font-weight: 500; letter-spacing: 0.08em;
          cursor: pointer; flex-shrink: 0; white-space: nowrap;
          transition: opacity 0.2s, transform 0.2s;
        }
        .jc-confirm-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .jc-confirm-btn:disabled { opacity: 0.5; cursor: default; }
        .jc-confirm-btn.loading {
          background: rgba(200,169,110,0.3);
          animation: jcPulse 1.2s ease-in-out infinite;
        }

        @media(max-width:560px){
          .jc-sticky-inner{ flex-direction: column; gap: 10px; }
          .jc-confirm-btn { width: 100%; text-align: center; }
        }
      `}</style>

      <div className="jc-root">
        {/* Top bar */}
        <div className="jc-topbar">
          <div className="jc-brand">✦ {edition.name}</div>
          <button className="jc-back" onClick={onBack}>← Back to journey</button>
        </div>

        <div className="jc-body">
          {/* Header */}
          <div className="jc-header">
            <div className="jc-eyebrow">Confirming your journey</div>
            <div className="jc-title">
              Your <em>{nights}-night</em> journey
            </div>
            <div className="jc-subtitle">
              {checkinDate ? formatDate(checkinDate) : 'Dates TBC'} — {checkinDate ? formatDate(checkinDate, nights) : ''}
              {adults + children > 0 && ` · ${adults + children} traveller${adults + children !== 1 ? 's' : ''}`}
            </div>
          </div>

          {/* Per-destination cards */}
          {cities.map((city: any, cityIdx: number) => {
            const slug = slugFor(city.city);
            const stay = cityStays[cityIdx];
            const pool = slug
              ? hotelsByMargin.filter((h: any) => h.subRegion === slug)
              : hotelsByMargin;
            const hotel = pool.find((h: any) => String(h.id) === String(stay?.hotelId)) ?? pool[0];
            if (!hotel) return null;

            const { resolved } = resolveHotelUpgrades(hotel, stay?.prefs ?? { rooms: 0, basis: 0, flexibility: 0 });
            const extra = Object.values(resolved).reduce((s: number, v: any) => s + (v?.extra ?? 0), 0);
            const lodgeCost = Math.round((hotel.netRate * (stay?.nights ?? city.nights) + extra) * 1.15);

            // Activities for this region
            const regionActs = (selectedActivities[slug] ?? [])
              .map((id: string) => activities.find((a: any) => String(a.id) === id))
              .filter(Boolean);

            // Transfer to next city
            const nextCity = cities[cityIdx + 1];
            let transferLabel = '';
            let transferIcon  = '✈';
            let transferCost  = 0;
            if (nextCity) {
              const legKey = `${slug}→${slugFor(nextCity.city)}`;
              const selId  = selectedTransferIds[legKey];
              // We just show the route — cost comes from grandTotal
              transferLabel = `Transfer to ${nextCity.city}`;
              transferIcon  = '✈';
            }

            // Arrival date for this city
            const arrOffset = cities.slice(0, cityIdx).reduce((s: number, c: any) => s + c.nights, 0);
            const arrDate   = checkinDate ? formatDate(checkinDate, arrOffset) : 'TBC';
            const depDate   = checkinDate ? formatDate(checkinDate, arrOffset + (stay?.nights ?? city.nights)) : 'TBC';

            return (
              <div
                key={cityIdx}
                className={`jc-item ${cityIdx < visibleCount ? 'visible' : ''}`}
              >
                <div className={`jc-dest-card ${cityIdx === 0 ? 'featured' : ''}`}>
                  {/* Hero image */}
                  {hotel.image && (
                    <div className="jc-dest-hero">
                      <img src={hotel.image} alt={hotel.destination} />
                      <div className="jc-dest-hero-ov" />
                      <div className="jc-dest-hero-text">
                        <div>
                          <div className="jc-dest-name">{city.city}</div>
                          <div className="jc-dest-nights">{stay?.nights ?? city.nights} nights</div>
                        </div>
                        <div style={{ textAlign: 'right' as const }}>
                          <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 300, fontSize: 18, color: 'rgba(200,169,110,0.9)' }}>
                            {fmt(lodgeCost)}
                          </div>
                          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>lodge total</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="jc-dest-body">
                    {/* Dates */}
                    <div className="jc-date-row">
                      <div className="jc-date-dot" />
                      <span>Arrive <span className="jc-date-strong">{arrDate}</span></span>
                      <span style={{ color: 'rgba(245,240,232,0.2)', margin: '0 4px' }}>·</span>
                      <span>Depart <span className="jc-date-strong">{depDate}</span></span>
                    </div>

                    {/* Lodge */}
                    <div className="jc-lodge-row">
                      <img
                        src={hotel.image}
                        alt={hotel.name}
                        className="jc-lodge-img"
                      />
                      <div className="jc-lodge-info">
                        <div className="jc-lodge-name">{hotel.name}</div>
                        <div className="jc-lodge-loc">{hotel.destination} · {hotel.country}</div>
                        <div className="jc-lodge-trust">★ {hotel.trustScore}/100 trust score{hotel.malariaFree ? ' · ✓ Malaria-free' : ''}</div>
                      </div>
                      <div className="jc-lodge-rate">
                        <div className="jc-lodge-rate-num">{fmt(hotel.netRate * 1.15)}</div>
                        <div className="jc-lodge-rate-sub">per night</div>
                      </div>
                    </div>

                    {/* Activities */}
                    {regionActs.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 200, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: 'rgba(245,240,232,0.28)', marginBottom: 7 }}>
                          Included experiences
                        </div>
                        <div className="jc-activities">
                          {regionActs.map((act: any) => (
                            <div key={act.id} className="jc-act-tag">✦ {act.name}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Transfer to next */}
                    {nextCity && (
                      <div className="jc-transfer-row" style={{ marginTop: 12 }}>
                        <span className="jc-transfer-icon">{transferIcon}</span>
                        <span className="jc-transfer-label">{transferLabel}</span>
                        <span style={{ fontSize: 10, color: 'rgba(96,165,250,0.5)', letterSpacing: '0.1em' }}>
                          Confirmed by specialist
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Journey Specialist card */}
          <div
            className={`jc-item ${cities.length < visibleCount ? 'visible' : ''}`}
            style={{ marginTop: 8 }}
          >
            <JourneySpecialistCard nights={nights} cities={cities} fmt={fmt} />
          </div>

          {/* Payment summary card */}
          <div
            className={`jc-item ${cities.length + 1 < visibleCount ? 'visible' : ''}`}
          >
            <div className="jc-payment-card">
              <div className="jc-payment-title">Payment summary</div>
              <div className="jc-payment-row">
                <span className="jc-payment-label">Total journey value</span>
                <span className="jc-payment-value gold">{fmt(grandTotal)}</span>
              </div>
              <div className="jc-payment-row">
                <span className="jc-payment-label">
                  Deposit today ({DEPOSIT_PCT}%)
                </span>
                <span className="jc-payment-value deposit">{fmt(depositAmount)}</span>
              </div>
              <div className="jc-payment-row">
                <span className="jc-payment-label">Balance due</span>
                <span className="jc-payment-value">
                  {checkinDate
                    ? `30 days before travel — ${formatDate(addNights(checkinDate, -30))}`
                    : '30 days before travel'}
                </span>
              </div>
              <div className="jc-payment-row">
                <span className="jc-payment-label">Balance amount</span>
                <span className="jc-payment-value">{fmt(grandTotal - depositAmount)}</span>
              </div>
              <div className="jc-payment-note">
                Secure payment via PayFast · South African Rands ·
                Protected by ASATA membership · SSL encrypted
              </div>
            </div>
          </div>

          {/* Spacer */}
          <div style={{ height: 20 }} />
        </div>
      </div>

      {/* Sticky confirm bar */}
      <div className={`jc-sticky ${allVisible ? '' : 'hidden'}`}>
        <div className="jc-sticky-inner">
          <div className="jc-sticky-totals">
            <div className="jc-sticky-total-label">Deposit to secure</div>
            <div className="jc-sticky-total">{fmt(depositAmount)}</div>
            <div className="jc-sticky-deposit">
              {fmt(grandTotal - depositAmount)} balance due 30 days before travel
            </div>
          </div>
          <button
            className={`jc-confirm-btn ${confirming ? 'loading' : ''}`}
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming ? 'Preparing payment…' : `Pay Deposit ${fmt(depositAmount)} →`}
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Journey Specialist mini-card ─────────────────────────────────────────────
function JourneySpecialistCard({ nights, cities, fmt }: any) {
  const cityNames = (cities || []).map((c: any) => c.city).join(' & ');
  return (
    <div className="jc-specialist-card">
      <img
        src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&q=80"
        alt="Journey Specialist"
        className="jc-specialist-av"
      />
      <div style={{ flex: 1 }}>
        <div className="jc-specialist-name">Sarah Mitchell</div>
        <div className="jc-specialist-role">Senior Safari Specialist · {nights} nights · {cityNames}</div>
        <div className="jc-specialist-note">
          "I'll personally review your journey before your deposit is processed
          and confirm every lodge and transfer detail with you within 2 hours."
        </div>
        <div className="jc-specialist-avail">
          <div className="jc-avail-dot" />
          Available now · WhatsApp &amp; email
        </div>
      </div>
    </div>
  );
}
