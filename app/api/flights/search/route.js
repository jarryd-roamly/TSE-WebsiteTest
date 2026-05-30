// app/api/flights/search/route.js
// International flight search via Duffel API
// Supports: return, one-way, open jaw
// Margin applied server-side — raw Duffel price never reaches client
// client_key passed through for DuffelAncillaries component

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      origin,
      arrival_gateway,
      departure_gateway,
      departure_date,
      return_date,
      passengers,
      cabin_class,
      is_open_jaw,
    } = body;

    if (!origin || !arrival_gateway || !departure_date || !passengers) {
      return Response.json(
        { error: 'Missing required fields: origin, arrival_gateway, departure_date, passengers' },
        { status: 400 }
      );
    }

    const FLIGHT_MARGIN = 0.08;
    // ─── PACKAGE MARGIN OPTIMISER HOOK (dormant — hybrid mode) ───────────────
    // Today: flat FLIGHT_MARGIN (8%) on every flight.
    // Later: flight margin flexes to bring the BLENDED PACKAGE margin to TARGET,
    //        never letting any pillar drop below FLOOR. The frontend already passes
    //        package context, so switching this on is a one-function change.
    const PKG_TARGET_MARGIN = 0.21; // aim ABOVE the floor (spec blended GM 18–24%)
    const PKG_FLOOR_MARGIN  = 0.18; // hard floor — contribution-margin KPI
    function computeFlightMargin(/* packageMarginSoFar, packageNetSoFar */) {
      // HYBRID: return flat margin for now. When the optimiser goes live, compute
      // the flight markup that lifts blended package margin toward PKG_TARGET_MARGIN
      // without breaching PKG_FLOOR_MARGIN on any pillar.
      return FLIGHT_MARGIN;
    }
    const effectiveDepartureGateway = departure_gateway || arrival_gateway;
    const isOpenJaw = is_open_jaw && (departure_gateway !== arrival_gateway);
    const isReturn  = !!return_date;

    const slices = [{ origin, destination: arrival_gateway, departure_date }];
    if (isReturn && return_date) {
      slices.push({ origin: effectiveDepartureGateway, destination: origin, departure_date: return_date });
    }

    const passengersArray = Array.from({ length: passengers }, () => ({ type: 'adult' }));

    const offerRequestResponse = await fetch(
      'https://api.duffel.com/air/offer_requests?return_offers=true',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.DUFFEL_API_KEY}`,
          'Duffel-Version': 'v2',
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          data: { slices, passengers: passengersArray, cabin_class: cabin_class || 'economy' }
        }),
      }
    );

    if (!offerRequestResponse.ok) {
      const errorData = await offerRequestResponse.json();
      return Response.json({ error: 'Failed to fetch flight offers', details: errorData }, { status: offerRequestResponse.status });
    }

    const offerRequestData = await offerRequestResponse.json();
    const offers           = offerRequestData.data?.offers || [];
    const client_key       = offerRequestData.data?.client_key || null;

    const processedOffers = offers
      .slice(0, 30)
      .map(offer => {
        const basePrice       = parseFloat(offer.total_amount);
        const currency        = offer.total_currency;
        const priceWithMargin = basePrice * (1 + computeFlightMargin());
        return {
          id:           offer.id,
          expires_at:   offer.expires_at,
          currency,
          display_price: Math.ceil(priceWithMargin),
          total_duration_minutes: offer.slices?.reduce((t, s) => t + parseDuration(s.duration), 0),
          is_return: isReturn,
          is_open_jaw: isOpenJaw,
          slices: offer.slices?.map(slice => ({
            id: slice.id,
            origin: { iata: slice.origin?.iata_code, name: slice.origin?.name, city: slice.origin?.city?.name, terminal: slice.origin?.terminal },
            destination: { iata: slice.destination?.iata_code, name: slice.destination?.name, city: slice.destination?.city?.name, terminal: slice.destination?.terminal },
            departure_datetime: slice.segments?.[0]?.departing_at,
            arrival_datetime:   slice.segments?.[slice.segments.length - 1]?.arriving_at,
            duration:           slice.duration,
            duration_minutes:   parseDuration(slice.duration),
            stops:              (slice.segments?.length || 1) - 1,
            segments: slice.segments?.map(seg => ({
              id: seg.id,
              flight_number: `${seg.marketing_carrier?.iata_code}${seg.marketing_carrier_flight_number}`,
              carrier_name:  seg.marketing_carrier?.name,
              carrier_iata:  seg.marketing_carrier?.iata_code,
              carrier_logo:  seg.marketing_carrier?.logo_symbol_url,
              operating_carrier_name: seg.operating_carrier?.name,
              aircraft:      seg.aircraft?.name,
              departing_at:  seg.departing_at,
              arriving_at:   seg.arriving_at,
              origin_iata:   seg.origin?.iata_code,
              destination_iata: seg.destination?.iata_code,
              duration:      seg.duration,
            })),
          })),
          passengers: offer.passengers?.map(p => ({ id: p.id, type: p.type })),
          baggage:    offer.slices?.[0]?.segments?.[0]?.passengers?.[0]?.baggages || [],
          conditions: {
            refundable:      offer.conditions?.refund_before_departure?.allowed ?? null,
            changeable:      offer.conditions?.change_before_departure?.allowed ?? null,
            fare_conditions: offer.conditions?.refund_before_departure?.penalty_currency
              ? `Refund penalty: ${offer.conditions.refund_before_departure.penalty_amount} ${offer.conditions.refund_before_departure.penalty_currency}`
              : null,
          },
          payment_requirements: {
            requires_instant_payment:   offer.payment_requirements?.requires_instant_payment ?? false,
            price_guarantee_expires_at: offer.payment_requirements?.price_guarantee_expires_at ?? null,
          },
        };
      })
      ; // (processedOffers is the full mapped list)

    // ─── PICK THREE DISTINCT, LABELLED OFFERS ────────────────────────────────
    // Cheapest = lowest display_price. Quickest = shortest total duration.
    // Recommended = best price+routing blend within 15% of cheapest (and the
    // optimiser hook will later bias this within the band). All three deduped so
    // the traveller never sees the same flight twice.
    const stopsOf = (o) => (o.slices || []).reduce((s, sl) => s + (sl.stops || 0), 0);
    const byPrice = [...processedOffers].sort((a, b) => a.display_price - b.display_price);
    const byTime  = [...processedOffers].sort((a, b) => (a.total_duration_minutes||0) - (b.total_duration_minutes||0));

    const cheapest = byPrice[0] || null;
    const quickest = byTime[0]  || null;

    // Recommended: within 15% of cheapest price AND no worse than cheapest+1 stop,
    // then best blended score. Falls back to cheapest if nothing qualifies.
    let recommended = null;
    if (cheapest) {
      const priceCap = cheapest.display_price * 1.15;
      const stopCap  = stopsOf(cheapest) + 1;
      const eligible = processedOffers
        .filter(o => o.display_price <= priceCap && stopsOf(o) <= stopCap)
        .map(o => ({ o, score: o.display_price * (1 + stopsOf(o) * 0.08) + (o.total_duration_minutes||0)/60 * 2 }))
        .sort((a, b) => a.score - b.score);
      recommended = eligible.length ? eligible[0].o : cheapest;
    }

    // Build the labelled, deduped tile set in display order: recommended, quickest, cheapest.
    const seen = new Set();
    const labelled = [];
    const pushUnique = (offer, label) => {
      if (!offer || seen.has(offer.id)) return;
      seen.add(offer.id);
      labelled.push({ ...offer, tile_label: label });
    };
    pushUnique(recommended, 'recommended');
    pushUnique(quickest,    'quickest');
    pushUnique(cheapest,    'cheapest');
    // If dedupe collapsed the list (e.g. recommended === cheapest === quickest),
    // backfill with next-best distinct offers so we always try to show up to 3.
    for (const o of byPrice) { if (labelled.length >= 3) break; pushUnique(o, 'option'); }

    const tiles = labelled.slice(0, 3);

    return Response.json({
      offer_request_id: offerRequestData.data?.id,
      client_key,
      is_return: isReturn,
      is_open_jaw: isOpenJaw,
      search: { origin, arrival_gateway, departure_gateway: effectiveDepartureGateway, departure_date, return_date: return_date || null, passengers, cabin_class: cabin_class || 'economy' },
      offers: tiles,                      // 3 labelled tiles for the UI
      all_offers: processedOffers,        // full set (for future 'see more options')
      total_offers_available: offers.length,
    });

  } catch (error) {
    console.error('Flight search error:', error);
    return Response.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}

function parseDuration(duration) {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 0;
  return (parseInt(match[1] || '0') * 60) + parseInt(match[2] || '0');
}
