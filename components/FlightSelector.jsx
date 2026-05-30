'use client';

import { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// FlightSelector — International leg selection for The Safari Edition
// Traveller-facing. Shows top offers from Duffel with margin baked in.
// Part of Module 2: Experience Designer booking flow
// ─────────────────────────────────────────────────────────────────────────────

// Common international gateways into Southern Africa
const GATEWAY_AIRPORTS = [
  { iata: 'JNB', city: 'Johannesburg', name: 'O.R. Tambo International', country: 'ZA' },
  { iata: 'CPT', city: 'Cape Town', name: 'Cape Town International', country: 'ZA' },
];

const SOURCE_AIRPORTS = [
  { iata: 'LHR', city: 'London', name: 'Heathrow', country: 'GB' },
  { iata: 'LGW', city: 'London', name: 'Gatwick', country: 'GB' },
  { iata: 'MAN', city: 'Manchester', name: 'Manchester Airport', country: 'GB' },
  { iata: 'JFK', city: 'New York', name: 'John F. Kennedy', country: 'US' },
  { iata: 'EWR', city: 'New York', name: 'Newark Liberty', country: 'US' },
  { iata: 'LAX', city: 'Los Angeles', name: 'Los Angeles Intl', country: 'US' },
  { iata: 'ORD', city: 'Chicago', name: "O'Hare International", country: 'US' },
  { iata: 'ATL', city: 'Atlanta', name: 'Hartsfield-Jackson', country: 'US' },
  { iata: 'FRA', city: 'Frankfurt', name: 'Frankfurt Airport', country: 'DE' },
  { iata: 'AMS', city: 'Amsterdam', name: 'Schiphol', country: 'NL' },
  { iata: 'DXB', city: 'Dubai', name: 'Dubai International', country: 'AE' },
];

const CABIN_OPTIONS = [
  { value: 'economy', label: 'Economy' },
  { value: 'premium_economy', label: 'Premium Economy' },
  { value: 'business', label: 'Business' },
  { value: 'first', label: 'First Class' },
];

function formatDuration(minutes) {
  if (!minutes) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function formatDateTime(datetime) {
  if (!datetime) return '—';
  const d = new Date(datetime);
  return {
    time: d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
    date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  };
}

function formatPrice(amount, currency) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function StopsLabel({ stops }) {
  if (stops === 0) return <span style={{ color: 'var(--accent)' }}>Direct</span>;
  if (stops === 1) return <span style={{ color: '#c9a96e' }}>1 stop</span>;
  return <span style={{ color: '#999' }}>{stops} stops</span>;
}

function FlightCard({ offer, isSelected, onSelect, passengerCount }) {
  const outbound = offer.slices?.[0];
  const inbound = offer.slices?.[1];
  const dep = formatDateTime(outbound?.departure_datetime);
  const arr = formatDateTime(outbound?.arrival_datetime);
  const carrier = outbound?.segments?.[0];

  return (
    <div
      onClick={() => onSelect(offer)}
      style={{
        background: isSelected
          ? 'linear-gradient(135deg, rgba(201,169,110,0.12) 0%, rgba(201,169,110,0.04) 100%)'
          : 'rgba(255,255,255,0.03)',
        border: isSelected ? '1px solid rgba(201,169,110,0.6)' : '1px solid rgba(255,255,255,0.08)',
        borderRadius: '2px',
        padding: '20px 24px',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        position: 'relative',
        marginBottom: '8px',
      }}
    >
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '16px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'var(--accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="11" height="8" viewBox="0 0 11 8" fill="none">
            <path d="M1 4L4 7L10 1" stroke="#1a1a18" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}

      {/* Outbound slice */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: inbound ? '16px' : '0' }}>
        
        {/* Carrier */}
        <div style={{ width: '140px', flexShrink: 0 }}>
          {carrier?.carrier_logo ? (
            <img src={carrier.carrier_logo} alt={carrier.carrier_name} style={{ height: '20px', filter: 'brightness(0) invert(1) opacity(0.7)' }} />
          ) : (
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-body)', letterSpacing: '0.05em' }}>
              {carrier?.carrier_name || '—'}
            </span>
          )}
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '3px', fontFamily: 'var(--font-body)' }}>
            {carrier?.flight_number}
          </div>
        </div>

        {/* Departure */}
        <div style={{ textAlign: 'center', minWidth: '64px' }}>
          <div style={{ fontSize: '22px', fontFamily: 'var(--font-display)', color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>
            {dep.time}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '3px', fontFamily: 'var(--font-body)' }}>
            {outbound?.origin?.iata}
          </div>
        </div>

        {/* Route line */}
        <div style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-body)' }}>
            {formatDuration(outbound?.duration_minutes)}
          </div>
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.15)' }} />
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255,255,255,0.3)' }} />
            <div style={{ height: '1px', flex: 1, background: 'rgba(255,255,255,0.15)' }} />
          </div>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-body)' }}>
            <StopsLabel stops={outbound?.stops || 0} />
          </div>
        </div>

        {/* Arrival */}
        <div style={{ textAlign: 'center', minWidth: '64px' }}>
          <div style={{ fontSize: '22px', fontFamily: 'var(--font-display)', color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>
            {arr.time}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '3px', fontFamily: 'var(--font-body)' }}>
            {outbound?.destination?.iata}
          </div>
        </div>

        {/* Price */}
        <div style={{ marginLeft: 'auto', paddingLeft: '24px', textAlign: 'right', minWidth: '100px' }}>
          <div style={{ fontSize: '20px', fontFamily: 'var(--font-display)', color: 'var(--accent)', letterSpacing: '-0.02em', lineHeight: 1 }}>
            {formatPrice(offer.display_price, offer.currency)}
          </div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '3px', fontFamily: 'var(--font-body)' }}>
            per person
          </div>
        </div>
      </div>

      {/* Return slice if exists */}
      {inbound && (
        <>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 0 16px' }} />
          <ReturnSlice slice={inbound} />
        </>
      )}

      {/* Baggage & conditions */}
      <div style={{ marginTop: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {offer.baggage?.length > 0 && (
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-body)' }}>
            ✓ {offer.baggage[0].quantity}× {offer.baggage[0].type?.replace('_', ' ')} included
          </span>
        )}
        {offer.conditions?.refundable && (
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-body)' }}>
            ✓ Refundable
          </span>
        )}
        {offer.conditions?.changeable && (
          <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-body)' }}>
            ✓ Changeable
          </span>
        )}
        {offer.expires_at && (
          <span style={{ fontSize: '11px', color: 'rgba(201,169,110,0.5)', fontFamily: 'var(--font-body)', marginLeft: 'auto' }}>
            Price held until {formatDateTime(offer.expires_at).time}
          </span>
        )}
      </div>
    </div>
  );
}

function ReturnSlice({ slice }) {
  const dep = formatDateTime(slice.departure_datetime);
  const arr = formatDateTime(slice.arrival_datetime);
  const carrier = slice.segments?.[0];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
      <div style={{ width: '140px', flexShrink: 0 }}>
        <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-body)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Return
        </span>
      </div>
      <div style={{ textAlign: 'center', minWidth: '64px' }}>
        <div style={{ fontSize: '18px', fontFamily: 'var(--font-display)', color: 'rgba(255,255,255,0.7)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {dep.time}
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '3px', fontFamily: 'var(--font-body)' }}>
          {slice?.origin?.iata}
        </div>
      </div>
      <div style={{ flex: 1, padding: '0 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-body)' }}>
          {formatDuration(slice?.duration_minutes)}
        </div>
        <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)' }} />
        <div style={{ fontSize: '11px', fontFamily: 'var(--font-body)' }}>
          <StopsLabel stops={slice?.stops || 0} />
        </div>
      </div>
      <div style={{ textAlign: 'center', minWidth: '64px' }}>
        <div style={{ fontSize: '18px', fontFamily: 'var(--font-display)', color: 'rgba(255,255,255,0.7)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {arr.time}
        </div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '3px', fontFamily: 'var(--font-body)' }}>
          {slice?.destination?.iata}
        </div>
      </div>
      <div style={{ marginLeft: 'auto', paddingLeft: '24px', minWidth: '100px' }} />
    </div>
  );
}

export default function FlightSelector({ onFlightSelected, onSkip, travelDates }) {
  const [step, setStep] = useState('question'); // question | search | results
  const [hasBookedAlready, setHasBookedAlready] = useState(null);
  
  // Search form state
  const [origin, setOrigin] = useState('LHR');
  const [destination, setDestination] = useState('JNB');
  const [departureDate, setDepartureDate] = useState(travelDates?.start || '');
  const [returnDate, setReturnDate] = useState(travelDates?.end || '');
  const [passengers, setPassengers] = useState(2);
  const [cabinClass, setCabinClass] = useState('economy');
  const [isReturn, setIsReturn] = useState(true);

  // Results state
  const [offers, setOffers] = useState([]);
  const [selectedOffer, setSelectedOffer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchMeta, setSearchMeta] = useState(null);

  // If traveller has already booked / booking independently
  const [existingFlightDates, setExistingFlightDates] = useState({
    arrival_date: travelDates?.start || '',
    arrival_time: '',
    arrival_airport: 'JNB',
    departure_date: travelDates?.end || '',
    departure_time: '',
    departure_airport: 'JNB',
  });

  const handleSearch = async () => {
    setLoading(true);
    setError(null);
    setOffers([]);
    setStep('results');

    try {
      const res = await fetch('/api/flights/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin,
          destination,
          departure_date: departureDate,
          return_date: isReturn ? returnDate : undefined,
          passengers,
          cabin_class: cabinClass,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to load flights');
        return;
      }

      setOffers(data.offers || []);
      setSearchMeta(data);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmFlight = () => {
    if (selectedOffer && onFlightSelected) {
      onFlightSelected({
        type: 'duffel',
        offer: selectedOffer,
        passengers,
      });
    }
  };

  const handleSkipWithDates = () => {
    if (onSkip) {
      onSkip({
        type: hasBookedAlready === 'yes' ? 'already_booked' : 'booking_independently',
        dates: existingFlightDates,
      });
    }
  };

  // ── CSS variables — these extend your global theme ──
  const cssVars = {
    '--accent': '#C9A96E',
    '--font-display': "'Cormorant Garamond', 'Garamond', Georgia, serif",
    '--font-body': "'Gill Sans', 'Gill Sans MT', 'Trebuchet MS', sans-serif",
  };

  const labelStyle = {
    fontSize: '10px',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'var(--font-body)',
    marginBottom: '8px',
    display: 'block',
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '2px',
    color: '#fff',
    fontFamily: 'var(--font-body)',
    fontSize: '14px',
    padding: '10px 14px',
    width: '100%',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='rgba(255,255,255,0.4)' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    paddingRight: '36px',
  };

  return (
    <div style={{ ...cssVars, maxWidth: '720px', margin: '0 auto' }}>

      {/* ── STEP 1: The question ── */}
      {step === 'question' && (
        <div>
          <div style={{ marginBottom: '32px' }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: '28px',
              fontWeight: 400,
              color: '#fff',
              letterSpacing: '-0.01em',
              lineHeight: 1.2,
              marginBottom: '8px',
            }}>
              International flights
            </h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
              Would you like us to include your international flights, or have you already arranged these?
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              {
                key: 'book',
                icon: '✦',
                title: 'Find flights for me',
                sub: 'We\'ll search and include your international flights in the package',
              },
              {
                key: 'yes',
                icon: '○',
                title: 'I\'ve already booked',
                sub: 'Tell us your arrival details so we can plan around your schedule',
              },
              {
                key: 'no',
                icon: '○',
                title: 'I\'ll arrange my own',
                sub: 'Just give us your intended travel dates and we\'ll build around them',
              },
            ].map(opt => (
              <div
                key={opt.key}
                onClick={() => {
                  if (opt.key === 'book') {
                    setStep('search');
                  } else {
                    setHasBookedAlready(opt.key);
                  }
                }}
                style={{
                  background: hasBookedAlready === opt.key
                    ? 'rgba(201,169,110,0.08)'
                    : 'rgba(255,255,255,0.03)',
                  border: hasBookedAlready === opt.key
                    ? '1px solid rgba(201,169,110,0.5)'
                    : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '2px',
                  padding: '18px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  transition: 'all 0.15s ease',
                }}
              >
                <span style={{ color: 'var(--accent)', fontSize: '16px', width: '20px', flexShrink: 0 }}>{opt.icon}</span>
                <div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: '#fff', marginBottom: '2px' }}>
                    {opt.title}
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                    {opt.sub}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Already booked / own arrangement — collect dates */}
          {(hasBookedAlready === 'yes' || hasBookedAlready === 'no') && (
            <div style={{
              marginTop: '24px',
              padding: '24px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '2px',
            }}>
              {hasBookedAlready === 'yes' && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'rgba(201,169,110,0.8)', marginBottom: '20px', lineHeight: 1.6 }}>
                  No problem. Share your arrival details and we\'ll build your entire safari around your flight schedule.
                </p>
              )}
              {hasBookedAlready === 'no' && (
                <p style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginBottom: '20px', lineHeight: 1.6 }}>
                  Understood. Please note your international flights are not included in your package price. Your Journey Specialist can recommend carriers and routes if helpful.
                </p>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={labelStyle}>Arrival airport</label>
                  <select
                    value={existingFlightDates.arrival_airport}
                    onChange={e => setExistingFlightDates(p => ({ ...p, arrival_airport: e.target.value }))}
                    style={selectStyle}
                  >
                    {GATEWAY_AIRPORTS.map(a => (
                      <option key={a.iata} value={a.iata}>{a.iata} — {a.city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Arrival date</label>
                  <input
                    type="date"
                    value={existingFlightDates.arrival_date}
                    onChange={e => setExistingFlightDates(p => ({ ...p, arrival_date: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Arrival time (approx)</label>
                  <input
                    type="time"
                    value={existingFlightDates.arrival_time}
                    onChange={e => setExistingFlightDates(p => ({ ...p, arrival_time: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Departure airport</label>
                  <select
                    value={existingFlightDates.departure_airport}
                    onChange={e => setExistingFlightDates(p => ({ ...p, departure_airport: e.target.value }))}
                    style={selectStyle}
                  >
                    {GATEWAY_AIRPORTS.map(a => (
                      <option key={a.iata} value={a.iata}>{a.iata} — {a.city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Departure date</label>
                  <input
                    type="date"
                    value={existingFlightDates.departure_date}
                    onChange={e => setExistingFlightDates(p => ({ ...p, departure_date: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Departure time (approx)</label>
                  <input
                    type="time"
                    value={existingFlightDates.departure_time}
                    onChange={e => setExistingFlightDates(p => ({ ...p, departure_time: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              </div>

              <button
                onClick={handleSkipWithDates}
                disabled={!existingFlightDates.arrival_date || !existingFlightDates.departure_date}
                style={{
                  marginTop: '20px',
                  background: 'var(--accent)',
                  color: '#1a1a18',
                  border: 'none',
                  borderRadius: '2px',
                  padding: '12px 28px',
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  opacity: (!existingFlightDates.arrival_date || !existingFlightDates.departure_date) ? 0.4 : 1,
                }}
              >
                Continue with these dates →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Search form ── */}
      {step === 'search' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
            <button
              onClick={() => setStep('question')}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '13px', padding: 0 }}
            >
              ← Back
            </button>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '24px', fontWeight: 400, color: '#fff', letterSpacing: '-0.01em', margin: 0 }}>
              Search international flights
            </h2>
          </div>

          {/* Trip type toggle */}
          <div style={{ display: 'flex', gap: '0', marginBottom: '24px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', width: 'fit-content' }}>
            {[
              { val: true, label: 'Return' },
              { val: false, label: 'One way' },
            ].map(opt => (
              <button
                key={String(opt.val)}
                onClick={() => setIsReturn(opt.val)}
                style={{
                  padding: '8px 20px',
                  background: isReturn === opt.val ? 'rgba(201,169,110,0.15)' : 'transparent',
                  border: 'none',
                  color: isReturn === opt.val ? 'var(--accent)' : 'rgba(255,255,255,0.4)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '12px',
                  letterSpacing: '0.08em',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={labelStyle}>Flying from</label>
              <select value={origin} onChange={e => setOrigin(e.target.value)} style={selectStyle}>
                {SOURCE_AIRPORTS.map(a => (
                  <option key={a.iata} value={a.iata}>{a.iata} — {a.city} ({a.name})</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Flying into</label>
              <select value={destination} onChange={e => setDestination(e.target.value)} style={selectStyle}>
                {GATEWAY_AIRPORTS.map(a => (
                  <option key={a.iata} value={a.iata}>{a.iata} — {a.city}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Departure date</label>
              <input type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} style={inputStyle} />
            </div>
            {isReturn && (
              <div>
                <label style={labelStyle}>Return date</label>
                <input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} style={inputStyle} />
              </div>
            )}
            <div>
              <label style={labelStyle}>Passengers</label>
              <select value={passengers} onChange={e => setPassengers(parseInt(e.target.value))} style={selectStyle}>
                {[1,2,3,4,5,6].map(n => (
                  <option key={n} value={n}>{n} {n === 1 ? 'adult' : 'adults'}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Cabin class</label>
              <select value={cabinClass} onChange={e => setCabinClass(e.target.value)} style={selectStyle}>
                {CABIN_OPTIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleSearch}
            disabled={!departureDate || (isReturn && !returnDate)}
            style={{
              background: 'var(--accent)',
              color: '#1a1a18',
              border: 'none',
              borderRadius: '2px',
              padding: '14px 32px',
              fontFamily: 'var(--font-body)',
              fontSize: '12px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              fontWeight: 600,
              opacity: (!departureDate || (isReturn && !returnDate)) ? 0.4 : 1,
            }}
          >
            Search flights
          </button>
        </div>
      )}

      {/* ── STEP 3: Results ── */}
      {step === 'results' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <button
              onClick={() => { setStep('search'); setOffers([]); setSelectedOffer(null); }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '13px', padding: 0 }}
            >
              ← Modify search
            </button>
            {searchMeta && (
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
                {searchMeta.search?.origin} → {searchMeta.search?.destination}
                {searchMeta.is_return ? ` · Return` : ' · One way'}
                {` · ${searchMeta.search?.passengers} ${searchMeta.search?.passengers === 1 ? 'adult' : 'adults'}`}
              </span>
            )}
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div style={{
                width: '32px', height: '32px', border: '1px solid rgba(201,169,110,0.3)',
                borderTop: '1px solid var(--accent)', borderRadius: '50%',
                animation: 'spin 1s linear infinite', margin: '0 auto 16px',
              }} />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
                Searching flights across all carriers…
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}

          {error && (
            <div style={{ padding: '20px', background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.2)', borderRadius: '2px' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '13px', color: 'rgba(255,120,120,0.9)', margin: 0 }}>
                {error}
              </p>
            </div>
          )}

          {!loading && !error && offers.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>
                No flights found for these dates. Try adjusting your search.
              </p>
              <button
                onClick={() => setStep('search')}
                style={{ marginTop: '16px', background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', borderRadius: '2px', padding: '10px 20px', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '12px' }}
              >
                Modify search
              </button>
            </div>
          )}

          {!loading && offers.length > 0 && (
            <>
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>
                  {offers.length} option{offers.length !== 1 ? 's' : ''} · sorted by price
                </span>
                {searchMeta?.total_offers_available > offers.length && (
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'rgba(255,255,255,0.2)' }}>
                    Showing best {offers.length} of {searchMeta.total_offers_available}
                  </span>
                )}
              </div>

              <div>
                {offers.map(offer => (
                  <FlightCard
                    key={offer.id}
                    offer={offer}
                    isSelected={selectedOffer?.id === offer.id}
                    onSelect={setSelectedOffer}
                    passengerCount={passengers}
                  />
                ))}
              </div>

              {selectedOffer && (
                <div style={{
                  marginTop: '24px',
                  padding: '20px 24px',
                  background: 'rgba(201,169,110,0.06)',
                  border: '1px solid rgba(201,169,110,0.3)',
                  borderRadius: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
                      Selected flight · {passengers} {passengers === 1 ? 'passenger' : 'passengers'}
                    </div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: 'var(--accent)', letterSpacing: '-0.01em' }}>
                      {formatPrice(selectedOffer.display_price * passengers, selectedOffer.currency)} total
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>
                      Paid in full at booking · Non-refundable
                    </div>
                  </div>
                  <button
                    onClick={handleConfirmFlight}
                    style={{
                      background: 'var(--accent)',
                      color: '#1a1a18',
                      border: 'none',
                      borderRadius: '2px',
                      padding: '14px 28px',
                      fontFamily: 'var(--font-body)',
                      fontSize: '12px',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Add to itinerary →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
