// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transfers/search
// Batch-prices the COMMERCIAL leg of regional transfers via Duffel.
// Body: { origin: 'CPT'|'JNB'|..., targets: ['SZK','MUB',...], departure_date, passengers }
// Returns: { fares: { SZK: <USD per-person cheapest>, MUB: ... }, currency:'USD' }
// The caller converts USD->ZAR and adds the last-mile. This route returns ONLY the
// commercial airport-to-airport fare (cheapest per route). Missing routes are omitted
// so the caller falls back to its estimate.
// ─────────────────────────────────────────────────────────────────────────────

function parseDuration(iso) {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  return m ? (parseInt(m[1]||0)*60 + parseInt(m[2]||0)) : 0;
}

export async function POST(request) {
  const key = process.env.DUFFEL_API_KEY;
  if (!key) return Response.json({ error: 'DUFFEL_API_KEY not set' }, { status: 500 });

  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { origin, targets, departure_date, passengers } = body || {};
  if (!origin || !Array.isArray(targets) || targets.length === 0 || !departure_date) {
    return Response.json({ error: 'Missing origin, targets[], or departure_date' }, { status: 400 });
  }

  const pax = Math.max(parseInt(passengers) || 1, 1);
  const passengersArray = Array.from({ length: pax }, () => ({ type: 'adult' }));

  // De-dupe targets; never search origin->origin.
  const uniqueTargets = [...new Set(targets)].filter(t => t && t !== origin);

  const fares = {};
  const meta = {};

  // Query each route. (Per-itinerary call, so this runs once and is cached client-side.)
  await Promise.all(uniqueTargets.map(async (destination) => {
    try {
      const res = await fetch('https://api.duffel.com/air/offer_requests?return_offers=true', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Duffel-Version': 'v2',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          data: {
            slices: [{ origin, destination, departure_date }],
            passengers: passengersArray,
            cabin_class: 'economy',
          }
        }),
      });
      if (!res.ok) return;
      const json = await res.json();
      const offers = json?.data?.offers || [];
      if (offers.length === 0) return;

      // Cheapest fare per route (total_amount is for ALL passengers in this request).
      const sorted = [...offers].sort((a,b) => parseFloat(a.total_amount) - parseFloat(b.total_amount));
      const cheapest = sorted[0];
      const totalAmount = parseFloat(cheapest.total_amount);            // all pax
      const perPax = totalAmount / pax;                                  // per person

      fares[destination] = Number(perPax.toFixed(2));
      const seg0 = cheapest.slices?.[0]?.segments?.[0];
      const segLast = cheapest.slices?.[0]?.segments?.[cheapest.slices[0].segments.length - 1];
      const stops = (cheapest.slices?.[0]?.segments?.length || 1) - 1;
      meta[destination] = {
        currency: cheapest.total_currency,
        carrier: cheapest.owner?.name,
        duration_min: cheapest.slices?.reduce((t,s)=>t+parseDuration(s.duration),0),
        departing_at: seg0?.departing_at || null,
        arriving_at: segLast?.arriving_at || null,
        stops,
        offers: offers.length,
      };
    } catch {
      // omit — caller falls back to estimate
    }
  }));

  return Response.json({
    origin,
    departure_date,
    passengers: pax,
    currency: 'USD',          // Duffel default; caller converts to ZAR
    fares,                    // { SZK: 86.32, MUB: 88.81, ... } per person USD
    meta,
  }, { status: 200 });
}
