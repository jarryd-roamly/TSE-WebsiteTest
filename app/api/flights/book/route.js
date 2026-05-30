// app/api/flights/book/route.js
// Creates a Duffel order from a selected offer
// Called after traveller selects their preferred flight
// Module: 2 (Experience Designer checkout) + 6 (Finance - 100% flight payment at booking)

export async function POST(request) {
  try {
    const body = await request.json();
    const { offer_id, passengers, payment } = body;

    if (!offer_id || !passengers || !payment) {
      return Response.json(
        { error: 'Missing required fields: offer_id, passengers, payment' },
        { status: 400 }
      );
    }

    // Validate each passenger has required fields
    for (const passenger of passengers) {
      if (!passenger.given_name || !passenger.family_name || !passenger.born_on || 
          !passenger.email || !passenger.phone_number || !passenger.gender) {
        return Response.json(
          { error: 'Each passenger requires: given_name, family_name, born_on, email, phone_number, gender' },
          { status: 400 }
        );
      }
    }

    const orderPayload = {
      data: {
        type: 'instant',
        selected_offers: [offer_id],
        passengers,
        payments: [{
          type: payment.type || 'balance', // 'balance' for sandbox testing
          currency: payment.currency,
          amount: payment.amount,
        }],
        metadata: {
          booking_source: 'safari_edition',
          itinerary_id: body.itinerary_id || null,
        }
      }
    };

    const orderResponse = await fetch('https://api.duffel.com/air/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.DUFFEL_API_KEY}`,
        'Duffel-Version': 'v2',
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(orderPayload),
    });

    if (!orderResponse.ok) {
      const errorData = await orderResponse.json();
      console.error('Duffel order error:', errorData);
      return Response.json(
        { error: 'Failed to create flight order', details: errorData },
        { status: orderResponse.status }
      );
    }

    const orderData = await orderResponse.json();
    const order = orderData.data;

    return Response.json({
      success: true,
      order_id: order.id,
      booking_reference: order.booking_reference,
      documents: order.documents,
      passengers: order.passengers,
      slices: order.slices,
      total_amount: order.total_amount,
      total_currency: order.total_currency,
      conditions: order.conditions,
    });

  } catch (error) {
    console.error('Flight booking error:', error);
    return Response.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    );
  }
}
