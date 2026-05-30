// ─────────────────────────────────────────────────────────────────────────────
// POST /api/transfers/search
// Prices the COMMERCIAL hub-to-hub leg of regional transfers via Duffel.
// Body: { routes: [{origin,destination}], departure_date, passengers }
//   (legacy: { origin, targets:[...], departure_date, passengers } also accepted)
// Returns: { fares: { "MUB-JNB": <USD per-person>, ... }, meta: {...}, currency:'USD' }
// The caller converts USD->ZAR and adds the exit + arrival last-miles (three-part chain).
// Cheapest fare per route. Missing routes omitted -> caller falls back to estimate.
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

  const { origin, targets, routes, departure_date, passengers } = body || {};
  if (!departure_date) {
    return Response.json({ error: 'Missing departure_date' }, { status: 400 });
  }

  const pax = Math.max(parseInt(passengers) || 1, 1);
  const passengersArray = Array.from({ length: pax }, () => ({ type: 'adult' }));

  // Accept explicit route pairs (preferred) or legacy single-origin fan-out.
  let routePairs = [];
  if (Array.isArray(routes) && routes.length) {
    routePairs = routes.filter(r => r && r.origin && r.destination && r.origin !== r.destination);
  } else if (origin && Array.isArray(targets)) {
    routePairs = [...new Set(targets)].filter(t => t && t !== origin).map(t => ({ origin, destination: t }));
  }
  if (routePairs.length === 0) {
    return Response.json({ error: 'No valid routes' }, { status: 400 });
  }
  // De-dupe by route key.
  const seen = new Set();
  routePairs = routePairs.filter(r => {
    const k = `${r.origin}-${r.destination}`;
    if (seen.has(k)) return false; seen.add(k); return true;
  });

  const fares = {};
  const meta = {};

  await Promise.all(routePairs.map(async ({ origin: rOrigin, destination }) => {
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
            slices: [{ origin: rOrigin, destination, departure_date }],
            passengers: passengersArray,
            cabin_class: 'economy',
          }
        }),
      });
      if (!res.ok) return;
      const json = await res.json();
      const offers = json?.data?.offers || [];
      if (offers.length === 0) return;

      const sorted = [...offers].sort((a,b) => parseFloat(a.total_amount) - parseFloat(b.total_amount));
      const cheapest = sorted[0];
      const perPax = parseFloat(cheapest.total_amount) / pax;

      const seg0 = cheapest.slices?.[0]?.segments?.[0];
      const segs = cheapest.slices?.[0]?.segments || [];
      const segLast = segs[segs.length - 1];
      const stops = (segs.length || 1) - 1;

      const routeKey = `${rOrigin}-${destination}`;
      fares[routeKey] = Number(perPax.toFixed(2));
      meta[routeKey] = {
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
    departure_date,
    passengers: pax,
    currency: 'USD',
    fares,   // { "MUB-JNB": 58.73, ... } per person USD
    meta,    // { "MUB-JNB": { carrier, departing_at, ... } }
  }, { status: 200 });
}
