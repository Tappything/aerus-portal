const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    
    // Accept custom input amount or default to original bill amount
    const rawAmount = body.customAmount || body.amount || '0';
    const amountStr = rawAmount.toString().replace(/[$,]/g, '');
    const amountCents = Math.round(parseFloat(amountStr) * 100);
    const description = body.description || 'Aerus Service Payment';
    const customerName = body.customer || 'Customer';

    if (amountCents <= 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid payment amount.' })
      };
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${description} (Partial Payment — ${customerName})`,
            description: 'Aerus Home Wellness — Timonium, MD'
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: 'https://freshtappything.com/?paid=true',
      cancel_url: 'https://freshtappything.com/?cancelled=true',
      customer_email: body.email || undefined,
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: session.url })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
