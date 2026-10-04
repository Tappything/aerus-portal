exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const { business_type, rep_name } = JSON.parse(event.body || '{}');

    const type = (business_type || 'generic').toLowerCase().trim();
    const rep = rep_name || 'Sales Rep';

    // Generate ephemeral 6-character session ID
    const sessionId = Math.random().toString(36).substring(2, 8);

    // Business-specific sandbox demo templates
    const templates = {
      bakery: [
        { title: '🎂 Custom Cake Order — Sarah Miller', status: 'Intake Received', amount: '$120.00' },
        { title: '🚚 Cupcake Delivery — York Rd Office', status: 'Out for Delivery', amount: '$65.00' },
        { title: '📄 Wedding Catering Proposal', status: 'Invoice Sent', amount: '$450.00' },
      ],
      salon: [
        { title: '💇 Cut & Color — Jessica Taylor', status: 'Appt Scheduled 2:00 PM', amount: '$140.00' },
        { title: '💅 Deluxe Pedicure — Ashley K.', status: 'In Chair', amount: '$60.00' },
        { title: '📄 Hair Product Package Invoice', status: 'Payment Complete', amount: '$85.00' },
      ],
      plumber: [
        { title: '🚰 Emergency Pipe Leak — Padonia Rd', status: 'Dispatch Sent', amount: '$220.00' },
        { title: '🔧 Water Heater Replacement Estimate', status: 'Pending Review', amount: '$1,250.00' },
        { title: '🔩 Brass Fittings & Valve Parts', status: 'Parts Ordered', amount: '$95.00' },
      ],
      generic: [
        { title: '📥 New Client Intake — Local Account', status: 'Pending Review', amount: '$150.00' },
        { title: '🛠️ Service & Repair Work Order', status: 'In Progress', amount: '$85.00' },
        { title: '📄 Completed Service Invoice', status: 'Ready for Payment', amount: '$210.00' },
      ],
    };

    const sampleCards = templates[type] || templates.generic;

    const demoUrl = `https://freshtappything.com/?demo=${sessionId}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        demo_url: demoUrl,
        session_id: sessionId,
        rep_name: rep,
        business_type: type,
        expires: '30 minutes',
        sample_cards: sampleCards,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
