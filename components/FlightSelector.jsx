'use client';

// ─────────────────────────────────────────────────────────────────────────────
// FlightSelector — International leg selection
// Supports: return, open jaw (system or custom), flexible dates (no search)
// Integrates with DuffelAncillaries for seats/bags
// Part of Module 2: Experience Designer — builder screen
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';

const SA_GATEWAYS = [
  { iata: 'JNB', city: 'Johannesburg', note: 'Main hub · Kruger, Okavango, Madikwe' },
  { iata: 'CPT', city: 'Cape Town',    note: 'Direct UK/EU flights · Best for Cape Town start/end' },
  { iata: 'VFA', city: 'Victoria Falls', note: 'Zimbabwe · Ideal if ending at Vic Falls' },
];

const CABIN_OPTIONS = [
  { value: 'economy',         label: 'Economy' },
  { value: 'premium_economy', label: 'Premium Economy' },
  { value: 'business',        label: 'Business' },
  { value: 'first',           label: 'First Class' },
];

// Cabin imagery — curated per carrier, Unsplash fallback
const CABIN_IMAGES = {
  business: 'https://images.unsplash.com/photo-1540339832862-474599807836?w=800&q=80',
  first:    'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800&q=80',
  premium_economy: 'https://images.unsplash.com/photo-1569629743817-70d8db6c323b?w=800&q=80',
  economy:  null,
};

function fmt(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency', currency,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(amount);
}

function formatTime(datetime) {
  if (!datetime) return '—';
  return new Date(datetime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(datetime) {
  if (!datetime) return '—';
  return new Date(datetime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatDuration(minutes) {
  if (!minutes) return '—';
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

const T = {
  bg:         '#080818',
  surface:    '#1a1a2e',
  gold:       '#d4af37',
  goldDim:    'rgba(212,175,55,0.15)',
  borderGold: 'rgba(212,175,55,0.3)',
  text:       '#f5f0e8',
  textMid:    'rgba(245,240,232,0.6)',
  textDim:    'rgba(245,240,232,0.35)',
  border:     'rgba(255,255,255,0.08)',
  green:      '#4ade80',
};

const label = {
  fontSize: '10px', letterSpacing: '0.12em', textTransform: 'uppercase',
  color: T.textDim, fontFamily: 'inherit', marginBottom: '6px', display: 'block',
};

const input = {
  background: 'rgba(255,255,255,0.05)', border: `1px solid ${T.border}`,
  borderRadius: '8px', color: T.text, fontFamily: 'inherit',
  fontSize: '13px', padding: '10px 13px', width: '100%', outline: 'none',
  boxSizing: 'border-box',
};

const select = {
  ...input, cursor: 'pointer', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='rgba(255,255,255,0.4)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 13px center', paddingRight: '34px',
};

// ── Flight card ───────────────────────────────────────────────────────────────
function FlightCard({ offer, isSelected, onSelect, passengers }) {
  const outbound = offer.slices?.[0];
  const inbound  = offer.slices?.[1];
  const carrier  = outbound?.segments?.[0];
  const dep      = outbound?.departure_datetime;
  const arr      = outbound?.arrival_datetime;

  return (
    <div
      onClick={() => onSelect(offer)}
      style={{
        background: isSelected ? 'rgba(212,175,55,0.07)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isSelected ? T.gold : T.border}`,
        borderRadius: '8px', padding: '16px 18px', cursor: 'pointer',
        transition: 'all 0.15s ease', marginBottom: '8px', position: 'relative',
      }}
    >
      {isSelected && (
        <div style={{
          position: 'absolute', top: '10px', right: '14px',
          width: '18px', height: '18px', borderRadius: '50%', background: T.gold,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="10" height="7" viewBox="0 0 10 7" fill="none">
            <path d="M1 3.5L3.5 6L9 1" stroke="#0a0a0a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}

      {/* Outbound row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Carrier */}
        <div style={{ width: '120px', flexShrink: 0 }}>
          {carrier?.carrier_logo
            ? <img src={carrier.carrier_logo} alt={carrier.carrier_name} style={{ height: '18px', filter: 'brightness(0) invert(1) opacity(0.6)' }} />
            : <span style={{ fontSize: '11px', color: T.textDim }}>{carrier?.carrier_name || '—'}</span>
          }
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', marginTop: '2px' }}>{carrier?.flight_number}</div>
        </div>

        {/* Dep time */}
        <div style={{ textAlign: 'center', minWidth: '52px' }}>
          <div style={{ fontSize: '20px', fontFamily: "'Playfair Display',serif", color: '#fff', lineHeight: 1 }}>{formatTime(dep)}</div>
          <div style={{ fontSize: '10px', color: T.textDim, marginTop: '2px' }}>{outbound?.origin?.iata}</div>
        </div>

        {/* Route */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
          <div style={{ fontSize: '10px', color: T.textDim }}>{formatDuration(outbound?.duration_minutes)}</div>
          <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.12)' }} />
          <div style={{ fontSize: '10px', color: offer.slices?.[0]?.stops === 0 ? T.green : '#c9a96e' }}>
            {outbound?.stops === 0 ? 'Direct' : `${outbound?.stops} stop`}
          </div>
        </div>

        {/* Arr time */}
        <div style={{ textAlign: 'center', minWidth: '52px' }}>
          <div style={{ fontSize: '20px', fontFamily: "'Playfair Display',serif", color: '#fff', lineHeight: 1 }}>{formatTime(arr)}</div>
          <div style={{ fontSize: '10px', color: T.textDim, marginTop: '2px' }}>{outbound?.destination?.iata}</div>
        </div>

        {/* Price */}
        <div style={{ marginLeft: 'auto', paddingLeft: '16px', textAlign: 'right', minWidth: '90px' }}>
          <div style={{ fontSize: '18px', fontFamily: "'Playfair Display',serif", color: T.gold, lineHeight: 1 }}>
            {fmt(offer.display_price, offer.currency)}
          </div>
          <div style={{ fontSize: '10px', color: T.textDim, marginTop: '2px' }}>per person</div>
        </div>
      </div>

      {/* Return / open jaw row */}
      {inbound && (
        <>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '12px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '120px', flexShrink: 0 }}>
              <span style={{ fontSize: '10px', color: T.textDim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {offer.is_open_jaw ? 'Return (open jaw)' : 'Return'}
              </span>
            </div>
            <div style={{ textAlign: 'center', minWidth: '52px' }}>
              <div style={{ fontSize: '16px', fontFamily: "'Playfair Display',serif", color: 'rgba(255,255,255,0.65)', lineHeight: 1 }}>{formatTime(inbound?.departure_datetime)}</div>
              <div style={{ fontSize: '10px', color: T.textDim, marginTop: '2px' }}>{inbound?.origin?.iata}</div>
            </div>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.08)' }} />
            <div style={{ textAlign: 'center', minWidth: '52px' }}>
              <div style={{ fontSize: '16px', fontFamily: "'Playfair Display',serif", color: 'rgba(255,255,255,0.65)', lineHeight: 1 }}>{formatTime(inbound?.arrival_datetime)}</div>
              <div style={{ fontSize: '10px', color: T.textDim, marginTop: '2px' }}>{inbound?.destination?.iata}</div>
            </div>
            <div style={{ marginLeft: 'auto', paddingLeft: '16px', minWidth: '90px' }} />
          </div>
        </>
      )}

      {/* Conditions */}
      <div style={{ marginTop: '10px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {offer.baggage?.length > 0 && (
          <span style={{ fontSize: '10px', color: T.textDim }}>
            ✓ {offer.baggage[0].quantity}× {offer.baggage[0].type?.replace('_', ' ')}
          </span>
        )}
        {offer.conditions?.refundable && (
          <span style={{ fontSize: '10px', color: T.textDim }}>✓ Refundable</span>
        )}
        {offer.conditions?.fare_conditions && (
          <span style={{ fontSize: '10px', color: 'rgba(248,113,113,0.6)' }}>
            {offer.conditions.fare_conditions}
          </span>
        )}
        {offer.expires_at && (
          <span style={{ fontSize: '10px', color: 'rgba(212,175,55,0.4)', marginLeft: 'auto' }}>
            Price held until {formatTime(offer.expires_at)}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Optimisation tip pill ─────────────────────────────────────────────────────
function OptimisationTip({ icon, text, saving, onAccept, onDismiss, currency = 'USD' }) {
  return (
    <div style={{
      background: 'rgba(74,222,128,0.06)', border: '0.5px solid rgba(74,222,128,0.25)',
      borderRadius: '10px', padding: '11px 14px', marginBottom: '10px',
      display: 'flex', alignItems: 'center', gap: '10px',
    }}>
      <span style={{ fontSize: '16px', flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '12px', color: T.green, fontWeight: 600, marginBottom: '2px' }}>{text}</div>
        {saving > 0 && (
          <div style={{ fontSize: '11px', color: T.textDim }}>
            Save {fmt(saving, currency)} total
          </div>
        )}
      </div>
      <button onClick={onAccept} style={{
        background: 'rgba(74,222,128,0.15)', border: '0.5px solid rgba(74,222,128,0.4)',
        color: T.green, borderRadius: '6px', padding: '5px 12px', fontSize: '11px',
        cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, flexShrink: 0,
      }}>Apply</button>
      <button onClick={onDismiss} style={{
        background: 'none', border: 'none', color: T.textDim, cursor: 'pointer',
        fontSize: '14px', fontFamily: 'inherit', flexShrink: 0, padding: '0 2px',
      }}>×</button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FlightSelector({
  // From inspire-input state
  flightIntent,        // 'include' | 'own' | 'flexible'
  originIata,          // e.g. 'LHR'
  gatewayPreference,   // 'return' | 'open_jaw' | 'custom'
  preferredArrivalGateway,   // e.g. 'JNB' or null
  preferredDepartureGateway, // e.g. 'CPT' or null
  travelDates,         // { start: '2026-07-01', end: '2026-07-14' }
  passengers,
  // Route reversal tip (calculated in page.tsx from INTERNAL_LEGS)
  routeReversalResult, // { saving, reversed_city_order, is_cheaper }
  // Callbacks
  onFlightSelected,    // ({ offer, ancillaries, ancillary_total, open_jaw_used }) => void
  onOwnFlightDetails,  // (details) => void
  onDismissFlights,    // () => void — traveller skips flights
  onAcceptRouteReversal, // (reversed_city_order) => void
  // Display
  currency,            // { code: 'USD', symbol: '$', rate: 18.62 }
  fmt: fmtExternal,    // formatter from pricing.ts — use this if provided
}) {

  const formatPrice = fmtExternal || ((zarAmount) => fmt(Math.round(zarAmount / (currency?.rate || 18.62)), currency?.code || 'USD'));

  const [step, setStep] = useState(() => {
    if (flightIntent === 'flexible') return 'flexible';
    if (flightIntent === 'own')      return 'own_details';
    return 'search';
  });

  // Search state
  const [arrivalGateway,   setArrivalGateway]   = useState(preferredArrivalGateway   || 'JNB');
  const [departureGateway, setDepartureGateway] = useState(preferredDepartureGateway || 'JNB');
  const [isOpenJaw,        setIsOpenJaw]        = useState(gatewayPreference === 'open_jaw');
  const [depDate,          setDepDate]          = useState(travelDates?.start || '');
  const [retDate,          setRetDate]          = useState(travelDates?.end   || '');
  const [isReturn,         setIsReturn]         = useState(true);
  const [cabinClass,       setCabinClass]       = useState('economy');

  // Results state
  const [offers,       setOffers]       = useState([]);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [searchMeta,   setSearchMeta]   = useState(null);
  const [clientKey,    setClientKey]    = useState(null);

  // Open jaw tip state
  const [openJawTip,       setOpenJawTip]       = useState(null);
  const [routeTipDismissed, setRouteTipDismissed] = useState(false);
  const [openJawDismissed,  setOpenJawDismissed]  = useState(false);

  // Own flight details state
  const [ownDetails, setOwnDetails] = useState({
    arrivalAirport:  'JNB',
    arrivalDate:     travelDates?.start || '',
    arrivalTime:     '',
    departureAirport: 'JNB',
    departureDate:   travelDates?.end   || '',
    departureTime:   '',
  });

  // Ancillaries — populated by DuffelAncillaries component after flight selected
  const [ancillaries,     setAncillaries]     = useState(null);
  const [ancillaryTotal,  setAncillaryTotal]  = useState(0);
  const [showAncillaries, setShowAncillaries] = useState(false);

  const passengerCount = passengers || 2;

  const handleSearch = async () => {
    setLoading(true); setError(null); setOffers([]);

    try {
      const res = await fetch('/api/flights/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin:             originIata,
          arrival_gateway:    arrivalGateway,
          departure_gateway:  isOpenJaw ? departureGateway : arrivalGateway,
          departure_date:     depDate,
          return_date:        isReturn ? retDate : undefined,
          passengers:         passengerCount,
          cabin_class:        cabinClass,
          is_open_jaw:        isOpenJaw,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to load flights'); return; }

      setOffers(data.offers || []);
      setSearchMeta(data);
      setClientKey(data.client_key);

      // Check if open jaw is available and cheaper
      // This fires only when we have real Duffel data
      if (!isOpenJaw && data.offers?.length > 0 && arrivalGateway === 'JNB') {
        // Silently check CPT departure option if arriving JNB
        // (This would be a second Duffel call in production — stub for now)
        // When implemented: compare total (flight + final transfer) for both options
      }

    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmFlight = () => {
    if (!selectedOffer) return;
    if (onFlightSelected) {
      onFlightSelected({
        offer:            selectedOffer,
        ancillaries:      ancillaries,
        ancillary_total:  ancillaryTotal,
        open_jaw_used:    isOpenJaw,
        arrival_gateway:  arrivalGateway,
        departure_gateway: isOpenJaw ? departureGateway : arrivalGateway,
      });
    }
  };

  const handleConfirmOwn = () => {
    if (onOwnFlightDetails) onOwnFlightDetails(ownDetails);
  };

  const totalWithAncillaries = selectedOffer
    ? (selectedOffer.display_price * passengerCount) + ancillaryTotal
    : 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>

      {/* Route reversal tip — fires immediately, uses real transfer cost data */}
      {routeReversalResult?.is_cheaper && !routeTipDismissed && (
        <OptimisationTip
          icon="🔄"
          text={`Reverse your route — start in ${routeReversalResult.reversed_city_order[0]} instead`}
          saving={Math.round(routeReversalResult.saving / (currency?.rate || 18.62))}
          currency={currency?.code || 'USD'}
          onAccept={() => {
            setRouteTipDismissed(true);
            if (onAcceptRouteReversal) onAcceptRouteReversal(routeReversalResult.reversed_city_order);
          }}
          onDismiss={() => setRouteTipDismissed(true)}
        />
      )}

      {/* Open jaw tip — fires only when real Duffel data confirms saving */}
      {openJawTip && !openJawDismissed && (
        <OptimisationTip
          icon="✈"
          text={`Fly home from ${openJawTip.departure_city} — open jaw saves you ${fmt(openJawTip.net_saving, currency?.code)}`}
          saving={openJawTip.net_saving}
          currency={currency?.code || 'USD'}
          onAccept={() => {
            setOpenJawDismissed(true);
            setIsOpenJaw(true);
            setDepartureGateway(openJawTip.departure_gateway);
          }}
          onDismiss={() => setOpenJawDismissed(true)}
        />
      )}

      {/* ── FLEXIBLE DATES STATE ── */}
      {step === 'flexible' && (
        <div style={{
          background: 'rgba(212,175,55,0.06)', border: `0.5px solid ${T.borderGold}`,
          borderRadius: '12px', padding: '18px 20px',
        }}>
          <div style={{ fontSize: '11px', color: T.gold, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '6px' }}>✦ International flights</div>
          <div style={{ fontSize: '14px', color: T.text, fontWeight: 600, marginBottom: '8px' }}>Your Journey Specialist will find the best fares</div>
          <div style={{ fontSize: '12px', color: T.textDim, lineHeight: 1.65 }}>
            Once you confirm your travel window, your specialist will search for the best international fares and present options before your deposit is collected. International flights are not included in your package total until confirmed.
          </div>
        </div>
      )}

      {/* ── OWN FLIGHT DETAILS ── */}
      {step === 'own_details' && (
        <div style={{ background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '12px', padding: '18px 20px' }}>
          <div style={{ fontSize: '11px', color: T.gold, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '14px' }}>Your arrival & departure details</div>
          <div style={{ fontSize: '12px', color: T.textDim, marginBottom: '16px', lineHeight: 1.6 }}>
            Share your flight details so we can plan your lodges, transfers and game drive timings around your schedule.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={label}>Arriving into</label>
              <select value={ownDetails.arrivalAirport} onChange={e => setOwnDetails(p => ({ ...p, arrivalAirport: e.target.value }))} style={select}>
                {SA_GATEWAYS.map(g => <option key={g.iata} value={g.iata}>{g.iata} — {g.city}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Arrival date</label>
              <input type="date" value={ownDetails.arrivalDate} onChange={e => setOwnDetails(p => ({ ...p, arrivalDate: e.target.value }))} style={input} />
            </div>
            <div>
              <label style={label}>Arrival time</label>
              <input type="time" value={ownDetails.arrivalTime} onChange={e => setOwnDetails(p => ({ ...p, arrivalTime: e.target.value }))} style={input} />
            </div>
            <div>
              <label style={label}>Departing from</label>
              <select value={ownDetails.departureAirport} onChange={e => setOwnDetails(p => ({ ...p, departureAirport: e.target.value }))} style={select}>
                {SA_GATEWAYS.map(g => <option key={g.iata} value={g.iata}>{g.iata} — {g.city}</option>)}
              </select>
            </div>
            <div>
              <label style={label}>Departure date</label>
              <input type="date" value={ownDetails.departureDate} onChange={e => setOwnDetails(p => ({ ...p, departureDate: e.target.value }))} style={input} />
            </div>
            <div>
              <label style={label}>Departure time</label>
              <input type="time" value={ownDetails.departureTime} onChange={e => setOwnDetails(p => ({ ...p, departureTime: e.target.value }))} style={input} />
            </div>
          </div>
          <button
            onClick={handleConfirmOwn}
            disabled={!ownDetails.arrivalDate || !ownDetails.departureDate}
            style={{
              marginTop: '16px', background: T.gold, color: '#0a0a0a', border: 'none',
              borderRadius: '8px', padding: '11px 24px', fontFamily: 'inherit',
              fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase',
              cursor: 'pointer', fontWeight: 700,
              opacity: (!ownDetails.arrivalDate || !ownDetails.departureDate) ? 0.4 : 1,
            }}
          >
            Save flight details →
          </button>
        </div>
      )}

      {/* ── SEARCH FORM ── */}
      {step === 'search' && (
        <div>
          <div style={{ fontSize: '11px', color: T.gold, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '14px' }}>✈ International flights from {originIata}</div>

          {/* Trip type */}
          <div style={{ display: 'flex', gap: '0', marginBottom: '16px', border: `0.5px solid ${T.border}`, borderRadius: '8px', overflow: 'hidden', width: 'fit-content' }}>
            {[{ val: true, label: 'Return' }, { val: false, label: 'One way' }].map(opt => (
              <button key={String(opt.val)} onClick={() => setIsReturn(opt.val)} style={{
                padding: '7px 18px', background: isReturn === opt.val ? T.goldDim : 'transparent',
                border: 'none', color: isReturn === opt.val ? T.gold : T.textDim,
                fontFamily: 'inherit', fontSize: '11px', letterSpacing: '0.08em',
                cursor: 'pointer', textTransform: 'uppercase',
              }}>{opt.label}</button>
            ))}
          </div>

          {/* Gateway routing */}
          <div style={{ marginBottom: '16px' }}>
            <label style={label}>Gateway routing</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {[
                { val: false, label: 'Return — same airport in and out', sub: 'e.g. LHR → JNB → LHR' },
                { val: true,  label: 'Open jaw — system finds cheapest combination', sub: 'e.g. LHR → JNB … CPT → LHR  (saves on final transfer)' },
              ].map(opt => (
                <button key={String(opt.val)} onClick={() => setIsOpenJaw(opt.val)} style={{
                  padding: '10px 14px', borderRadius: '8px', textAlign: 'left',
                  border: `1px solid ${isOpenJaw === opt.val ? T.gold : T.border}`,
                  background: isOpenJaw === opt.val ? T.goldDim : 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}>
                  <div style={{ fontSize: '13px', color: isOpenJaw === opt.val ? T.gold : T.text }}>{opt.label}</div>
                  <div style={{ fontSize: '10px', color: T.textDim, marginTop: '2px' }}>{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
            <div>
              <label style={label}>Arriving into</label>
              <select value={arrivalGateway} onChange={e => setArrivalGateway(e.target.value)} style={select}>
                {SA_GATEWAYS.map(g => <option key={g.iata} value={g.iata}>{g.iata} — {g.city}</option>)}
              </select>
            </div>
            {isOpenJaw && (
              <div>
                <label style={label}>Flying home from</label>
                <select value={departureGateway} onChange={e => setDepartureGateway(e.target.value)} style={select}>
                  {SA_GATEWAYS.map(g => <option key={g.iata} value={g.iata}>{g.iata} — {g.city}</option>)}
                </select>
              </div>
            )}
            <div>
              <label style={label}>Departure date</label>
              <input type="date" value={depDate} onChange={e => setDepDate(e.target.value)} style={input} />
            </div>
            {isReturn && (
              <div>
                <label style={label}>Return date</label>
                <input type="date" value={retDate} onChange={e => setRetDate(e.target.value)} style={input} />
              </div>
            )}
            <div>
              <label style={label}>Cabin class</label>
              <select value={cabinClass} onChange={e => setCabinClass(e.target.value)} style={select}>
                {CABIN_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          {/* Cabin upgrade image */}
          {CABIN_IMAGES[cabinClass] && (
            <div style={{ marginBottom: '14px', borderRadius: '8px', overflow: 'hidden', height: '120px', position: 'relative' }}>
              <img src={CABIN_IMAGES[cabinClass]} alt={cabinClass} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, rgba(0,0,0,0.5) 0%, transparent 60%)' }} />
              <div style={{ position: 'absolute', bottom: '10px', left: '14px' }}>
                <div style={{ fontSize: '11px', color: T.gold, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>
                  {CABIN_OPTIONS.find(c => c.value === cabinClass)?.label}
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleSearch}
            disabled={!depDate || (isReturn && !retDate)}
            style={{
              background: T.gold, color: '#0a0a0a', border: 'none', borderRadius: '8px',
              padding: '12px 28px', fontFamily: 'inherit', fontSize: '12px',
              letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
              fontWeight: 700, opacity: (!depDate || (isReturn && !retDate)) ? 0.4 : 1,
            }}
          >
            Search flights →
          </button>
        </div>
      )}

      {/* ── RESULTS ── */}
      {step === 'search' && (loading || offers.length > 0 || error) && (
        <div style={{ marginTop: '20px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{
                width: '28px', height: '28px', border: `1px solid rgba(212,175,55,0.3)`,
                borderTop: `1px solid ${T.gold}`, borderRadius: '50%',
                animation: 'spin 1s linear infinite', margin: '0 auto 12px',
              }} />
              <div style={{ fontSize: '12px', color: T.textDim }}>Searching all carriers…</div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {error && (
            <div style={{ padding: '14px', background: 'rgba(248,113,113,0.08)', border: '0.5px solid rgba(248,113,113,0.25)', borderRadius: '8px', fontSize: '12px', color: 'rgba(248,113,113,0.85)' }}>
              {error}
            </div>
          )}

          {!loading && offers.length > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '11px', color: T.textDim }}>
                  {offers.length} option{offers.length !== 1 ? 's' : ''} · sorted by price
                </span>
                {searchMeta?.total_offers_available > offers.length && (
                  <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>
                    Best {offers.length} of {searchMeta.total_offers_available}
                  </span>
                )}
              </div>

              {offers.map(offer => (
                <FlightCard
                  key={offer.id}
                  offer={offer}
                  isSelected={selectedOffer?.id === offer.id}
                  onSelect={setSelectedOffer}
                  passengers={passengerCount}
                />
              ))}
            </>
          )}

          {/* Confirmation bar */}
          {selectedOffer && !loading && (
            <div style={{
              marginTop: '16px', padding: '16px 18px',
              background: 'rgba(212,175,55,0.06)', border: `0.5px solid ${T.borderGold}`,
              borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
            }}>
              <div>
                <div style={{ fontSize: '11px', color: T.textDim, marginBottom: '3px' }}>
                  {passengerCount} passenger{passengerCount !== 1 ? 's' : ''} · paid in full at booking
                </div>
                <div style={{ fontSize: '20px', fontFamily: "'Playfair Display',serif", color: T.gold, lineHeight: 1 }}>
                  {fmt(totalWithAncillaries, selectedOffer.currency)} total
                </div>
                {ancillaryTotal > 0 && (
                  <div style={{ fontSize: '10px', color: T.textDim, marginTop: '2px' }}>
                    Flights {fmt(selectedOffer.display_price * passengerCount, selectedOffer.currency)} + extras {fmt(ancillaryTotal, selectedOffer.currency)}
                  </div>
                )}
                <div style={{ fontSize: '10px', color: 'rgba(248,113,113,0.6)', marginTop: '2px' }}>
                  Non-refundable · full payment at booking
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
                <button
                  onClick={handleConfirmFlight}
                  style={{
                    background: T.gold, color: '#0a0a0a', border: 'none', borderRadius: '8px',
                    padding: '11px 20px', fontFamily: 'inherit', fontSize: '12px',
                    letterSpacing: '0.08em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 700,
                  }}
                >
                  Add to package →
                </button>
                <button
                  onClick={() => setShowAncillaries(v => !v)}
                  style={{
                    background: 'none', border: `0.5px solid ${T.border}`, color: T.textDim,
                    borderRadius: '8px', padding: '7px 12px', fontFamily: 'inherit',
                    fontSize: '11px', cursor: 'pointer', textAlign: 'center',
                  }}
                >
                  {showAncillaries ? '↑ Hide seats & bags' : '+ Select seats & bags'}
                </button>
              </div>
            </div>
          )}

          {/* DuffelAncillaries component mount point */}
          {showAncillaries && selectedOffer && clientKey && (
            <div style={{ marginTop: '12px', padding: '16px', background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: '10px' }}>
              <div style={{ fontSize: '11px', color: T.gold, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700, marginBottom: '12px' }}>
                Seats & baggage
              </div>
              {/* DuffelAncillaries renders here — requires @duffel/components installed */}
              {/* 
                <DuffelAncillaries
                  offer={selectedOffer}
                  seat_maps={seatMaps}
                  services={["bags", "seats"]}
                  passengers={selectedOffer.passengers}
                  styles={{ accentColor: "212,175,55", buttonCornerRadius: "8px" }}
                  onPayloadReady={(payload, metadata) => {
                    setAncillaries(payload);
                    const total = metadata.reduce((s, m) => s + (m.total?.amount || 0), 0);
                    setAncillaryTotal(total);
                  }}
                />
              */}
              <div style={{ fontSize: '12px', color: T.textDim, lineHeight: 1.6 }}>
                Seat selection and additional baggage options load here once <code style={{ color: T.gold }}>@duffel/components</code> is installed and the package.json commit deploys.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
