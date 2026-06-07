'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// FlightSelector.jsx — v2.0  (Safari Edition / Travel Catalogue)
// SIMPLIFIED per spec:
//   1. Departure city is the only required input
//   2. Flights auto-search on city select (+ when date changes) — no Search button
//   3. Departure date input; return date derived from package nights (travelDates.end)
//   4. Three tiles: Recommended (pre-selected, first) · Quickest · Cheapest
//   5. Selected price flows to package total via onFlightSelected
//   6. Two buttons: Upgrade (business re-search, price delta) · I'll book my own flights
//   7. Selected flight's arrival gateway carries into onward transfer logic
//
// Margin: handled server-side (route.js). Hybrid — flat 8% today, optimiser hook dormant.
// Prop + callback contract is UNCHANGED from v1 — page.tsx needs no edits.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';

// Departure cities travellers fly FROM (international origins)
const ORIGIN_CITIES = [
  { code: 'LHR', label: 'London Heathrow',  flag: '🇬🇧' },
  { code: 'LGW', label: 'London Gatwick',   flag: '🇬🇧' },
  { code: 'MAN', label: 'Manchester',       flag: '🇬🇧' },
  { code: 'AMS', label: 'Amsterdam',        flag: '🇳🇱' },
  { code: 'FRA', label: 'Frankfurt',        flag: '🇩🇪' },
  { code: 'JFK', label: 'New York (JFK)',   flag: '🇺🇸' },
  { code: 'LAX', label: 'Los Angeles',      flag: '🇺🇸' },
  { code: 'DXB', label: 'Dubai',            flag: '🇦🇪' },
  { code: 'SYD', label: 'Sydney',           flag: '🇦🇺' },
];

const TILE_META = {
  recommended: { label: 'Recommended', color: '#d4af37', sub: 'Best blend of price & routing' },
  quickest:    { label: 'Quickest',    color: '#60a5fa', sub: 'Shortest total travel time' },
  cheapest:    { label: 'Cheapest',    color: '#4ade80', sub: 'Lowest fare we found' },
  option:      { label: 'Option',      color: '#a78bfa', sub: 'Alternative' },
};

function formatTime(dt) {
  if (!dt) return '';
  try { return new Date(dt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}
function formatDuration(mins) {
  if (!mins) return '';
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h}h${m > 0 ? ` ${m}m` : ''}`;
}

export default function FlightSelector({
  flightIntent,                 // 'include' | 'own' | 'flexible'
  originIata,                   // e.g. 'LHR'
  gatewayPreference,            // 'return' | 'open_jaw' | 'custom'
  preferredArrivalGateway,      // where itinerary STARTS (e.g. 'CPT')
  preferredDepartureGateway,    // where itinerary ENDS (e.g. 'JNB') — quiet open-jaw
  travelDates,                  // { start, end } — end derived from package nights
  passengers,
  routeReversalResult,
  onFlightSelected,
  onOwnFlightDetails,
  onDismissFlights,
  onAcceptRouteReversal,
  currency,
  fmt: fmtExternal,
}) {
  const T = {
    gold:'#d4af37', goldLight:'#f0c040', goldDim:'rgba(212,175,55,0.1)', borderGold:'rgba(212,175,55,0.3)',
    text:'#f5f0e8', textMid:'rgba(245,240,232,0.7)', textDim:'rgba(245,240,232,0.4)',
    bg3:'rgba(255,255,255,0.05)', surface:'rgba(255,255,255,0.03)', border:'rgba(255,255,255,0.1)',
    green:'#4ade80', blue:'#60a5fa',
  };

  const passengerCount = Math.max(passengers || 1, 1);
  const usdRate = currency?.rate || 18.62;
  // Tiles show per-package price in the active display currency.
  const fmtPrice = (usdPerPax) => {
    const totalUsd = usdPerPax * passengerCount;
    if (fmtExternal) return fmtExternal(totalUsd * usdRate); // page passes ZAR-formatter
    return `${currency?.symbol || '$'}${Math.round(totalUsd).toLocaleString()}`;
  };

  // ── State ──
  const [city,      setCity]      = useState(originIata || '');
  // Sync city when originIata arrives after mount (e.g. from inspire flow)
  useEffect(() => { if (originIata && !city) setCity(originIata); }, [originIata]);
  const [depDate,   setDepDate]   = useState(travelDates?.start || '');
  const [cabin,     setCabin]     = useState('economy');
  const [offers,    setOffers]    = useState([]);
  const [selected,  setSelected]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [clientKey, setClientKey] = useState(null);
  const [routeTipDismissed, setRouteTipDismissed] = useState(false);

  // Own-flight details (when flightIntent === 'own')
  const [own, setOwn] = useState({ arrivalAirport: preferredArrivalGateway || 'JNB', arrivalDate: travelDates?.start || '', arrivalTime: '', flightNo: '' });
  const [flightSaved, setFlightSaved] = useState(false);

  // Return date derived from package nights = travelDates.end
  const retDate = travelDates?.end || '';
  // Arrival gateway = itinerary start; departure gateway = itinerary end (quiet open-jaw)
  const arrivalGateway   = preferredArrivalGateway   || 'JNB';
  const departureGateway = preferredDepartureGateway || arrivalGateway;
  const isOpenJaw = departureGateway !== arrivalGateway;

  // ── Auto-search: fires on city, date, or cabin change ──
  const runSearch = useCallback(async (cabinClass) => {
    if (!city || !depDate) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/flights/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: city,
          arrival_gateway: arrivalGateway,
          departure_gateway: departureGateway,
          departure_date: depDate,
          return_date: retDate || undefined,
          passengers: passengerCount,
          cabin_class: cabinClass || cabin,
          is_open_jaw: isOpenJaw,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Could not load flights'); setOffers([]); return; }
      const tiles = data.offers || [];
      setOffers(tiles);
      setClientKey(data.client_key);
      // Auto-select the recommended tile (first), else first tile
      const rec = tiles.find(o => o.tile_label === 'recommended') || tiles[0] || null;
      setSelected(rec);
      if (rec) emitSelection(rec);
    } catch {
      setError('Something went wrong finding flights. Please try again.');
      setOffers([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, depDate, retDate, passengerCount, cabin, arrivalGateway, departureGateway, isOpenJaw]);

  // Fire search automatically when inputs are ready / change
  useEffect(() => {
    if (flightIntent === 'include' && city && depDate) runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, depDate, flightIntent]);

  const emitSelection = (offer) => {
    onFlightSelected && onFlightSelected({
      offer,
      ancillaries: null,
      ancillary_total: 0,
      open_jaw_used: isOpenJaw,
      arrival_gateway: arrivalGateway,
      departure_gateway: departureGateway,
    });
  };

  const handleSelect = (offer) => { setSelected(offer); emitSelection(offer); };

  const handleUpgrade = () => {
    const next = cabin === 'economy' ? 'business' : 'economy';
    setCabin(next);
    runSearch(next);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // FLEXIBLE — no search; specialist sources fares later
  // ─────────────────────────────────────────────────────────────────────────
  if (flightIntent === 'flexible') {
    return (
      <div>
        <div style={{ fontSize:11, color:T.gold, textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:700, marginBottom:8 }}>✈ International flights</div>
        <div style={{ background:T.goldDim, border:`0.5px solid ${T.borderGold}`, borderRadius:12, padding:'14px 16px', fontSize:13, color:T.textMid, lineHeight:1.6 }}>
          Your Journey Specialist will source the best international fares once your travel dates are confirmed. Build the rest of your package now — flights slot in seamlessly.
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // OWN — traveller already booked; collect arrival details for onward logistics
  // ─────────────────────────────────────────────────────────────────────────
  if (flightIntent === 'own') {
    return (
      <div>
        <div style={{ fontSize:11, color:T.gold, textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:700, marginBottom:8 }}>✈ Your flights</div>
        <div style={{ fontSize:12, color:T.textDim, marginBottom:12, lineHeight:1.55 }}>Share your arrival details so we time your first transfer and lodge check-in perfectly.</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <Field label="Arriving into">
            <select value={own.arrivalAirport} onChange={e => setOwn(o => ({ ...o, arrivalAirport: e.target.value }))} style={inputStyle(T)}>
              <option value="JNB">Johannesburg (JNB)</option>
              <option value="CPT">Cape Town (CPT)</option>
              <option value="DUR">Durban (DUR)</option>
            </select>
          </Field>
          <Field label="Arrival date">
            <input type="date" value={own.arrivalDate} onChange={e => setOwn(o => ({ ...o, arrivalDate: e.target.value }))} style={inputStyle(T)} />
          </Field>
          <Field label="Arrival time">
            <input type="time" value={own.arrivalTime} onChange={e => setOwn(o => ({ ...o, arrivalTime: e.target.value }))} style={inputStyle(T)} />
          </Field>
          <Field label="Flight number (optional)">
            <input type="text" placeholder="e.g. BA 055" value={own.flightNo} onChange={e => setOwn(o => ({ ...o, flightNo: e.target.value }))} style={inputStyle(T)} />
          </Field>
        </div>
        {flightSaved ? (
          <div style={{ padding:'13px 18px', background:'rgba(74,222,128,0.08)', border:'0.5px solid rgba(74,222,128,0.3)', borderRadius:8, fontSize:13, color:'#4ade80', fontWeight:600, display:'flex', alignItems:'center', gap:8 }}>
            ✓ Flight details saved — your first transfer is timed to your arrival
            <button onClick={() => setFlightSaved(false)} style={{ marginLeft:'auto', background:'none', border:'none', color:'rgba(74,222,128,0.6)', cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>Edit</button>
          </div>
        ) : (
          <button onClick={() => { if (onOwnFlightDetails) { onOwnFlightDetails(own); setFlightSaved(true); } }} style={btnGold(T)}>Save flight details →</button>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // INCLUDE — the main simplified flow
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ fontSize:11, color:T.gold, textTransform:'uppercase', letterSpacing:'0.12em', fontWeight:700, marginBottom:10 }}>✈ International flights</div>

      {/* Inputs: departure city + date. Return derives from nights. */}
      <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr', gap:10, marginBottom:6 }}>
        <Field label="Departure city">
          <select value={city} onChange={e => setCity(e.target.value)} style={inputStyle(T)}>
            <option value="">Select your city…</option>
            {ORIGIN_CITIES.map(c => <option key={c.code} value={c.code}>{c.flag} {c.label}</option>)}
          </select>
        </Field>
        <Field label="Departure date">
          <div style={{ ...inputStyle(T), cursor:'default', color:'rgba(245,240,232,0.65)', display:'flex', alignItems:'center' }}>
            {depDate ? new Date(depDate).toLocaleDateString('en-GB', {day:'numeric',month:'short',year:'numeric'}) : '—'}
          </div>
        </Field>
      </div>
      <div style={{ fontSize:10, color:T.textDim, marginBottom:14 }}>
        Return {retDate ? `on ${new Date(retDate).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}` : ''} — set automatically from your {/* nights */}package length{isOpenJaw ? ` · flying home from ${departureGateway}` : ''}.
      </div>

      {/* Loading shimmer */}
      {loading && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ height:84, borderRadius:12, background:'linear-gradient(90deg,rgba(255,255,255,0.03) 25%,rgba(255,255,255,0.07) 50%,rgba(255,255,255,0.03) 75%)', backgroundSize:'200% 100%', animation:'shimmer 1.4s infinite' }} />
          ))}
          <div style={{ fontSize:12, color:T.gold, textAlign:'center', marginTop:4 }}>Finding your flights from {city}…</div>
          <style>{`@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`}</style>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ background:'rgba(248,113,113,0.07)', border:'0.5px solid rgba(248,113,113,0.25)', borderRadius:10, padding:'12px 14px', fontSize:12, color:'rgba(248,113,113,0.9)' }}>
          {error} {city && depDate && <button onClick={() => runSearch()} style={{ marginLeft:8, color:T.gold, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', textDecoration:'underline' }}>Retry</button>}
        </div>
      )}

      {/* Empty prompt before a city is chosen */}
      {!loading && !error && offers.length === 0 && (
        <div style={{ fontSize:12, color:T.textDim, padding:'8px 2px' }}>
          {city ? 'No flights found for these dates — try adjusting your departure date.' : 'Select your departure city and we’ll find your flights automatically.'}
        </div>
      )}

      {/* Three tiles — recommended first */}
      {!loading && offers.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {offers.map(offer => (
            <FlightTile key={offer.id} offer={offer} selected={selected?.id === offer.id} onSelect={() => handleSelect(offer)} fmtPrice={fmtPrice} cabin={cabin} T={T} />
          ))}

          {/* Two buttons under the tiles */}
          <div style={{ display:'flex', gap:10, marginTop:6 }}>
            <button onClick={handleUpgrade} style={{ flex:1, padding:'12px 0', borderRadius:10, border:`1.5px solid ${T.borderGold}`, background:cabin==='business' ? T.goldDim : 'transparent', color:T.gold, cursor:'pointer', fontFamily:'inherit', fontSize:13, fontWeight:600 }}>
              {cabin === 'business' ? '✓ Business class' : '✦ Upgrade to Business'}
            </button>
            <button onClick={() => onDismissFlights && onDismissFlights()} style={{ flex:1, padding:'12px 0', borderRadius:10, border:`1px solid ${T.border}`, background:'transparent', color:T.textMid, cursor:'pointer', fontFamily:'inherit', fontSize:13 }}>
              I’ll book my own flights
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Single flight tile ──
function FlightTile({ offer, selected, onSelect, fmtPrice, cabin, T }) {
  const meta = TILE_META[offer.tile_label] || TILE_META.option;
  const out = offer.slices?.[0];
  const carrier = out?.segments?.[0]?.carrier_name || out?.segments?.[0]?.operating_carrier_name || 'Airline';
  const logo = out?.segments?.[0]?.carrier_logo;
  const stops = (offer.slices || []).reduce((s, sl) => s + (sl.stops || 0), 0);
  return (
    <div onClick={onSelect} style={{ borderRadius:12, border:`1.5px solid ${selected ? meta.color : T.border}`, background:selected ? `${meta.color}10` : T.surface, cursor:'pointer', padding:'12px 14px', transition:'border-color 0.2s, background 0.2s' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.08em', color:meta.color, background:`${meta.color}1a`, border:`0.5px solid ${meta.color}55`, borderRadius:20, padding:'2px 9px' }}>{meta.label}</span>
          {selected && <span style={{ fontSize:9, fontWeight:800, color:'#0a0a0a', background:meta.color, borderRadius:20, padding:'2px 8px' }}>✓ Selected</span>}
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:17, fontWeight:700, color:selected ? meta.color : T.text, fontFamily:"'Playfair Display',serif" }}>{fmtPrice(offer.display_price)}</div>
          <div style={{ fontSize:9, color:T.textDim }}>total · {cabin === 'business' ? 'business' : 'economy'}</div>
        </div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        {logo && <img src={logo} alt={carrier} style={{ width:20, height:20, objectFit:'contain', borderRadius:4, background:'#fff', padding:1 }} />}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, color:T.textMid }}>{carrier}</div>
          <div style={{ fontSize:11, color:T.textDim }}>
            {formatTime(out?.departure_datetime)} → {formatTime(out?.arrival_datetime)} · {formatDuration(offer.total_duration_minutes)} · {stops === 0 ? 'Direct' : `${stops} stop${stops>1?'s':''}`}
          </div>
        </div>
        <div style={{ fontSize:10, color:T.textDim }}>{meta.sub}</div>
      </div>
    </div>
  );
}

// ── Small helpers ──
function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize:10, color:'rgba(245,240,232,0.4)', textTransform:'uppercase', letterSpacing:'0.06em', fontWeight:600, marginBottom:5 }}>{label}</div>
      {children}
    </div>
  );
}
function inputStyle(T) {
  return { width:'100%', background:T.bg3, border:`0.5px solid ${T.border}`, color:T.text, borderRadius:10, padding:'10px 12px', fontSize:13, outline:'none', fontFamily:'inherit', boxSizing:'border-box' };
}
function btnGold(T) {
  return { width:'100%', marginTop:14, padding:'13px 0', background:`linear-gradient(135deg,${T.gold},${T.goldLight})`, border:'none', borderRadius:10, color:'#0a0a0a', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' };
}
