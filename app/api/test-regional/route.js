// ─────────────────────────────────────────────────────────────────────────────
// GET /api/test-regional
// Probes Duffel for every regional route the transfer engine needs.
// Returns a compact report: which routes return fares, lowest price, carriers.
// Read-only. Safe. Delete after testing.
// ─────────────────────────────────────────────────────────────────────────────

const ROUTES = [
  // [origin, destination, label]
  ['CPT','SZK','Cape Town → Skukuza (Sabi Sand)'],
  ['JNB','SZK','Joburg → Skukuza'],
  ['CPT','MQP','Cape Town → Kruger Mpumalanga'],
  ['JNB','MQP','Joburg → Kruger Mpumalanga'],
  ['CPT','HDS','Cape Town → Hoedspruit'],
  ['JNB','HDS','Joburg → Hoedspruit'],
  ['CPT','MUB','Cape Town → Maun (Okavango)'],
  ['JNB','MUB','Joburg → Maun'],
  ['CPT','VFA','Cape Town → Victoria Falls'],
  ['JNB','VFA','Joburg → Victoria Falls'],
  ['CPT','LVI','Cape Town → Livingstone'],
  ['JNB','LVI','Joburg → Livingstone'],
  ['JNB','BBK','Joburg → Kasane (Chobe)'],
  ['MQP','VFA','Kruger Mpumalanga → Victoria Falls'],
  ['CPT','JNB','Cape Town → Joburg (trunk)'],
];

function parseDuration(iso) {
  if (!iso) return 0;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  return m ? (parseInt(m[1]||0)*60 + parseInt(m[2]||0)) : 0;
}

export async function GET() {
  const key = process.env.DUFFEL_API_KEY;
  if (!key) return Response.json({ error: 'DUFFEL_API_KEY not set' }, { status: 500 });

  // Date ~120 days out (matches the app default), single adult, economy.
  const d = new Date(); d.setDate(d.getDate() + 120);
  const departure_date = d.toISOString().split('T')[0];

  const results = [];
  for (const [origin, destination, label] of ROUTES) {
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
            passengers: [{ type: 'adult' }],
            cabin_class: 'economy',
          }
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        results.push({ route: label, ok: false, status: res.status, error: json?.errors?.[0]?.message || 'error' });
        continue;
      }
      const offers = json?.data?.offers || [];
      if (offers.length === 0) {
        results.push({ route: label, ok: true, offers: 0, note: 'No fares returned' });
        continue;
      }
      const sorted = [...offers].sort((a,b) => parseFloat(a.total_amount) - parseFloat(b.total_amount));
      const cheapest = sorted[0];
      const carriers = [...new Set(offers.map(o => o.owner?.name).filter(Boolean))];
      results.push({
        route: label,
        ok: true,
        offers: offers.length,
        cheapest_amount: cheapest.total_amount,
        currency: cheapest.total_currency,
        duration_min: cheapest.slices?.reduce((t,s)=>t+parseDuration(s.duration),0),
        carriers: carriers.slice(0, 6),
      });
    } catch (e) {
      results.push({ route: label, ok: false, error: String(e?.message || e) });
    }
  }

  const summary = {
    routes_with_fares: results.filter(r => r.offers > 0).length,
    routes_empty: results.filter(r => r.ok && r.offers === 0).length,
    routes_errored: results.filter(r => !r.ok).length,
    total: ROUTES.length,
  };
  return Response.json({ summary, departure_date, results }, { status: 200 });
}
