// app/api/duffel-check/route.js
// Drop this file into your Next.js project at that path.
// Then visit: https://your-vercel-url.vercel.app/api/duffel-check
// Or locally: http://localhost:3000/api/duffel-check

const TOKEN = process.env.DUFFEL_API_KEY || 'duffel_test_crpT_4NpB01HEpBW9iE6xvAu_cIGGNUoDV2Ra4Yx2zl';
const DUFFEL_BASE = 'https://api.duffel.com';
const TRAVEL_DATE = '2026-09-15';

const ROUTES = [
  { from: 'CPT', to: 'HDS',  label: 'Cape Town → Hoedspruit' },
  { from: 'CPT', to: 'MQP',  label: 'Cape Town → Kruger Mpumalanga' },
  { from: 'CPT', to: 'VFA',  label: 'Cape Town → Victoria Falls' },
  { from: 'CPT', to: 'MUB',  label: 'Cape Town → Maun (Okavango)' },
  { from: 'CPT', to: 'JNB',  label: 'Cape Town → Johannesburg (hub)' },
  { from: 'JNB', to: 'HDS',  label: 'Johannesburg → Hoedspruit' },
  { from: 'JNB', to: 'MQP',  label: 'Johannesburg → Kruger Mpumalanga' },
  { from: 'JNB', to: 'VFA',  label: 'Johannesburg → Victoria Falls' },
  { from: 'JNB', to: 'MUB',  label: 'Johannesburg → Maun' },
  { from: 'MQP', to: 'VFA',  label: 'Kruger Mpumalanga → Victoria Falls' },
  { from: 'MQP', to: 'CPT',  label: 'Kruger Mpumalanga → Cape Town' },
  { from: 'MQP', to: 'JNB',  label: 'Kruger Mpumalanga → Johannesburg' },
  { from: 'HDS', to: 'CPT',  label: 'Hoedspruit → Cape Town' },
  { from: 'HDS', to: 'JNB',  label: 'Hoedspruit → Johannesburg' },
  { from: 'VFA', to: 'CPT',  label: 'Victoria Falls → Cape Town' },
  { from: 'VFA', to: 'MQP',  label: 'Victoria Falls → Kruger Mpumalanga' },
  { from: 'VFA', to: 'JNB',  label: 'Victoria Falls → Johannesburg' },
  { from: 'MUB', to: 'CPT',  label: 'Maun → Cape Town' },
  { from: 'MUB', to: 'JNB',  label: 'Maun → Johannesburg' },
  { from: 'JNB', to: 'BBK',  label: 'Johannesburg → Kasane (Chobe)' },
];

async function checkRoute(from, to) {
  try {
    const res = await fetch(`${DUFFEL_BASE}/air/offer_requests?return_offers=true`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Duffel-Version': 'v2',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        data: {
          slices: [{ origin: from, destination: to, departure_date: TRAVEL_DATE }],
          passengers: [{ type: 'adult' }],
          cabin_class: 'economy',
        },
      }),
    });

    const json = await res.json();

    if (!res.ok) {
      const errMsg = json?.errors?.[0]?.message || json?.errors?.[0]?.code || `HTTP ${res.status}`;
      return { status: 'error', offers: 0, airlines: [], error: errMsg };
    }

    const offers = json?.data?.offers || [];
    if (offers.length === 0) {
      return { status: 'no_offers', offers: 0, airlines: [] };
    }

    const airlineMap = {};
    offers.forEach(offer => {
      offer.slices?.forEach(slice => {
        slice.segments?.forEach(seg => {
          const code = seg.marketing_carrier?.iata_code;
          const name = seg.marketing_carrier?.name;
          if (code) airlineMap[code] = name || code;
        });
      });
    });

    const lowestFare = Math.min(...offers.map(o => parseFloat(o.total_amount || 99999)));
    const currency = offers[0]?.total_currency || '';

    return {
      status: 'ok',
      offers: offers.length,
      airlines: Object.entries(airlineMap).map(([code, name]) => `${code} – ${name}`),
      lowest_fare: `${currency} ${lowestFare.toFixed(2)}`,
    };
  } catch (e) {
    return { status: 'error', offers: 0, airlines: [], error: e.message };
  }
}

export async function GET() {
  const results = [];

  for (const route of ROUTES) {
    const result = await checkRoute(route.from, route.to);
    results.push({
      route: `${route.from} → ${route.to}`,
      label: route.label,
      ...result,
    });
  }

  const summary = {
    total_routes: results.length,
    with_offers: results.filter(r => r.status === 'ok').length,
    no_offers: results.filter(r => r.status === 'no_offers').length,
    errors: results.filter(r => r.status === 'error').length,
    checked_date: TRAVEL_DATE,
  };

  // Return clean HTML for easy reading in browser
  const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Duffel Route Coverage — BCC</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; }
    h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
    .meta { font-size: 13px; color: #666; margin-bottom: 24px; }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
    .stat { background: #f5f5f5; border-radius: 8px; padding: 14px 16px; }
    .stat-num { font-size: 28px; font-weight: 600; }
    .stat-label { font-size: 12px; color: #666; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { text-align: left; padding: 8px 12px; background: #f0f0f0; font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #555; }
    td { padding: 9px 12px; border-bottom: 1px solid #eee; vertical-align: top; }
    tr:hover td { background: #fafafa; }
    .ok { color: #1a6b3a; background: #e8f5ee; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; }
    .gap { color: #8b1a1a; background: #fce8e8; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; }
    .err { color: #7a4f00; background: #fff3cd; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; }
    .airlines { font-size: 11px; color: #555; margin-top: 3px; }
    .fare { font-size: 11px; color: #1a6b3a; margin-top: 2px; font-weight: 500; }
    .error-msg { font-size: 11px; color: #8b1a1a; margin-top: 2px; }
  </style>
</head>
<body>
  <h1>Duffel sandbox — BCC route coverage</h1>
  <div class="meta">Travel date: ${TRAVEL_DATE} · Checked: ${new Date().toISOString().slice(0,19).replace('T',' ')} UTC</div>
  <div class="stats">
    <div class="stat"><div class="stat-num">${summary.total_routes}</div><div class="stat-label">routes checked</div></div>
    <div class="stat"><div class="stat-num" style="color:#1a6b3a">${summary.with_offers}</div><div class="stat-label">routes with offers</div></div>
    <div class="stat"><div class="stat-num" style="color:#8b1a1a">${summary.no_offers}</div><div class="stat-label">no offers (gap)</div></div>
    <div class="stat"><div class="stat-num" style="color:#7a4f00">${summary.errors}</div><div class="stat-label">errors</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:22%">Route</th>
        <th style="width:30%">Description</th>
        <th style="width:12%">Status</th>
        <th style="width:8%">Offers</th>
        <th style="width:28%">Airlines / Notes</th>
      </tr>
    </thead>
    <tbody>
      ${results.map(r => `
        <tr>
          <td><strong>${r.route}</strong></td>
          <td style="color:#555">${r.label}</td>
          <td>
            ${r.status === 'ok' ? '<span class="ok">✓ has offers</span>' : ''}
            ${r.status === 'no_offers' ? '<span class="gap">✗ no offers</span>' : ''}
            ${r.status === 'error' ? '<span class="err">⚠ error</span>' : ''}
          </td>
          <td style="text-align:center">${r.offers > 0 ? r.offers : '—'}</td>
          <td>
            ${r.airlines?.length ? `<div class="airlines">${r.airlines.join('<br>')}</div>` : ''}
            ${r.lowest_fare ? `<div class="fare">From ${r.lowest_fare}</div>` : ''}
            ${r.error ? `<div class="error-msg">${r.error}</div>` : ''}
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>
  <p style="margin-top:24px;font-size:12px;color:#999">
    Charter-only routes (Mack Air VFA↔BBK, FedAir lodge strips, Wilderness Air Delta camps) are not checked — they are not on Duffel by design and need manual Supabase rates.
  </p>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
