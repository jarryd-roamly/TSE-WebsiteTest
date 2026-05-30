// app/api/flights/search/route.js
// International flight search via Duffel API
// Used by: Experience Designer - international leg selection (traveller-facing)
// Module: 2 (Experience Designer) + 5 (Pricing Engine - 8% margin on flights)

export async function POST(request) {
  try {
    const body = await request.json();
    const { origin, destination, departure_date, return_date, passengers, cabin_class } = body;

    // Validate required fields
    if (!origin || !destination || !departure_date || !passengers) {
      return Response.json(
        { error: 'Missing required fields: origin, destination, departure_date, passengers' },
        { status: 400 }
      );
    }

    const isReturn = !!return_date;

    // Build slices — outbound always, return if provided
    const slices = [
      {
        origin,
        destination,
        departure_date,
      }
    ];

    if (isReturn) {
      slices.push({
        origin: destination,
        destination: origin,
        departure_date: return_date,
      });
    }

    // Build passengers array
    const passengersArray = Array.from({ length: passengers }, () => ({
      type: 'adult'
    }));

    // Create offer request with Duffel
    const offerRequestPayload = {
      data: {
        slices,
        passengers: passengersArray,
        cabin_class: cabin_class || 'economy',
      }
    };

    const offerRequestResponse = await fetch('https://api.duffel.com/air/offer_requests?return_offers=true', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DUFFEL_API_KEY}`,
        'Duffel-Version': 'v2',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(offerRequestPayload),
    });

    if (!offerRequestResponse.ok) {
      const errorData = await offerRequestResponse.json();
      console.error('Duffel offer request error:', errorData);
      return Response.json(
        { error: 'Failed to fetch flight offers', details: errorData },
        { status: offerRequestResponse.status }
      );
    }

    const offerRequestData = await offerRequestResponse.json();
    const offers = offerRequestData.data?.offers || [];

    // Apply 8% flight margin (Pricing Engine - Module 5)
    // Margin is applied server-side — raw Duffel price is never exposed to client
    const FLIGHT_MARGIN = 0.08;

    // Process and clean offers for client consumption
    // Return top 10 by price to avoid overwhelming the traveller
    const processedOffers = offers
      .slice(0, 30) // take top 30 from Duffel before filtering
      .map(offer => {
        const basePrice = parseFloat(offer.total_amount);
        const currency = offer.total_currency;
        const priceWithMargin = basePrice * (1 + FLIGHT_MARGIN);

        return {
          id: offer.id,
          expires_at: offer.expires_at,
          currency,
          base_price: basePrice,                          // internal only — not sent to client
          display_price: Math.ceil(priceWithMargin),      // margin-inclusive price shown to traveller
          margin_amount: Math.ceil(priceWithMargin - basePrice), // internal tracking
          total_duration_minutes: offer.slices?.reduce((total, slice) => {
            return total + (slice.duration ? parseDuration(slice.duration) : 0);
          }, 0),
          slices: offer.slices?.map(slice => ({
            id: slice.id,
            origin: {
              iata: slice.origin?.iata_code,
              name: slice.origin?.name,
              city: slice.origin?.city?.name,
              terminal: slice.origin?.terminal,
            },
            destination: {
              iata: slice.destination?.iata_code,
              name: slice.destination?.name,
              city: slice.destination?.city?.name,
              terminal: slice.destination?.terminal,
            },
            departure_datetime: slice.segments?.[0]?.departing_at,
            arrival_datetime: slice.segments?.[slice.segments.length - 1]?.arriving_at,
            duration: slice.duration,
            duration_minutes: slice.duration ? parseDuration(slice.duration) : null,
            stops: slice.segments?.length - 1,
            segments: slice.segments?.map(seg => ({
              id: seg.id,
              flight_number: `${seg.marketing_carrier?.iata_code}${seg.marketing_carrier_flight_number}`,
              carrier_name: seg.marketing_carrier?.name,
              carrier_iata: seg.marketing_carrier?.iata_code,
              carrier_logo: seg.marketing_carrier?.logo_symbol_url,
              operating_carrier_name: seg.operating_carrier?.name, // US reg: must display
              aircraft: seg.aircraft?.name,
              departing_at: seg.departing_at,
              arriving_at: seg.arriving_at,
              origin_iata: seg.origin?.iata_code,
              destination_iata: seg.destination?.iata_code,
              duration: seg.duration,
            })),
          })),
          passengers: offer.passengers?.map(p => ({
            id: p.id,
            type: p.type,
          })),
          baggage: offer.slices?.[0]?.segments?.[0]?.passengers?.[0]?.baggages || [],
          conditions: {
            refundable: offer.conditions?.refund_before_departure?.allowed,
            changeable: offer.conditions?.change_before_departure?.allowed,
          },
          payment_requirements: {
            requires_instant_payment: offer.payment_requirements?.requires_instant_payment,
            price_guarantee_expires_at: offer.payment_requirements?.price_guarantee_expires_at,
          }
        };
      })
      // Strip internal pricing fields before sending to client
      .map(({ base_price, margin_amount, ...clientSafeOffer }) => clientSafeOffer)
      .sort((a, b) => a.display_price - b.display_price)
      .slice(0, 10); // top 10 cheapest after margin

    return Response.json({
      offer_request_id: offerRequestData.data?.id,
      is_return: isReturn,
      search: {
        origin,
        destination,
        departure_date,
        return_date: return_date || null,
        passengers,
        cabin_class: cabin_class || 'economy',
      },
      offers: processedOffers,
      total_offers_available: offers.length,
    });

  } catch (error) {
    console.error('Flight search error:', error);
    return Response.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}

// Parse ISO 8601 duration (PT2H30M) to minutes
function parseDuration(duration) {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0');
  const minutes = parseInt(match[2] || '0');
  return hours * 60 + minutes;
}
