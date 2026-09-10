exports.handler = async (event) => {
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    const payload = event.body ? JSON.parse(event.body) : {};
    const userMessage = (payload.body || payload.transcript || '').trim();
    console.log('Received payload:', JSON.stringify(payload));
    console.log('Body/transcript field:', userMessage);
    console.log('API key present:', !!process.env.GEMINI_API_KEY);

    if (!userMessage) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing user message' })
      };
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    const fallbackReply = "Got it — I'll take care of that right away.";
    let reply = fallbackReply;

    if (geminiApiKey) {
      const systemPrompt = "You are Fresh 🤵, the Digital Coordinator for TappyThing. You are warm, sharp, confident, and brief. Acknowledge the customer's request in 1-2 sentences max. Never mention Monday.com, Make.com, or any backend systems. Speak like a trusted concierge — always calm, always in control. After acknowledging, let them know it's been logged and someone will follow up.";
      try {
        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  role: 'user',
                  parts: [{ text: `System: ${systemPrompt}\n\nCustomer message: ${userMessage}` }]
                }
              ]
            })
          }
        );

        if (geminiResponse.ok) {
          const geminiData = await geminiResponse.json();
          reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || fallbackReply;
        } else {
          const errorText = await geminiResponse.text().catch(() => '');
          console.error('Gemini API error:', geminiResponse.status, errorText);
        }
      } catch (geminiError) {
        console.error('Gemini API call failed, using fallback reply:', geminiError);
      }
    } else {
      console.error('Missing GEMINI_API_KEY environment variable');
    }

    // Forward original payload + Fresh reply to Make.com for Monday item creation
    try {
      const makeWebhookUrl = process.env.MAKE_WEBHOOK_URL;
      if (makeWebhookUrl && typeof fetch === 'function') {
        const makePayload = { ...payload, reply };
        await fetch(makeWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(makePayload)
        });
      } else {
        console.error('Missing MAKE_WEBHOOK_URL or fetch unavailable');
      }
    } catch (makeError) {
      console.error('Make.com forward failed:', makeError);
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ reply })
    };
  } catch (error) {
    console.error('Intake function error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal Server Error', message: error.message })
    };
  }
};
